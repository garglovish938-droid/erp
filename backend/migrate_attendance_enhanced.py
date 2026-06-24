import os
import shutil
import sqlite3
from datetime import datetime

DB_PATH = "./erp.db"
BACKUP_DIR = "./backups"

def backup_and_verify():
    if not os.path.exists(DB_PATH):
        print(f"[-] Database file not found at {DB_PATH}, skipping backup.")
        return False
        
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(BACKUP_DIR, f"backup_enhanced_{timestamp}.db")
    
    try:
        # Create backup copy
        shutil.copy2(DB_PATH, backup_path)
        print(f"[+] Automatic backup successfully created: {backup_path}")
        
        # Verify backup can be restored / read from
        conn = sqlite3.connect(backup_path)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM users")
        user_count = c.fetchone()[0]
        conn.close()
        print(f"[+] Verified backup: successfully read {user_count} users from backup copy.")
        return backup_path
    except Exception as e:
        print(f"[-] Critical Error: Database backup or verification failed: {e}")
        raise e

def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [row[1] for row in cursor.fetchall()]
    return column in cols

def add_column_if_missing(cursor, table, column, col_type, default_val=None):
    if not column_exists(cursor, table, column):
        sql = f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"
        if default_val is not None:
            sql += f" DEFAULT {default_val}"
        cursor.execute(sql)
        print(f"  [+] Added column: {table}.{column} ({col_type})")
    else:
        print(f"  [=] Column already exists: {table}.{column}")

def migrate():
    # Step 1: Automatic Backup and Verification
    print("=== STARTING DATABASE BACKUP AND VERIFICATION ===")
    backup_path = backup_and_verify()
    if not backup_path:
        print("[-] Backup failed. Aborting migration.")
        return
        
    # Step 2: Schema Migration
    print("\n=== RUNNING SCHEMA MIGRATION ===")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("[attendance]")
        add_column_if_missing(cursor, "attendance", "check_in_fingerprint", "TEXT")
        add_column_if_missing(cursor, "attendance", "check_in_browser", "TEXT")
        add_column_if_missing(cursor, "attendance", "check_out_device", "TEXT")
        add_column_if_missing(cursor, "attendance", "check_out_ip", "TEXT")
        add_column_if_missing(cursor, "attendance", "check_out_fingerprint", "TEXT")
        add_column_if_missing(cursor, "attendance", "check_out_browser", "TEXT")
        add_column_if_missing(cursor, "attendance", "is_suspicious", "INTEGER", "0")
        add_column_if_missing(cursor, "attendance", "suspicious_reason", "TEXT")
        
        conn.commit()
        print("\n=== MIGRATION COMPLETE ===")
        print(f"[+] All new columns added successfully. Backup location: {backup_path}")
    except Exception as e:
        conn.rollback()
        print(f"[-] Migration failed: {e}")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
