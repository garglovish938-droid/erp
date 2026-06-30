"""
Additive Database Migration Script
Adds status, approved_by, and approved_at columns to project_material_history table.
"""
import sqlite3
import os

def get_db_path():
    if os.path.exists("backend/erp.db"):
        return "backend/erp.db"
    elif os.path.exists("./erp.db"):
        return "./erp.db"
    else:
        return "../backend/erp.db"

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
    db_path = get_db_path()
    print(f"Connecting to database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("\n=== APPLYING TRANSFER APPROVAL MIGRATION ===\n")

    # 1. Add status column to project_material_history
    add_column_if_missing(cursor, "project_material_history", "status", "TEXT", default="'approved'")
    
    # 2. Add approved_by column to project_material_history
    add_column_if_missing(cursor, "project_material_history", "approved_by", "TEXT")
    
    # 3. Add approved_at column to project_material_history
    add_column_if_missing(cursor, "project_material_history", "approved_at", "DATETIME")

    conn.commit()
    conn.close()
    print("\n=== MIGRATION COMPLETE ===\n")

if __name__ == "__main__":
    main()
