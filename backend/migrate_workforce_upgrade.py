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
        conn.close()
        print(f"[+] Verified backup: read {user_count} users successfully.")
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
        # Create shifts table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS shifts (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(50) UNIQUE NOT NULL,
            check_in_time VARCHAR(10) NOT NULL,
            check_out_time VARCHAR(10) NOT NULL,
            created_at DATETIME NOT NULL,
            is_deleted BOOLEAN DEFAULT 0
        )
        """)
        print("[+] Created shifts table (if missing)")

        # Create attendance_rules table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance_rules (
            id VARCHAR(36) PRIMARY KEY,
            late_grace_minutes INTEGER DEFAULT 0,
            half_day_threshold_hours FLOAT DEFAULT 4.0,
            min_hours_present FLOAT DEFAULT 8.0,
            created_at DATETIME NOT NULL
        )
        """)
        print("[+] Created attendance_rules table (if missing)")

        # Add columns to staff
        print("[staff]")
        add_column_if_missing(cursor, "staff", "shift_id", "VARCHAR(36)")

        # Add columns to attendance
        print("[attendance]")
        add_column_if_missing(cursor, "attendance", "project_id", "VARCHAR(36)")
        add_column_if_missing(cursor, "attendance", "task", "VARCHAR(200)")
        add_column_if_missing(cursor, "attendance", "work_photo", "VARCHAR(255)")
        add_column_if_missing(cursor, "attendance", "remarks", "TEXT")
        add_column_if_missing(cursor, "attendance", "progress_percentage", "INTEGER", "0")

        # Add columns to purchase_orders
        print("[purchase_orders]")
        add_column_if_missing(cursor, "purchase_orders", "category", "VARCHAR(50)", "'Raw Material'")

        # Add columns to activity_logs
        print("[activity_logs]")
        add_column_if_missing(cursor, "activity_logs", "device", "VARCHAR(100)")

        # Modify material_requests table to make project_id nullable
        print("[material_requests] - making project_id nullable")
        cursor.execute("PRAGMA table_info(material_requests)")
        info = cursor.fetchall()
        project_id_nullable = False
        for row in info:
            if row[1] == "project_id" and row[3] == 0:  # row[3] is notnull constraint (0 means nullable)
                project_id_nullable = True
                break
        
        if not project_id_nullable:
            # We need to recreate the table with nullable project_id
            cursor.execute("PRAGMA foreign_keys=OFF")
            cursor.execute("ALTER TABLE material_requests RENAME TO old_material_requests")
            cursor.execute("""
            CREATE TABLE material_requests (
                id VARCHAR(36) PRIMARY KEY,
                project_id VARCHAR(36),
                inventory_id VARCHAR(36) NOT NULL,
                requested_by VARCHAR(36),
                quantity FLOAT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                approved_by VARCHAR(36),
                notes TEXT,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                is_deleted BOOLEAN NOT NULL DEFAULT 0,
                deleted_at DATETIME,
                deleted_by VARCHAR(36),
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY(inventory_id) REFERENCES inventory(id) ON DELETE RESTRICT,
                FOREIGN KEY(requested_by) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL
            )
            """)
            # Copy data over
            cursor.execute("""
            INSERT INTO material_requests (
                id, project_id, inventory_id, requested_by, quantity, status,
                approved_by, notes, created_at, updated_at, is_deleted, deleted_at, deleted_by
            )
            SELECT 
                id, project_id, inventory_id, requested_by, quantity, status,
                approved_by, notes, created_at, updated_at, is_deleted, deleted_at, deleted_by
            FROM old_material_requests
            """)
            cursor.execute("DROP TABLE old_material_requests")
            cursor.execute("PRAGMA foreign_keys=ON")
            print("  [+] Modified material_requests to make project_id nullable successfully.")
        else:
            print("  [=] project_id in material_requests is already nullable.")

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
