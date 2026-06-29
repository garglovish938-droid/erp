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
    
    print("\n=== RUNNING MIGRATION FOR AUDIT LOG ARRAYS ===\n")
    
    print("[audit_logs]")
    add_column_if_missing(cursor, "audit_logs", "images", "TEXT")
    add_column_if_missing(cursor, "audit_logs", "documents", "TEXT")
    
    conn.commit()
    conn.close()
    print("\n=== MIGRATION COMPLETE ===\n")

if __name__ == "__main__":
    main()
