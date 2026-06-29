"""
Database Migration Script - Material Consumption Tracking
This script automatically backs up erp.db and adds consumption columns to project_bom and project_daily_logs.
"""
import os
import shutil
import sqlite3
from datetime import datetime

DB_PATH = "./erp.db"
BACKUP_DIR = "./backups"

def backup_database():
    if not os.path.exists(DB_PATH):
        print(f"[-] Database file not found at {DB_PATH}, skipping backup.")
        return False
        
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(BACKUP_DIR, f"erp_backup_consumption_{timestamp}.db")
    
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
        print(f"  [~] Column already exists: {table}.{column}")

def main():
    print("=== STARTING MATERIAL CONSUMPTION MIGRATION ===")
    
    # 1. Backup
    backup_database()
    
    # 2. Add columns
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Add consumed_quantity to project_bom
        print("[*] Updating project_bom table...")
        add_column_if_missing(cursor, "project_bom", "consumed_quantity", "FLOAT DEFAULT 0.0")
        
        # Add inventory_id and quantity_used to project_daily_logs
        print("[*] Updating project_daily_logs table...")
        add_column_if_missing(cursor, "project_daily_logs", "inventory_id", "VARCHAR(36) NULL")
        add_column_if_missing(cursor, "project_daily_logs", "quantity_used", "FLOAT DEFAULT 0.0")
        
        conn.commit()
        print("[+] Migration completed successfully!")
    except Exception as e:
        conn.rollback()
        print(f"[-] Migration failed, changes rolled back: {e}")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    main()
