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
    backup_path = os.path.join(BACKUP_DIR, f"backup_enterprise_{timestamp}.db")
    
    try:
        shutil.copy2(DB_PATH, backup_path)
        print(f"[+] Verified Backup successfully created: {backup_path}")
        
        # Verify read
        conn = sqlite3.connect(backup_path)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM users")
        user_count = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM staff")
        staff_count = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM attendance")
        att_count = c.fetchone()[0]
        conn.close()
        print(f"[+] Verified backup: read {user_count} users, {staff_count} staff, {att_count} attendance records successfully.")
        return backup_path
    except Exception as e:
        print(f"[-] Database backup / verification failed: {e}")
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
    print("=== STARTING BACKUP AND VERIFICATION ===")
    backup_path = backup_and_verify()
    
    print("\n=== STARTING SCHEMA MIGRATION ===")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Add work_photo to daily_work_logs
        print("[daily_work_logs]")
        add_column_if_missing(cursor, "daily_work_logs", "work_photo", "VARCHAR(255)")

        conn.commit()
        print("\n=== MIGRATION COMPLETE ===")
        print(f"[+] All database alterations applied successfully. Backup at: {backup_path}")
    except Exception as e:
        conn.rollback()
        print(f"[-] Migration error: {e}")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
