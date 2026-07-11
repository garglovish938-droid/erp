import os
import sys
import pytest
import requests
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base
import models
from ai_orchestration.orchestrator import AIOrchestrator
from ai_orchestration.session_memory import session_history, session_entities
from ai_orchestration.memory_cache import system_cache
from config import settings

TEST_DB_FILE = "./test_langflow_integration.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def test_langflow_client_routing(monkeypatch):
    db = TestingSessionLocal()
    try:
        # Mock settings to point to our active Langflow emulator
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
        monkeypatch.setattr(settings, "OLLAMA_URL", "")
        monkeypatch.setattr(settings, "LANGFLOW_API_URL", "http://127.0.0.1:7860/api/v1/run")
        monkeypatch.setattr(settings, "LANGFLOW_FLOW_ID", "flow_1_inventory")
        monkeypatch.setattr(settings, "LANGFLOW_MODE", "production")
        monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "")
        
        system_cache.clear()

        # Seed Database
        item = models.InventoryItem(
            name="Langflow Plywood",
            sku="MAT-LNG-1",
            barcode="555001",
            quantity=2.0,
            unit="Sheets",
            unit_cost=150.0,
            minimum_stock_level=5.0
        )
        db.add(item)
        db.commit()

        # Initialize Orchestrator
        orchestrator = AIOrchestrator(db, user_role="admin", user_name="Langflow Operator")
        session_id = orchestrator.session_id

        # Mock requests.post to simulate Langflow server response
        def mock_post(url, json=None, headers=None, timeout=None):
            class MockResponse:
                status_code = 200
                def json(self):
                    return {
                        "outputs": [
                            {
                                "outputs": [
                                    {
                                        "results": {
                                            "message": {
                                                "text": "As the Inventory Assistant, here is our current inventory status:\n• Active inventory items: 1\n• Low stock warnings: 1\n• Total material valuation: INR 300.00\nLow Stock Recommendations:\n- **Langflow Plywood** (SKU: MAT-LNG-1): 2.0 Sheets (Min: 5.0)"
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }
            return MockResponse()

        monkeypatch.setattr("requests.post", mock_post)

        # Verify that the HTTP REST call goes through our emulator
        res = orchestrator.execute("Show Langflow Plywood stock levels")
        
        assert res["status"] == "success"
        assert res["engine"] == "Langflow Gateway"
        assert "Langflow Plywood" in res["response"]
        assert "Low Stock Recommendations" in res["response"]

        # Confirm memory updates
        history = session_history.get_history(session_id)
        assert len(history) == 2
        assert history[0]["text"] == "Show Langflow Plywood stock levels"

    finally:
        db.close()
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass
