import os
import sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base
import models
from ai_orchestration.orchestrator import AIOrchestrator
from ai_orchestration.session_memory import session_history, session_entities
from ai_orchestration.memory_cache import system_cache
from config import settings

TEST_DB_FILE = "./test_pipeline.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def test_context_tracking_pipeline(monkeypatch):
    db = TestingSessionLocal()
    try:
        # Mock API configurations to run locally
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
        monkeypatch.setattr(settings, "OLLAMA_URL", "")
        monkeypatch.setattr(settings, "LANGFLOW_API_URL", "")
        monkeypatch.setattr(settings, "LANGFLOW_FLOW_ID", "")
        monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "")
        
        # Clear cache memory
        system_cache.clear()

        # Seed Database
        item = models.InventoryItem(
            name="HDHMR Plywood",
            sku="MAT-HDHMR-1",
            barcode="999001",
            quantity=2.0,
            unit="Sheets",
            unit_cost=350.0,
            minimum_stock_level=5.0
        )
        db.add(item)
        db.commit()

        # Initialize Orchestrator
        orchestrator = AIOrchestrator(db, user_role="admin", user_name="Pipeline Operator")
        session_id = orchestrator.session_id

        # First query: Mention material explicitly
        res1 = orchestrator.execute("Show HDHMR Plywood stock levels")
        
        assert res1["status"] == "success"
        assert "HDHMR Plywood" in res1["response"]
        
        # Verify entity cache memory
        material_cached = session_entities.find_entity_value(session_id, "material")
        assert material_cached == "HDHMR Plywood"
        
        # Second query: Follow up, no explicit material mentioned
        res2 = orchestrator.execute("Show consumption")
        
        # Enriched message must have resolved to HDHMR Plywood
        assert res2["status"] == "success"
        # The local resolver for inventory lists inventory status. Since "Show consumption" is classified as inventory
        # and enriched, it should still query HDHMR Plywood successfully.
        assert "HDHMR Plywood" in res2["response"]

        # Verify chat history cache contains both sets of messages
        history = session_history.get_history(session_id)
        assert len(history) == 4 # 2 turns (user, ai) * 2 = 4 messages
        assert history[0]["text"] == "Show HDHMR Plywood stock levels"
        assert history[2]["text"] == "Show consumption"

    finally:
        db.close()

def test_action_pipeline(monkeypatch):
    db = TestingSessionLocal()
    try:
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
        monkeypatch.setattr(settings, "OLLAMA_URL", "")
        monkeypatch.setattr(settings, "LANGFLOW_API_URL", "")
        monkeypatch.setattr(settings, "LANGFLOW_FLOW_ID", "")
        monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "")
        
        system_cache.clear()

        # Seed records
        test_user = models.User(
            email="pipeline_action@allure.com",
            password_hash="mock",
            role="admin",
            full_name="Pipeline Admin",
            status="active"
        )
        supplier = models.Supplier(
            name="Beta Supplier",
            contact_person="Beta Agent",
            email="beta@supplier.com",
            phone="999888"
        )
        item = models.InventoryItem(
            name="Pipeline Plywood",
            sku="MAT-PIP-1",
            barcode="666001",
            quantity=10.0,
            unit="Sheets",
            unit_cost=150.0,
            minimum_stock_level=5.0
        )
        db.add_all([test_user, supplier, item])
        db.commit()

        orchestrator = AIOrchestrator(db, user_role="admin", user_name="Pipeline Admin")

        # Turn 1: Create draft purchase order
        res1 = orchestrator.execute("create draft purchase order for 20 units")
        assert res1["status"] == "success"
        assert "Generated draft Purchase Order" in res1["response"]
        
        # Turn 2: Approve the draft PO
        res2 = orchestrator.execute("approve draft PO")
        assert res2["status"] == "success"
        assert "successfully approved and executed" in res2["response"]

        # Verify PO status in db
        po = db.query(models.PurchaseOrder).first()
        assert po is not None
        assert po.status == "approved"
        assert po.quantity == 20.0
        
    finally:
        db.close()
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass
