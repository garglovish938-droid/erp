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

TEST_DB_FILE = "./test_local_reasoning.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def test_local_reasoning_fallback(monkeypatch):
    db = TestingSessionLocal()
    try:
        # Mock settings to disable Gemini and Langflow, and enable Ollama
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
        monkeypatch.setattr(settings, "LANGFLOW_API_URL", "")
        monkeypatch.setattr(settings, "LANGFLOW_FLOW_ID", "")
        monkeypatch.setattr(settings, "OLLAMA_URL", "http://mock-ollama/api/generate")
        monkeypatch.setattr(settings, "OLLAMA_MODEL", "mock-model")

        # Mock API calls
        requests_called = {}
        def mock_post(url, json=None, headers=None, timeout=None, stream=False):
            requests_called[url] = json
            class MockResponse:
                status_code = 200
                text = "Success"
                def iter_lines(self):
                    yield b'{"message": {"content": "Local Mock Response: Operations look normal!"}}'
                def json(self):
                    return {"status": "success"}
            return MockResponse()

        monkeypatch.setattr("requests.post", mock_post)

        orchestrator = AIOrchestrator(db, user_role="admin", user_name="Test Operator")
        result = orchestrator.execute("Check inventory list")

        # Assertions
        assert result["flow_id"] == "flow_1_inventory"
        assert result["status"] == "success"
        assert result["engine"] == "Local + Offline Reasoning Engine"
        assert "Local Mock Response" in result["response"]
        
        # Verify requests were made
        assert "http://mock-ollama/api/chat" in requests_called
        payload = requests_called["http://mock-ollama/api/chat"]
        assert payload["model"] == "mock-model"
        assert "Check inventory list" in payload["messages"][1]["content"]
        
    finally:
        db.close()
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass
