"""
Database Migration Script - Adds missing columns to existing erp.db
Run this ONCE to migrate the database to the current schema.
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

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("\n=== DATABASE MIGRATION ===\n")

# ─── users table ───────────────────────────────────────────────────────────────
print("[users]")
add_column_if_missing(cursor, "users", "employee_code",  "TEXT")
add_column_if_missing(cursor, "users", "department",     "TEXT")
add_column_if_missing(cursor, "users", "status",         "TEXT",  "'active'")
add_column_if_missing(cursor, "users", "permissions",    "TEXT")
add_column_if_missing(cursor, "users", "otp_code",       "TEXT")
add_column_if_missing(cursor, "users", "otp_expires_at", "DATETIME")
add_column_if_missing(cursor, "users", "refresh_token",  "TEXT")
add_column_if_missing(cursor, "users", "is_deleted",     "INTEGER", "0")
add_column_if_missing(cursor, "users", "deleted_at",     "DATETIME")
add_column_if_missing(cursor, "users", "deleted_by",     "TEXT")

# ─── inventory table ───────────────────────────────────────────────────────────
print("\n[inventory]")
add_column_if_missing(cursor, "inventory", "category_id",      "TEXT")
add_column_if_missing(cursor, "inventory", "brand",            "TEXT")
add_column_if_missing(cursor, "inventory", "size_variant",     "TEXT")
add_column_if_missing(cursor, "inventory", "description",      "TEXT")
add_column_if_missing(cursor, "inventory", "location",         "TEXT")
add_column_if_missing(cursor, "inventory", "reorder_point",    "INTEGER", "10")
add_column_if_missing(cursor, "inventory", "max_stock",        "INTEGER", "1000")
add_column_if_missing(cursor, "inventory", "is_deleted",       "INTEGER", "0")
add_column_if_missing(cursor, "inventory", "deleted_at",       "DATETIME")
add_column_if_missing(cursor, "inventory", "deleted_by",       "TEXT")
add_column_if_missing(cursor, "inventory", "last_updated",     "DATETIME")

# ─── staff table ───────────────────────────────────────────────────────────────
print("\n[staff]")
add_column_if_missing(cursor, "staff", "user_id",          "TEXT")
add_column_if_missing(cursor, "staff", "category",         "TEXT")
add_column_if_missing(cursor, "staff", "department",       "TEXT")
add_column_if_missing(cursor, "staff", "status",           "TEXT",  "'active'")
add_column_if_missing(cursor, "staff", "is_deleted",       "INTEGER", "0")
add_column_if_missing(cursor, "staff", "deleted_at",       "DATETIME")
add_column_if_missing(cursor, "staff", "deleted_by",       "TEXT")

# ─── projects table ────────────────────────────────────────────────────────────
print("\n[projects]")
add_column_if_missing(cursor, "projects", "is_deleted",    "INTEGER", "0")
add_column_if_missing(cursor, "projects", "deleted_at",    "DATETIME")
add_column_if_missing(cursor, "projects", "deleted_by",    "TEXT")
add_column_if_missing(cursor, "projects", "updated_at",    "DATETIME")

# ─── clients table ─────────────────────────────────────────────────────────────
print("\n[clients]")
add_column_if_missing(cursor, "clients", "is_deleted",     "INTEGER", "0")
add_column_if_missing(cursor, "clients", "deleted_at",     "DATETIME")
add_column_if_missing(cursor, "clients", "deleted_by",     "TEXT")

# ─── suppliers table ───────────────────────────────────────────────────────────
print("\n[suppliers]")
add_column_if_missing(cursor, "suppliers", "is_deleted",   "INTEGER", "0")
add_column_if_missing(cursor, "suppliers", "deleted_at",   "DATETIME")
add_column_if_missing(cursor, "suppliers", "deleted_by",   "TEXT")

# ─── attendance table ──────────────────────────────────────────────────────────
print("\n[attendance]")
add_column_if_missing(cursor, "attendance", "device",          "TEXT")
add_column_if_missing(cursor, "attendance", "ip_address",      "TEXT")
add_column_if_missing(cursor, "attendance", "overtime_hours",  "REAL", "0.0")
add_column_if_missing(cursor, "attendance", "late_arrival",    "INTEGER", "0")
add_column_if_missing(cursor, "attendance", "early_departure", "INTEGER", "0")
add_column_if_missing(cursor, "attendance", "total_hours",     "REAL", "0.0")

# ─── material_requests table ────────────────────────────────────────────────────
print("\n[material_requests]")
add_column_if_missing(cursor, "material_requests", "approved_by",    "TEXT")
add_column_if_missing(cursor, "material_requests", "approved_at",    "DATETIME")
add_column_if_missing(cursor, "material_requests", "notes",          "TEXT")
add_column_if_missing(cursor, "material_requests", "is_deleted",     "INTEGER", "0")
add_column_if_missing(cursor, "material_requests", "deleted_at",     "DATETIME")
add_column_if_missing(cursor, "material_requests", "deleted_by",     "TEXT")

# ─── Try to create project_assignments if missing ──────────────────────────────
print("\n[project_assignments]")
cursor.execute("""
    CREATE TABLE IF NOT EXISTS project_assignments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, user_id)
    )
""")
print("  [+] Ensured project_assignments table exists")

# ─── Create notifications table if missing ─────────────────────────────────────
print("\n[notifications]")
cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
""")
print("  [+] Ensured notifications table exists")

# ─── Create login_history if missing ───────────────────────────────────────────
print("\n[login_history]")
cursor.execute("""
    CREATE TABLE IF NOT EXISTS login_history (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        email TEXT,
        login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        success INTEGER DEFAULT 1
    )
""")
print("  [+] Ensured login_history table exists")

conn.commit()
conn.close()

print("\n=== MIGRATION COMPLETE ===\n")
print("All missing columns and tables have been added.")
print("You can now restart the backend safely.\n")
