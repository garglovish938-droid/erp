import sqlite3
import os

DB_PATH = "./erp.db"

def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [row[1] for row in cursor.fetchall()]
    return column in cols

def add_column_if_missing(cursor, table, column, col_type, default=None):
    if not column_exists(cursor, table, column):
        if default is not None:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type} DEFAULT {default}")
        else:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        print(f"  [+] Added column: {table}.{column} ({col_type})")
    else:
        print(f"  [=] Exists: {table}.{column}")

def main():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file not found at {DB_PATH}")
        return
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("\n=== RUNNING AUDIT & APPROVAL DB MIGRATION ===\n")
    
    # Update projects table
    print("[projects]")
    add_column_if_missing(cursor, "projects", "version_id", "INTEGER", "1")
    
    # Update project_daily_logs table
    print("\n[project_daily_logs]")
    add_column_if_missing(cursor, "project_daily_logs", "approval_status", "VARCHAR(20)", "'pending'")
    add_column_if_missing(cursor, "project_daily_logs", "supervisor_comment", "TEXT")
    add_column_if_missing(cursor, "project_daily_logs", "approved_by", "VARCHAR(36)")
    add_column_if_missing(cursor, "project_daily_logs", "approved_at", "DATETIME")
    add_column_if_missing(cursor, "project_daily_logs", "version_id", "INTEGER", "1")
    
    # Create audit_logs table
    print("\n[audit_logs]")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        project_id VARCHAR(36),
        action VARCHAR(100) NOT NULL,
        details TEXT,
        old_value TEXT,
        new_value TEXT,
        ip_address VARCHAR(50),
        device VARCHAR(255),
        browser TEXT,
        device_time VARCHAR(50),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)
    print("  [+] Verified / Created table: audit_logs")
    
    conn.commit()
    conn.close()
    print("\n=== MIGRATION COMPLETE ===\n")

if __name__ == "__main__":
    main()
