import os
import sys
import pytest
from datetime import date, datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base
import models
from ai_orchestration.action_engine import AIActionEngine
from ai_orchestration.orchestrator import AIOrchestrator
from ai_orchestration.memory_cache import system_cache

TEST_DB_FILE = "./test_action_engine.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def test_action_engine_operations():
    db = TestingSessionLocal()
    try:
        # Clear cache
        system_cache.clear()

        # 1. Seed database records
        test_user = models.User(
            email="action_test@allure.com",
            password_hash="mock-hash",
            role="admin",
            full_name="Action Admin",
            status="active"
        )
        test_worker = models.User(
            email="action_worker@allure.com",
            password_hash="mock-hash",
            role="worker",
            full_name="Action Worker",
            status="active"
        )
        supplier = models.Supplier(
            name="Alpha Supplier",
            contact_person="Alpha Agent",
            email="alpha@supplier.com",
            phone="123456"
        )
        item = models.InventoryItem(
            name="Action Plywood",
            sku="MAT-ACT-1",
            barcode="777001",
            quantity=10.0,
            unit="Sheets",
            unit_cost=200.0,
            minimum_stock_level=5.0
        )
        project = models.Project(
            name="Action Project",
            status="active",
            completion_percentage=0
        )
        staff = models.Staff(
            name="Staff Assigned",
            role="Installer",
            department="Production",
            status="active"
        )
        
        db.add_all([test_user, test_worker, supplier, item, project, staff])
        db.commit()

        # 2. Initialize Action Engine
        engine_admin = AIActionEngine(db, user_role="admin", user_id=test_user.id)
        engine_worker = AIActionEngine(db, user_role="worker", user_id=test_worker.id)

        # 3. Test Purchase Order Draft Creation & Permissions
        po_res = engine_admin.create_purchase_order_draft(
            supplier_id=supplier.id,
            inventory_id=item.id,
            quantity=15.0,
            unit_cost=200.0
        )
        assert po_res["status"] == "success"
        assert po_res["approval_required"] is True
        assert po_res["data"]["status"] == "pending"
        po_id = po_res["data"]["po_id"]

        # Worker role must be denied from creating purchase order drafts
        po_denied = engine_worker.create_purchase_order_draft(
            supplier_id=supplier.id,
            inventory_id=item.id,
            quantity=15.0,
            unit_cost=200.0
        )
        assert po_denied["status"] == "error"
        assert "Permission Denied" in po_denied["message"]

        # 4. Test Approval Flow Execution
        execute_res = engine_admin.confirm_and_execute_draft("CREATE_PO_DRAFT", po_id)
        assert execute_res["status"] == "success"
        assert execute_res["final_status"] == "approved"
        
        # Verify status in db
        po_db = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
        assert po_db.status == "approved"
        
        # Verify Audit Log
        audit = db.query(models.AuditLog).filter(models.AuditLog.action == "EXECUTE_PO_DRAFT").first()
        assert audit is not None
        assert po_db.po_number in audit.details

        # 5. Test Tasks Assignment & Reminders
        task_res = engine_admin.assign_project_task(
            title="Design layout review",
            description="Perform structural check",
            assigned_to_staff_id=staff.id
        )
        assert task_res["status"] == "success"
        assert task_res["action"] == "ASSIGN_TASK"
        
        task_db = db.query(models.Task).filter(models.Task.title == "Design layout review").first()
        assert task_db is not None
        assert task_db.assigned_to == staff.id

        reminder_res = engine_worker.create_reminder(
            title="Daily log follow up",
            description="Complete workforce daily logs"
        )
        assert reminder_res["status"] == "success"
        
        reminder_db = db.query(models.Notification).filter(models.Notification.title == "Daily log follow up").first()
        assert reminder_db is not None
        assert reminder_db.type == "reminder"

    finally:
        db.close()
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass
