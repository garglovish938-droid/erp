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
        print(f"[-] SQLite backup failed: {e}. Proceeding anyway.")
        return None

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
        print(f"[-] PostgreSQL JSON backup failed: {e}. Proceeding anyway.")
        return None

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

    # Apply wallet-specific migrations
    # 2. factory_wallet table migrations
    fw_table = "factory_wallet"
    if fw_table in inspector.get_table_names():
        fw_columns = [col['name'] for col in inspector.get_columns(fw_table)]
        with engine.begin() as conn:
            if "name" not in fw_columns:
                col_type = "TEXT" if is_sqlite else "VARCHAR(100)"
                conn.execute(text(f"ALTER TABLE {fw_table} ADD COLUMN name {col_type}"))
                print(f"  [+] Added column '{fw_table}.name'")
            if "opening_balance" not in fw_columns:
                col_type = "REAL" if is_sqlite else "DOUBLE PRECISION"
                conn.execute(text(f"ALTER TABLE {fw_table} ADD COLUMN opening_balance {col_type} DEFAULT 0.0"))
                print(f"  [+] Added column '{fw_table}.opening_balance'")
            if "activation_date" not in fw_columns:
                conn.execute(text(f"ALTER TABLE {fw_table} ADD COLUMN activation_date DATE"))
                print(f"  [+] Added column '{fw_table}.activation_date'")
            if "opening_txn_id" not in fw_columns:
                col_type = "TEXT" if is_sqlite else "VARCHAR(50)"
                conn.execute(text(f"ALTER TABLE {fw_table} ADD COLUMN opening_txn_id {col_type}"))
                print(f"  [+] Added column '{fw_table}.opening_txn_id'")
            if "status" not in fw_columns:
                col_type = "TEXT" if is_sqlite else "VARCHAR(20)"
                conn.execute(text(f"ALTER TABLE {fw_table} ADD COLUMN status {col_type} DEFAULT 'active'"))
                print(f"  [+] Added column '{fw_table}.status'")
            if "created_by" not in fw_columns:
                col_type = "TEXT" if is_sqlite else "VARCHAR(36)"
                conn.execute(text(f"ALTER TABLE {fw_table} ADD COLUMN created_by {col_type}"))
                print(f"  [+] Added column '{fw_table}.created_by'")
            if "created_at" not in fw_columns:
                col_type = "DATETIME" if is_sqlite else "TIMESTAMP"
                default_val = "datetime('now')" if is_sqlite else "CURRENT_TIMESTAMP"
                conn.execute(text(f"ALTER TABLE {fw_table} ADD COLUMN created_at {col_type} DEFAULT {default_val}"))
                print(f"  [+] Added column '{fw_table}.created_at'")

    # 3. factory_wallet_transactions table migrations
    fwt_table = "factory_wallet_transactions"
    if fwt_table in inspector.get_table_names():
        fwt_columns = [col['name'] for col in inspector.get_columns(fwt_table)]
        with engine.begin() as conn:
            if "wallet_id" not in fwt_columns:
                col_type = "TEXT" if is_sqlite else "VARCHAR(36)"
                conn.execute(text(f"ALTER TABLE {fwt_table} ADD COLUMN wallet_id {col_type} DEFAULT 'default'"))
                print(f"  [+] Added column '{fwt_table}.wallet_id'")

    # 4. daily_expenses table migrations
    de_table = "daily_expenses"
    if de_table in inspector.get_table_names():
        de_columns = [col['name'] for col in inspector.get_columns(de_table)]
        with engine.begin() as conn:
            if "wallet_id" not in de_columns:
                col_type = "TEXT" if is_sqlite else "VARCHAR(36)"
                conn.execute(text(f"ALTER TABLE {de_table} ADD COLUMN wallet_id {col_type} DEFAULT 'default'"))
                print(f"  [+] Added column '{de_table}.wallet_id'")
            if "wallet_linked" not in de_columns:
                col_type = "BOOLEAN" if is_sqlite else "BOOLEAN"
                conn.execute(text(f"ALTER TABLE {de_table} ADD COLUMN wallet_linked {col_type} DEFAULT FALSE"))
                print(f"  [+] Added column '{de_table}.wallet_linked'")
            if "linked_date" not in de_columns:
                conn.execute(text(f"ALTER TABLE {de_table} ADD COLUMN linked_date DATE"))
                print(f"  [+] Added column '{de_table}.linked_date'")
            if "transaction_source" not in de_columns:
                col_type = "TEXT" if is_sqlite else "VARCHAR(50)"
                conn.execute(text(f"ALTER TABLE {de_table} ADD COLUMN transaction_source {col_type}"))
                print(f"  [+] Added column '{de_table}.transaction_source'")
            if "settlement_status" not in de_columns:
                col_type = "TEXT" if is_sqlite else "VARCHAR(20)"
                conn.execute(text(f"ALTER TABLE {de_table} ADD COLUMN settlement_status {col_type} DEFAULT 'settled'"))
                print(f"  [+] Added column '{de_table}.settlement_status'")

    # 5. project_payments table migrations
    pp_table = "project_payments"
    if pp_table in inspector.get_table_names():
        pp_columns = [col['name'] for col in inspector.get_columns(pp_table)]
        with engine.begin() as conn:
            if "wallet_id" not in pp_columns:
                col_type = "TEXT" if is_sqlite else "VARCHAR(36)"
                conn.execute(text(f"ALTER TABLE {pp_table} ADD COLUMN wallet_id {col_type}"))
                print(f"  [+] Added column '{pp_table}.wallet_id'")
            if "wallet_linked" not in pp_columns:
                col_type = "BOOLEAN" if is_sqlite else "BOOLEAN"
                conn.execute(text(f"ALTER TABLE {pp_table} ADD COLUMN wallet_linked {col_type} DEFAULT FALSE"))
                print(f"  [+] Added column '{pp_table}.wallet_linked'")

    # 6. stock_transactions table migrations
    st_table = "stock_transactions"
    if st_table in inspector.get_table_names():
        st_columns = [col['name'] for col in inspector.get_columns(st_table)]
        with engine.begin() as conn:
            if "opening_stock" not in st_columns:
                col_type = "REAL" if is_sqlite else "DOUBLE PRECISION"
                conn.execute(text(f"ALTER TABLE {st_table} ADD COLUMN opening_stock {col_type}"))
                print(f"  [+] Added column '{st_table}.opening_stock'")
            if "remaining_quantity" not in st_columns:
                col_type = "REAL" if is_sqlite else "DOUBLE PRECISION"
                conn.execute(text(f"ALTER TABLE {st_table} ADD COLUMN remaining_quantity {col_type}"))
                print(f"  [+] Added column '{st_table}.remaining_quantity'")

def main():
    try:
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
    except Exception as e:
        print(f"[-] Migration failed: {e}. Continuing to start uvicorn...")

if __name__ == "__main__":
    main()
