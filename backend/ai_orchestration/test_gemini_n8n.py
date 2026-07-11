import os
import sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, get_db
import models
from ai_orchestration.orchestrator import AIOrchestrator
from config import settings

TEST_DB_FILE = "./test_gemini_n8n.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def test_gemini_and_n8n_integration(monkeypatch):
    db = TestingSessionLocal()
    try:
        # Mock settings
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "mock-gemini-key")
        monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "http://mock-n8n-webhook/run")
        monkeypatch.setattr(settings, "LANGFLOW_API_URL", "")
        monkeypatch.setattr(settings, "LANGFLOW_FLOW_ID", "")

        # Mock API calls
        requests_called = {}
        def mock_post(url, json=None, headers=None, timeout=None):
            requests_called[url] = json
            class MockResponse:
                status_code = 200
                text = "Success"
                def json(self):
                    # Mock Gemini Response
                    if "generativelanguage" in url:
                        return {
                            "candidates": [
                                {
                                    "content": {
                                        "parts": [
                                            {
                                                "text": "Gemini Mock Response: Everything looks perfect!"
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    return {"status": "success"}
            return MockResponse()

        monkeypatch.setattr("requests.post", mock_post)

        orchestrator = AIOrchestrator(db, user_role="admin", user_name="Test Operator")
        result = orchestrator.execute("Check inventory list")

        # Assertions
        assert result["flow_id"] == "flow_1_inventory"
        assert result["status"] == "success"
        assert result["engine"] == "Local + Gemini Reasoning Engine"
        assert result["n8n_automation"] == "triggered"
        assert "Gemini Mock Response" in result["response"]
        
        # Verify requests were made
        assert any("generativelanguage.googleapis.com" in url for url in requests_called)
        assert "http://mock-n8n-webhook/run" in requests_called
        
        n8n_payload = requests_called["http://mock-n8n-webhook/run"]
        assert n8n_payload["flow_id"] == "flow_1_inventory"
        assert n8n_payload["user_role"] == "admin"
        assert n8n_payload["user_name"] == "Test Operator"
        
    finally:
        db.close()
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass
