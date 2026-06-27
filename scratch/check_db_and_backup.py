import os
import shutil
import sqlite3

# Define paths
src_dir = r"d:\Factory erp\erp_demo"
backend_dir = os.path.join(src_dir, "backend")
backup_dir = os.path.join(src_dir, "backups", "god_mode_backup")

# Create backup dir
os.makedirs(backup_dir, exist_ok=True)
os.makedirs(os.path.join(backup_dir, "backend"), exist_ok=True)

# Files to backup
root_files = ["Dockerfile", "railway.toml"]
backend_files = [
    "main.py", "crud.py", "schemas.py", "models.py", 
    "auth.py", "database.py", "config.py", "requirements.txt", 
    "Dockerfile", "railway.toml"
]

print("=== STARTING BACKUP ===")
# Backup root files
for f in root_files:
    src_path = os.path.join(src_dir, f)
    if os.path.exists(src_path):
        shutil.copy2(src_path, os.path.join(backup_dir, f))
        print(f"Backed up root: {f}")

# Backup backend files
for f in backend_files:
    src_path = os.path.join(backend_dir, f)
    if os.path.exists(src_path):
        shutil.copy2(src_path, os.path.join(backup_dir, "backend", f))
        print(f"Backed up backend: {f}")

print("\n=== GENERATING DATABASE SNAPSHOT ===")
db_path = os.path.join(backend_dir, "erp.db")
if not os.path.exists(db_path):
    print(f"Error: erp.db not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

tables = {
    "Users": "users",
    "Attendance": "attendance",
    "Inventory": "inventory",
    "Projects": "projects",
    "Purchase Orders": "purchase_orders",
    "Expenses": "daily_expenses",
    "Suppliers": "suppliers",
    "Activity Logs": "activity_logs"
}

snapshot = {}
for name, table in tables.items():
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        snapshot[name] = count
        print(f"{name} Count: {count}")
    except sqlite3.OperationalError as e:
        print(f"Table '{table}' could not be queried: {e}")
        snapshot[name] = "Error"

conn.close()
print("=== SNAPSHOT COMPLETED ===")
