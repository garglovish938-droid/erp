"""
Additive Database Migration Script
Creates project_material_history table and adds missing columns to audit_logs.
"""
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
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("\n=== APPLYING PROJECT MATERIALS MIGRATION ===\n")

    # 1. Create project_material_history table if missing
    print("[project_material_history]")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS project_material_history (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            inventory_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
            user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            username TEXT,
            action TEXT NOT NULL,
            quantity REAL NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("  [+] Ensured project_material_history table exists")

    # 2. Add columns to audit_logs table
    print("\n[audit_logs]")
    add_column_if_missing(cursor, "audit_logs", "inventory_id", "TEXT")
    add_column_if_missing(cursor, "audit_logs", "reason", "TEXT")

    conn.commit()
    conn.close()
    print("\n=== MIGRATION COMPLETE ===\n")

if __name__ == "__main__":
    main()
