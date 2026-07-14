import os
import hashlib
import logging
import requests
from abc import ABC, abstractmethod
from urllib3.util import Retry
from requests.adapters import HTTPAdapter
from config import settings

logger = logging.getLogger("erp.storage")
logger.setLevel(logging.INFO)

class StorageProvider(ABC):
    @abstractmethod
    def upload_file(self, file_data: bytes, filename: str, bucket: str, mime_type: str, subpath: str = "") -> str:
        """
        Uploads a file to storage and returns the database path (e.g. /uploads/selfies/file.jpg).
        """
        pass

    @abstractmethod
    def get_signed_url(self, bucket: str, inner_path: str, expires_in: int = 60) -> str:
        """
        Generates a signed URL for secure download/preview.
        """
        pass

    @abstractmethod
    def get_public_url(self, bucket: str, inner_path: str) -> str:
        """
        Generates a public URL.
        """
        pass

    def validate_file(self, file_data: bytes, mime_type: str, max_size_mb: float = 20.0):
        """
        Validates file size.
        """
        size_mb = len(file_data) / (1024 * 1024)
        if size_mb > max_size_mb:
            raise ValueError(f"File size {size_mb:.2f}MB exceeds the maximum allowed limit of {max_size_mb}MB.")


class LocalStorageProvider(StorageProvider):
    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR
        os.makedirs(self.upload_dir, exist_ok=True)

    def upload_file(self, file_data: bytes, filename: str, bucket: str, mime_type: str, subpath: str = "") -> str:
        self.validate_file(file_data, mime_type)
        
        # Determine write path
        dest_dir = os.path.join(self.upload_dir, subpath) if subpath else self.upload_dir
        os.makedirs(dest_dir, exist_ok=True)
        dest_file = os.path.join(dest_dir, filename)
        
        with open(dest_file, "wb") as f:
            f.write(file_data)
            
        db_path = f"/uploads/{subpath}/{filename}" if subpath else f"/uploads/{filename}"
        logger.info(f"LocalStorageProvider: saved file to {dest_file} -> DB path: {db_path}")
        return db_path

    def get_signed_url(self, bucket: str, inner_path: str, expires_in: int = 60) -> str:
        # For local dev, signed URL is just the local relative path handled by dynamic server
        subpath = self._map_bucket_to_subpath(bucket, inner_path)
        return f"/uploads/{subpath}"

    def get_public_url(self, bucket: str, inner_path: str) -> str:
        subpath = self._map_bucket_to_subpath(bucket, inner_path)
        return f"/uploads/{subpath}"

    def _map_bucket_to_subpath(self, bucket: str, inner_path: str) -> str:
        if bucket == "attendance" and not inner_path.startswith("selfies/"):
            return f"selfies/{inner_path}"
        return inner_path


class SupabaseStorageProvider(StorageProvider):
    def __init__(self):
        self.url = settings.SUPABASE_URL.rstrip('/')
        self.key = settings.SUPABASE_KEY
        
        if not self.url or not self.key:
            raise ValueError("Supabase storage provider requested, but SUPABASE_URL or SUPABASE_KEY is missing.")
            
        # Configure requests session with Retries
        self.session = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[500, 502, 503, 504],
            raise_on_status=False
        )
        self.session.mount("https://", HTTPAdapter(max_retries=retries))
        self.session.mount("http://", HTTPAdapter(max_retries=retries))
        
        self.timeout = 15.0 # Seconds

    def _get_headers(self, content_type: str = None) -> dict:
        headers = {
            "Authorization": f"Bearer {self.key}"
        }
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    def _get_object_key(self, filename: str, subpath: str) -> str:
        if subpath == "selfies":
            # For selfies subpath, save directly under root of attendance bucket
            return filename
        elif subpath == "work_photos":
            # For project work photos, save as work_photos/filename inside projects bucket
            return f"work_photos/{filename}"
        elif subpath == "expense_bills":
            # For expense bills, save as expense_bills/filename inside documents bucket
            return f"expense_bills/{filename}"
        else:
            return filename

    def upload_file(self, file_data: bytes, filename: str, bucket: str, mime_type: str, subpath: str = "") -> str:
        self.validate_file(file_data, mime_type)
        
        # Enforce image/jpeg for image buckets to satisfy allowed_mime_types checks
        if bucket in ["attendance", "employees", "inventory"]:
            if not mime_type or not mime_type.startswith("image/"):
                mime_type = "image/jpeg"
                
        # If Supabase is the active provider, attempt upload
        if settings.STORAGE_PROVIDER == "supabase":
            try:
                object_key = self._get_object_key(filename, subpath)
                upload_url = f"{self.url}/storage/v1/object/{bucket}/{object_key}"
                
                logger.info(f"SupabaseStorageProvider: uploading {filename} to bucket {bucket} with key {object_key}")
                
                headers = self._get_headers(mime_type)
                headers["x-upsert"] = "true"
                
                response = self.session.post(upload_url, headers=headers, data=file_data, timeout=self.timeout)
                
                if response.status_code == 200:
                    logger.info(f"Supabase upload success: {response.json()}")
                    db_path = f"/uploads/{subpath}/{filename}" if subpath else f"/uploads/{filename}"
                    return db_path
                else:
                    logger.error(f"Supabase upload rejected with status {response.status_code}: {response.text}. Falling back to local storage.")
            except Exception as e:
                logger.error(f"Error during Supabase upload: {e}. Falling back to local storage.")
                
        # Local Fallback (runs if provider is local, or if Supabase upload failed)
        try:
            dest_dir = os.path.join(settings.UPLOAD_DIR, subpath) if subpath else settings.UPLOAD_DIR
            os.makedirs(dest_dir, exist_ok=True)
            dest_file = os.path.join(dest_dir, filename)
            
            with open(dest_file, "wb") as f:
                f.write(file_data)
                
            db_path = f"/uploads/{subpath}/{filename}" if subpath else f"/uploads/{filename}"
            logger.info(f"LocalStorage fallback success: saved file to {dest_file} -> DB path: {db_path}")
            return db_path
        except Exception as e:
            logger.error(f"Failed to save file to local fallback: {e}")
            raise Exception(f"Storage Provider upload failed: {str(e)}")

    def get_signed_url(self, bucket: str, inner_path: str, expires_in: int = 60) -> str:
        sign_url = f"{self.url}/storage/v1/object/sign/{bucket}/{inner_path}"
        headers = self._get_headers("application/json")
        payload = {"expiresIn": expires_in}
        
        try:
            response = self.session.post(sign_url, headers=headers, json=payload, timeout=self.timeout)
            if response.status_code != 200:
                logger.error(f"Failed to generate signed URL for {bucket}/{inner_path}: {response.text}")
                # Return public fallback on failure
                return self.get_public_url(bucket, inner_path)
                
            res_data = response.json()
            signed_url_path = res_data.get("signedURL")
            if signed_url_path:
                # Add full domain if Supabase returns relative signed URL path
                if signed_url_path.startswith('/'):
                    if signed_url_path.startswith('/storage/v1'):
                        return f"{self.url}{signed_url_path}"
                    return f"{self.url}/storage/v1{signed_url_path}"
                return signed_url_path
        except Exception as e:
            logger.error(f"Error generating signed URL: {e}")
            
        return self.get_public_url(bucket, inner_path)

    def get_public_url(self, bucket: str, inner_path: str) -> str:
        return f"{self.url}/storage/v1/object/public/{bucket}/{inner_path}"


# Factory instantiation based on settings
if settings.STORAGE_PROVIDER == "supabase":
    try:
        storage_provider = SupabaseStorageProvider()
        logger.info("Using SupabaseStorageProvider")
    except Exception as e:
        logger.error(f"Failed to initialize SupabaseStorageProvider: {e}. Falling back to LocalStorageProvider.")
        storage_provider = LocalStorageProvider()
else:
    storage_provider = LocalStorageProvider()
    logger.info("Using LocalStorageProvider")
