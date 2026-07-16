"""
Database Rollback Script - Inventory Edit System
Restores the database to the state before the inventory edit system migration.
"""
import os
import shutil
import glob

DB_PATH = "backend/erp.db" if os.path.exists("backend/erp.db") else "erp.db"
BACKUP_DIR = "backend/backups" if os.path.exists("backend") else "./backups"

def rollback():
    print("=== STARTING DATABASE ROLLBACK ===")
    
    # Find all backup files starting with erp_backup_inv_edit_
    pattern = os.path.join(BACKUP_DIR, "erp_backup_inv_edit_*.db")
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
