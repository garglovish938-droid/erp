import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, make_transient
from database import Base
from config import settings

# Import all models to ensure they are registered on Base
from models import (
    User, Category, Supplier, Client, Project, InventoryItem, ProjectBOM,
    StockTransaction, MaterialRequest, PurchaseOrder, Staff, Attendance,
    Notification, ActivityLog, CustomFieldDefinition, CustomFieldValue,
    WorkflowDefinition, WorkflowStep, ApprovalRule, DashboardWidget, Task,
    Document, VersionHistory
)

def migrate():
    # 1. Source Database (SQLite)
    sqlite_url = "sqlite:///./erp.db"
    if not os.path.exists("./erp.db"):
        print("Error: Local SQLite database file (./erp.db) not found.")
        sys.exit(1)
        
    print(f"Source database: {sqlite_url}")
    source_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    SourceSession = sessionmaker(bind=source_engine)
    source_db = SourceSession()

    # 2. Target Database (PostgreSQL)
    # Get PostgreSQL URL from environment or settings
    postgres_url = os.getenv("DATABASE_URL")
    if not postgres_url or postgres_url.startswith("sqlite"):
        print("Error: DATABASE_URL environment variable is not set to a PostgreSQL connection string.")
        print("Please set DATABASE_URL (e.g. postgresql://user:pass@host:5432/dbname) and rerun.")
        sys.exit(1)
        
    print(f"Target database: {postgres_url}")
    target_engine = create_engine(postgres_url)
    TargetSession = sessionmaker(bind=target_engine)
    target_db = TargetSession()

    # 3. Recreate schema in Target Database
    print("Recreating database schema on PostgreSQL target...")
    Base.metadata.drop_all(bind=target_engine)
    Base.metadata.create_all(bind=target_engine)
    print("Database schema successfully created on PostgreSQL.")

    # List of models in order of dependency (parent tables first, child tables last)
    models_to_migrate = [
        User,
        Category,
        Supplier,
        Client,
        Staff,
        Project,
        InventoryItem,
        ProjectBOM,
        StockTransaction,
        MaterialRequest,
        PurchaseOrder,
        Attendance,
        Notification,
        ActivityLog,
        CustomFieldDefinition,
        CustomFieldValue,
        WorkflowDefinition,
        WorkflowStep,
        ApprovalRule,
        DashboardWidget,
        Task,
        Document,
        VersionHistory
    ]

    try:
        for model in models_to_migrate:
            table_name = model.__tablename__
            print(f"Migrating table '{table_name}'...")
            
            # Fetch all rows from source SQLite
            rows = source_db.query(model).all()
            if not rows:
                print(f"  No records found in '{table_name}'. Skipping.")
                continue
                
            print(f"  Found {len(rows)} records. Transferring...")
            
            # Copy each row
            for row in rows:
                source_db.expunge(row)
                make_transient(row)
                target_db.add(row)
            
            # Commit after each table to maintain integrity and check for errors
            target_db.commit()
            print(f"  Successfully migrated '{table_name}'.")
            
        print("\nSUCCESS: All data successfully migrated from SQLite to PostgreSQL!")
        
    except Exception as e:
        print(f"\nFATAL ERROR during migration: {e}")
        target_db.rollback()
        sys.exit(1)
    finally:
        source_db.close()
        target_db.close()

if __name__ == "__main__":
    migrate()
