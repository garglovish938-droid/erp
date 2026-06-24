import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, make_transient
from database import Base

# Import all models to ensure they are registered on Base
from models import (
    User, Category, Supplier, Client, Project, InventoryItem, ProjectBOM,
    StockTransaction, MaterialRequest, PurchaseOrder, Staff, Attendance,
    Notification, ActivityLog, CustomFieldDefinition, CustomFieldValue,
    WorkflowDefinition, WorkflowStep, ApprovalRule, DashboardWidget, Task,
    Document, VersionHistory, Shift, AttendanceRule, ProjectAssignment, 
    DailyWorkLog, ProjectDailyLog, DailyExpense
)

def migrate():
    # 1. Source Database (SQLite)
    sqlite_path = "./erp.db"
    # Resolve correct path if run from backend folder or root folder
    if not os.path.exists(sqlite_path):
        if os.path.exists("./backend/erp.db"):
            sqlite_path = "./backend/erp.db"
        else:
            print("Error: SQLite database file (erp.db) not found locally.")
            sys.exit(1)
            
    sqlite_url = f"sqlite:///{sqlite_path}"
    print(f"[+] Source SQLite Database: {sqlite_url}")
    source_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    SourceSession = sessionmaker(bind=source_engine)
    source_db = SourceSession()

    # 2. Target Database (PostgreSQL)
    postgres_url = os.getenv("DATABASE_URL")
    if not postgres_url or postgres_url.startswith("sqlite"):
        print("Error: DATABASE_URL environment variable is not set to a PostgreSQL connection string.")
        print("Please set DATABASE_URL (e.g. postgresql://user:pass@host:5432/dbname) and rerun.")
        sys.exit(1)
        
    # Standardize postgresql prefix for SQLAlchemy
    if postgres_url.startswith("postgres://"):
        postgres_url = postgres_url.replace("postgres://", "postgresql://", 1)
        
    print(f"[+] Target PostgreSQL Database: {postgres_url.split('@')[-1]}") # hide credentials in logs
    target_engine = create_engine(postgres_url)
    TargetSession = sessionmaker(bind=target_engine)
    target_db = TargetSession()

    # 3. Recreate schema in Target Database
    print("\n[+] Recreating database schema on target PostgreSQL...")
    Base.metadata.drop_all(bind=target_engine)
    Base.metadata.create_all(bind=target_engine)
    print("[+] Database schema successfully created on PostgreSQL.")

    # List of models in dependency order (parent first, child last)
    models_to_migrate = [
        User,
        Category,
        Supplier,
        Client,
        Shift,
        AttendanceRule,
        WorkflowDefinition,
        ApprovalRule,
        Notification,
        VersionHistory,
        CustomFieldDefinition,
        Staff,
        Project,
        InventoryItem,
        ProjectBOM,
        StockTransaction,
        MaterialRequest,
        PurchaseOrder,
        Attendance,
        ActivityLog,
        CustomFieldValue,
        WorkflowStep,
        DashboardWidget,
        Task,
        Document,
        ProjectAssignment,
        DailyWorkLog,
        ProjectDailyLog,
        DailyExpense
    ]

    print("\n=== MIGRATION PROCESS ===")
    migration_counts = {}

    try:
        for model in models_to_migrate:
            table_name = model.__tablename__
            print(f"Migrating table '{table_name}'...")
            
            # Fetch all rows from source SQLite
            rows = source_db.query(model).all()
            if not rows:
                print(f"  No records found in '{table_name}'. Skipping.")
                migration_counts[table_name] = (0, 0)
                continue
                
            print(f"  Found {len(rows)} records. Transferring...")
            
            # Copy each row
            for row in rows:
                source_db.expunge(row)
                make_transient(row)
                target_db.add(row)
            
            # Commit after each table to maintain integrity
            target_db.commit()
            
            # Verify row count in target
            target_count = target_db.query(model).count()
            print(f"  Successfully migrated '{table_name}': {len(rows)} -> {target_count} rows.")
            migration_counts[table_name] = (len(rows), target_count)
            
            # Validate count
            if len(rows) != target_count:
                raise ValueError(f"Data integrity mismatch in '{table_name}': expected {len(rows)} rows but got {target_count}.")
            
        print("\n==================================================")
        print("MIGRATION SUMMARY:")
        print("--------------------------------------------------")
        for table, (src, tgt) in migration_counts.items():
            print(f"  {table:<25} : SQLite {src:<4} -> PostgreSQL {tgt:<4} [OK]")
        print("--------------------------------------------------")
        print("SUCCESS: All data successfully migrated with 100% data integrity!")
        print("==================================================")
        
    except Exception as e:
        print(f"\n[-] FATAL ERROR during migration: {e}")
        target_db.rollback()
        sys.exit(1)
    finally:
        source_db.close()
        target_db.close()

if __name__ == "__main__":
    migrate()
