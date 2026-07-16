"""
Database Rollback Script - Inventory Receiving Module
Restores the database to the state before the receiving module migration.
"""
import os
import shutil
import glob

DB_PATH = "backend/erp.db" if os.path.exists("backend/erp.db") else "erp.db"
BACKUP_DIR = "backend/backups" if os.path.exists("backend") else "./backups"

def rollback():
    print("=== STARTING DATABASE ROLLBACK ===")
    
    # Find all backup files starting with erp_backup_receiving_
    pattern = os.path.join(BACKUP_DIR, "erp_backup_receiving_*.db")
    backups = sorted(glob.glob(pattern))
    
    if not backups:
        print("[-] No backup file found to rollback from.")
        return False
        
    latest_backup = backups[-1]
    print(f"[*] Found latest backup: {latest_backup}")
    
    try:
        shutil.copy2(latest_backup, DB_PATH)
        print(f"[+] Successfully rolled back database to: {latest_backup}")
        return True
    except Exception as e:
        print(f"[-] Critical Error during rollback: {e}")
        return False

if __name__ == "__main__":
    rollback()
