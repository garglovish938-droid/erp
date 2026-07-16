"""
Database Migration Script - Inventory Receiving Module
Adds vehicle_number, batch_number, barcode, and receiving_date to stock_transactions table.
"""
import os
import shutil
import sqlite3
from datetime import datetime

# Resolve DB paths
DB_PATH = "backend/erp.db" if os.path.exists("backend/erp.db") else "erp.db"
BACKUP_DIR = "backend/backups" if os.path.exists("backend") else "./backups"

def backup_database():
    if not os.path.exists(DB_PATH):
        print(f"[-] Database file not found at {DB_PATH}, skipping backup.")
        return False
        
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(BACKUP_DIR, f"erp_backup_receiving_{timestamp}.db")
    
    try:
        shutil.copy2(DB_PATH, backup_path)
        print(f"[+] Automatic backup successfully created: {backup_path}")
        return True
    except Exception as e:
        print(f"[-] Critical Error: Failed to create database backup: {e}")
        raise e

def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [row[1] for row in cursor.fetchall()]
    return column in cols

def add_column_if_missing(cursor, table, column, col_type):
    if not column_exists(cursor, table, column):
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        print(f"  [+] Added column: {table}.{column} ({col_type})")
    else:
        print(f"  [=] Column already exists: {table}.{column}")

def migrate():
    # Step 1: Automatic Backup
    print("=== STARTING DATABASE BACKUP ===")
    backup_database()
    
    # Step 2: Schema Migration
    print("\n=== RUNNING SCHEMA MIGRATION ===")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("[stock_transactions]")
        add_column_if_missing(cursor, "stock_transactions", "vehicle_number", "TEXT")
        add_column_if_missing(cursor, "stock_transactions", "batch_number", "TEXT")
        add_column_if_missing(cursor, "stock_transactions", "barcode", "TEXT")
        add_column_if_missing(cursor, "stock_transactions", "receiving_date", "DATE")
        conn.commit()
        print("\n=== MIGRATION COMPLETE ===")
    except Exception as e:
        conn.rollback()
        print(f"[-] Migration failed: {e}")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
