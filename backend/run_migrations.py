import os
import sys
import json
import shutil
from datetime import datetime, date
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

# Append current directory to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_dir)

from config import settings

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)

def get_engine():
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgres://"):
         db_url = db_url.replace("postgres://", "postgresql://", 1)
    print(f"Connecting to database url: {db_url.split('@')[-1] if '@' in db_url else db_url}")
    return create_engine(db_url)

def backup_sqlite(db_url):
    db_path = db_url.replace("sqlite:///", "")
    if not os.path.exists(db_path):
        # try fallback paths
        if os.path.exists("./erp.db"):
            db_path = "./erp.db"
        elif os.path.exists("./backend/erp.db"):
            db_path = "./backend/erp.db"
        else:
            print(f"[-] SQLite database file not found at {db_path}, skipping file backup.")
            return None

    backup_dir = settings.BACKUP_DIR
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(backup_dir, f"backup_migration_{timestamp}.db")
    
    try:
        shutil.copy2(db_path, backup_path)
        print(f"[+] SQLite file backup successfully created: {backup_path}")
        return backup_path
    except Exception as e:
        print(f"[-] SQLite backup failed: {e}")
        raise e

def backup_postgres(engine):
    backup_dir = settings.BACKUP_DIR
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(backup_dir, f"backup_migration_{timestamp}_pg.json")
    
    print("[*] Performing PostgreSQL JSON data dump backup...")
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        dump_data = {}
        
        # Connect to DB and fetch rows
        with engine.connect() as conn:
            for table in tables:
                # Query all rows
                result = conn.execute(text(f'SELECT * FROM "{table}"'))
                # Get column names
                keys = result.keys()
                rows = [dict(zip(keys, row)) for row in result.fetchall()]
                dump_data[table] = rows
                print(f"  Dumped table '{table}': {len(rows)} rows.")
                
        # Write to JSON file
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(dump_data, f, cls=DateTimeEncoder, indent=2)
            
        print(f"[+] PostgreSQL JSON backup successfully created: {backup_path}")
        return backup_path
    except Exception as e:
        print(f"[-] PostgreSQL JSON backup failed: {e}")
        raise e

def apply_migrations(engine):
    inspector = inspect(engine)
    is_sqlite = engine.url.drivername == "sqlite"
    
    table_name = "project_material_history"
    if table_name not in inspector.get_table_names():
        # Schema not initialized at all, let create_all handle it
        print(f"[*] Table '{table_name}' does not exist yet. It will be created by base metadata.")
        return

    columns = [col['name'] for col in inspector.get_columns(table_name)]
    
    with engine.begin() as conn:
        # 1. Add status
        if "status" not in columns:
            col_type = "TEXT" if is_sqlite else "VARCHAR(50)"
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN status {col_type} DEFAULT 'approved'"))
            print(f"  [+] Added column '{table_name}.status'")
        else:
            print(f"  [=] Column '{table_name}.status' already exists.")
            
        # 2. Add approved_by
        if "approved_by" not in columns:
            col_type = "TEXT" if is_sqlite else "VARCHAR(36)"
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN approved_by {col_type}"))
            print(f"  [+] Added column '{table_name}.approved_by'")
        else:
            print(f"  [=] Column '{table_name}.approved_by' already exists.")
            
        # 3. Add approved_at
        if "approved_at" not in columns:
            col_type = "DATETIME" if is_sqlite else "TIMESTAMP"
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN approved_at {col_type}"))
            print(f"  [+] Added column '{table_name}.approved_at'")
        else:
            print(f"  [=] Column '{table_name}.approved_at' already exists.")

def main():
    print("=== STARTING DATABASE MIGRATION ===")
    engine = get_engine()
    
    # 1. Automatic Backup
    if engine.url.drivername == "sqlite":
        backup_sqlite(settings.DATABASE_URL)
    else:
        backup_postgres(engine)
        
    # 2. Apply migrations
    print("\nApplying additive schema updates...")
    apply_migrations(engine)
    
    print("\n[+] Migration run complete!")

if __name__ == "__main__":
    main()
