import sys
import os
import requests

# Add current directory to path so we can import config
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config import settings

def init_buckets():
    url = settings.SUPABASE_URL.rstrip('/')
    key = settings.SUPABASE_KEY
    provider = settings.STORAGE_PROVIDER

    if provider != "supabase":
        print(f"STORAGE_PROVIDER is '{provider}'. Skipping Supabase bucket initialization.")
        return

    if not url or not key:
        print("Error: STORAGE_PROVIDER is 'supabase', but SUPABASE_URL or SUPABASE_KEY is not set.")
        sys.exit(1)

    # Define buckets and their configurations
    buckets = [
        {
            "id": "attendance",
            "name": "attendance",
            "public": False,
            "file_size_limit": 10485760, # 10MB
            "allowed_mime_types": ["image/jpeg", "image/png", "image/webp", "image/jpg"]
        },
        {
            "id": "employees",
            "name": "employees",
            "public": False,
            "file_size_limit": 5242880, # 5MB
            "allowed_mime_types": ["image/jpeg", "image/png", "image/webp", "image/jpg"]
        },
        {
            "id": "projects",
            "name": "projects",
            "public": False,
            "file_size_limit": 52428800, # 50MB
            "allowed_mime_types": None # Allow all file types
        },
        {
            "id": "inventory",
            "name": "inventory",
            "public": True,
            "file_size_limit": 10485760, # 10MB
            "allowed_mime_types": ["image/jpeg", "image/png", "image/webp", "image/jpg"]
        },
        {
            "id": "documents",
            "name": "documents",
            "public": False,
            "file_size_limit": 52428800, # 50MB
            "allowed_mime_types": None # Allow all file types
        },
        {
            "id": "reports",
            "name": "reports",
            "public": False,
            "file_size_limit": 20971520, # 20MB
            "allowed_mime_types": [
                "application/pdf", 
                "text/csv", 
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ]
        },
        {
            "id": "public-assets",
            "name": "public-assets",
            "public": True,
            "file_size_limit": 10485760, # 10MB
            "allowed_mime_types": None # Allow all
        }
    ]

    print("=== INITIALIZING SUPABASE STORAGE BUCKETS ===")
    
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }

    # Fetch existing buckets to see what we have
    list_url = f"{url}/storage/v1/bucket"
    try:
        r = requests.get(list_url, headers=headers, timeout=10)
        if r.status_code == 200:
            existing_bucket_ids = [b["id"] for b in r.json()]
            print(f"Existing buckets on Supabase: {existing_bucket_ids}")
        else:
            print(f"Warning: Failed to fetch existing buckets list (HTTP {r.status_code}): {r.text}")
            existing_bucket_ids = []
    except Exception as e:
        print(f"Error connecting to Supabase: {e}")
        sys.exit(1)

    for b in buckets:
        b_id = b["id"]
        if b_id in existing_bucket_ids:
            print(f"Bucket '{b_id}' already exists. Updating configuration...")
            # Update existing bucket
            update_url = f"{url}/storage/v1/bucket/{b_id}"
            payload = {
                "id": b_id,
                "name": b["name"],
                "public": b["public"],
                "file_size_limit": b["file_size_limit"],
                "allowed_mime_types": b["allowed_mime_types"]
            }
            res = requests.put(update_url, headers=headers, json=payload, timeout=10)
            if res.status_code == 200:
                print(f"  [OK] Bucket '{b_id}' updated successfully.")
            else:
                print(f"  [ERROR] Failed to update bucket '{b_id}' (HTTP {res.status_code}): {res.text}")
        else:
            print(f"Creating bucket '{b_id}'...")
            create_url = f"{url}/storage/v1/bucket"
            res = requests.post(create_url, headers=headers, json=b, timeout=10)
            if res.status_code == 200:
                print(f"  [OK] Bucket '{b_id}' created successfully.")
            else:
                print(f"  [ERROR] Failed to create bucket '{b_id}' (HTTP {res.status_code}): {res.text}")

    print("\nSupabase storage bucket initialization complete.")

if __name__ == "__main__":
    init_buckets()
