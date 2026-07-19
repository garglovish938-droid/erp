import os
import shutil
import zipfile
from datetime import datetime

def make_backup():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backup_dir = os.path.join(root_dir, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_zip_name = f"website_backup_{timestamp}.zip"
    backup_zip_path = os.path.join(backup_dir, backup_zip_name)
    
    # Directories/files to exclude from zip
    exclude_dirs = {
        "node_modules", ".next", ".git", ".venv", "venv", "venv312", 
        "__pycache__", ".pytest_cache", "backups", "test_backups", 
        "uploads"
    }
    
    print(f"Creating system backup zip: {backup_zip_name}...")
    
    with zipfile.ZipFile(backup_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(root_dir):
            # Prune excluded directories to avoid walking them
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                # Skip existing zip files in the root or backups folder
                if file.endswith(".zip") or file.endswith(".db.bak"):
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, root_dir)
                zipf.write(file_path, arcname)
                
    print(f"Success: Core codebase successfully backed up to: {backup_zip_path}")
    
    # Copy SQLite databases
    databases = ["erp.db", "backend/erp.db", "test.db", "backend/test.db"]
    for db in databases:
        db_path = os.path.join(root_dir, db)
        if os.path.exists(db_path):
            dest_db = os.path.join(backup_dir, f"{os.path.basename(db)}_{timestamp}.db")
            shutil.copy2(db_path, dest_db)
            print(f"Success: Database ledger '{db}' successfully backed up to: {dest_db}")

if __name__ == "__main__":
    make_backup()
