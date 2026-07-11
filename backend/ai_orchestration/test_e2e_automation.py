import os
import sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base
import models
from config import settings
from ai_orchestration.orchestrator import AIOrchestrator
from ai_orchestration.action_engine import AIActionEngine
from ai_orchestration.memory_cache import system_cache

TEST_DB_FILE = "./test_e2e_automation.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

# Setup testing db isolation
SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def test_e2e_automation_cycle(monkeypatch):
    db = TestingSessionLocal()
    try:
        # Mock environment credentials
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
        monkeypatch.setattr(settings, "OLLAMA_URL", "")
        monkeypatch.setattr(settings, "LANGFLOW_API_URL", "")
        monkeypatch.setattr(settings, "LANGFLOW_FLOW_ID", "")
        monkeypatch.setattr(settings, "LANGFLOW_MODE", "emulator")
        
        # Clear system state
        system_cache.clear()

        # 1. Seed Database Records (User, Supplier, Inventory Item, Project)
        user = models.User(
            email="e2e_admin@allure.com",
            password_hash="pwd",
            role="admin",
            full_name="E2E Operations Director",
            status="active"
        )
        supplier = models.Supplier(
            name="E2E Timber Ltd",
            contact_person="Sales Agent",
            email="timber@supplier.com",
            phone="111222"
        )
        item = models.InventoryItem(
            name="E2E Mahogany Board",
            sku="MAT-E2E-1",
            barcode="888001",
            quantity=2.0,            # Trigger low stock level
            unit="Sheets",
            unit_cost=300.0,
            minimum_stock_level=5.0  # Min safety stock is 5
        )
        db.add_all([user, supplier, item])
        db.commit()

        # 2. Start AI Orchestrator
        orchestrator = AIOrchestrator(db, user_role="admin", user_name="E2E Operations Director")

        # Step A: Inventory Alert & Planning Routing
        # Send a user request checking inventory levels.
        # Enriched context should identify the low stock item.
        res1 = orchestrator.execute("Check mahogany stock levels")
        assert res1["status"] == "success"
        assert "E2E Mahogany Board" in res1["response"]
        
        # Step B: Action Engine Draft Creation
        # Request the AI to generate a draft purchase order for the low stock board
        res2 = orchestrator.execute("Create draft purchase order for 15 mahogany sheets")
        assert res2["status"] == "success"
        assert "Generated draft Purchase Order" in res2["response"]

        # Verify draft PO created in db with pending status
        draft_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.status == "pending").first()
        assert draft_po is not None
        assert draft_po.quantity == 15.0
        assert draft_po.total_cost == 4500.0

        # Step C: n8n Coordinator & SMTP Notification Dispatch on Draft Approval
        # Confirm and execute the draft purchase order
        res3 = orchestrator.execute(f"Approve draft PO for {draft_po.id}")
        assert res3["status"] == "success"
        assert "successfully approved and executed" in res3["response"]

        # Step D: Verify Database Audit Logs Ledger committing changes
        audit = db.query(models.AuditLog).filter(models.AuditLog.action == "EXECUTE_PO_DRAFT").first()
        assert audit is not None
        assert "E2E Timber Ltd" in audit.details or "PO-" in audit.details

        # Verify PO is now approved and quantity was processed
        final_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == draft_po.id).first()
        assert final_po.status == "approved"

    finally:
        db.close()
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass
