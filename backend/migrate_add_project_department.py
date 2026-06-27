"""
Database Migration Script - Adds nullable department column to projects table
Works dynamically with both local SQLite and production PostgreSQL.
"""
import os
from sqlalchemy import create_engine, text
from config import settings

def run_migration():
    db_url = settings.DATABASE_URL
    # Standardize postgresql prefix for SQLAlchemy
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    print(f"Connecting to database: {db_url.split('@')[-1] if '@' in db_url else db_url}")
    engine = create_engine(db_url)
    
    # We must enable autocommit or execute outside transaction if required
    # But ALTER TABLE is safe in standard connections
    with engine.connect() as conn:
        print("Checking existing columns on 'projects' table...")
        
        # Check dialect
        is_sqlite = "sqlite" in db_url
        
        if is_sqlite:
            # PRAGMA is SQLite specific
            res = conn.execute(text("PRAGMA table_info(projects)"))
            columns = [row[1] for row in res.fetchall()]
        else:
            # Standard SQL schema info for PostgreSQL
            res = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'projects'"
            ))
            columns = [row[0] for row in res.fetchall()]
            
        print(f"Found columns: {columns}")
        
        if "department" not in columns:
            print("Adding 'department' column to 'projects' table...")
            if is_sqlite:
                conn.execute(text("ALTER TABLE projects ADD COLUMN department TEXT"))
            else:
                conn.execute(text("ALTER TABLE projects ADD COLUMN department VARCHAR(100)"))
            print("[✓] Migration succeeded: added 'department' column.")
        else:
            print("[=] Column 'department' already exists. No migration needed.")

if __name__ == "__main__":
    run_migration()
