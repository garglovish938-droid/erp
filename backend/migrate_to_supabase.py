import os
import sys
import hashlib
import mimetypes

# Add parent directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import settings
from database import SessionLocal
from models import Document
from storage import storage_provider, SupabaseStorageProvider

def compute_md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()

def run_migration():
    if not isinstance(storage_provider, SupabaseStorageProvider):
        print(f"Active STORAGE_PROVIDER is not 'supabase' (current: {settings.STORAGE_PROVIDER}).")
        print("To run the migration, make sure STORAGE_PROVIDER=supabase, SUPABASE_URL, and SUPABASE_KEY are set.")
        sys.exit(1)

    print("=== STARTING FILE MIGRATION TO SUPABASE STORAGE ===")
    
    db = SessionLocal()
    uploads_dir = settings.UPLOAD_DIR
    if not os.path.exists(uploads_dir):
        print(f"Uploads directory {os.path.abspath(uploads_dir)} does not exist.")
        db.close()
        return

    # Count total files to migrate
    local_files = []
    for root, _, files in os.walk(uploads_dir):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, uploads_dir).replace('\\', '/')
            local_files.append((full_path, rel_path))

    print(f"Found {len(local_files)} files in local uploads directory.")
    
    success_count = 0
    skip_count = 0
    fail_count = 0

    for full_path, rel_path in local_files:
        filename = os.path.basename(rel_path)
        size = os.path.getsize(full_path)
        
        # Skip empty placeholder files if any (size = 0)
        if size == 0:
            print(f"Skipping empty file: {rel_path}")
            skip_count += 1
            continue

        # Determine bucket and subpath matching our serve rules
        subpath = ""
        bucket = "documents"
        
        if rel_path.startswith("selfies/"):
            bucket = "attendance"
            subpath = "selfies"
        elif rel_path.startswith("work_photos/"):
            bucket = "projects"
            subpath = "work_photos"
        elif rel_path.startswith("expense_bills/"):
            bucket = "documents"
            subpath = "expense_bills"
        else:
            # Query Document model to check entity_type
            db_path = f"/uploads/{rel_path}"
            doc = db.query(Document).filter(Document.file_path == db_path, Document.is_deleted == False).first()
            if doc:
                if doc.entity_type == "Project":
                    bucket = "projects"
                elif doc.entity_type == "InventoryItem":
                    bucket = "inventory"
                elif doc.entity_type in ["Staff", "Employee"]:
                    bucket = "employees"
                elif doc.entity_type == "Report":
                    bucket = "reports"
                else:
                    bucket = "documents"
            else:
                bucket = "documents"
            subpath = ""

        # Determine MIME type
        mime_type, _ = mimetypes.guess_type(full_path)
        if not mime_type:
            if bucket in ["attendance", "employees", "inventory"]:
                mime_type = "image/jpeg"
            else:
                mime_type = "application/octet-stream"

        print(f"Migrating {rel_path} -> bucket '{bucket}', subpath '{subpath}' ({size} bytes, MIME: {mime_type})")
        
        try:
            with open(full_path, "rb") as f_in:
                data = f_in.read()
                
            # Perform upload via SupabaseStorageProvider
            storage_provider.upload_file(
                file_data=data,
                filename=filename,
                bucket=bucket,
                mime_type=mime_type,
                subpath=subpath
            )
            success_count += 1
            print(f"  [OK] Successfully uploaded {rel_path}")
        except Exception as e:
            print(f"  [ERROR] Failed to upload {rel_path}: {e}")
            fail_count += 1

    db.close()
    
    print("\n=== MIGRATION SUMMARY ===")
    print(f"Total files:      {len(local_files)}")
    print(f"Successfully uploaded: {success_count}")
    print(f"Skipped:          {skip_count}")
    print(f"Failed:           {fail_count}")
    print("=========================")

if __name__ == "__main__":
    run_migration()
