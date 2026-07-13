"""
Database Migration Script - Allure Living ERP Master Upgrade
Adds:
1. 'rack' column to 'inventory' table
2. 'google_id' column to 'users' table
3. 'two_factor_secret' column to 'users' table
"""
import os
import sys
from sqlalchemy import create_engine, text, inspect
from config import settings

def run_migration():
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    print(f"Connecting to database: {db_url.split('@')[-1] if '@' in db_url else db_url}")
    engine = create_engine(db_url)
    
    with engine.connect() as conn:
        inspector = inspect(engine)
        
        # 1. Update inventory table (add rack column)
        inventory_cols = [col['name'] for col in inspector.get_columns('inventory')]
        if 'rack' not in inventory_cols:
            print("Adding 'rack' column to 'inventory' table...")
            conn.execute(text("ALTER TABLE inventory ADD COLUMN rack VARCHAR(50)"))
            print("[OK] Added inventory.rack")
        else:
            print("[=] Column 'rack' already exists in 'inventory'.")

        # 2. Update users table (add google_id and two_factor_secret columns)
        users_cols = [col['name'] for col in inspector.get_columns('users')]
        if 'google_id' not in users_cols:
            print("Adding 'google_id' column to 'users' table...")
            conn.execute(text("ALTER TABLE users ADD COLUMN google_id VARCHAR(100)"))
            print("[OK] Added users.google_id")
        else:
            print("[=] Column 'google_id' already exists in 'users'.")
            
        if 'two_factor_secret' not in users_cols:
            print("Adding 'two_factor_secret' column to 'users' table...")
            conn.execute(text("ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(100)"))
            print("[OK] Added users.two_factor_secret")
        else:
            print("[=] Column 'two_factor_secret' already exists in 'users'.")
            
        # Commit transaction explicitly
        conn.commit()

if __name__ == "__main__":
    run_migration()
