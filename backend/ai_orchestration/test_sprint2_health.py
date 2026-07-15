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
from ai_orchestration.health_diagnostics import run_diagnostics_audit
from ai_orchestration.memory_cache import system_cache

TEST_DB_FILE = "./test_sprint2_health.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def test_system_diagnostics_audit():
    db = TestingSessionLocal()
    try:
        diagnostics = run_diagnostics_audit(db)
        assert "status" in diagnostics
        assert "database" in diagnostics
        assert "redis_cache" in diagnostics
        assert "workflow_graph" in diagnostics
        assert diagnostics["database"]["status"] == "healthy"
    finally:
        db.close()
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass

def test_orchestrator_retries_on_connection_failure(monkeypatch):
    db = TestingSessionLocal()
    try:
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
        monkeypatch.setattr(settings, "OLLAMA_URL", "")
        monkeypatch.setattr(settings, "LANGFLOW_API_URL", "http://invalid-langflow-host/api/v1/run")
        monkeypatch.setattr(settings, "LANGFLOW_FLOW_ID", "flow_1_inventory")
        monkeypatch.setattr(settings, "LANGFLOW_MODE", "production")
        
        system_cache.clear()

        # Track POST requests
        post_call_count = 0
        def mock_failed_post(url, *args, **kwargs):
            nonlocal post_call_count
            if "langflow" in url:
                post_call_count += 1
            raise ConnectionError("Host unreachable")
            
        monkeypatch.setattr("requests.post", mock_failed_post)

        orchestrator = AIOrchestrator(db, user_role="admin", user_name="Retry Operator")
        
        # Execute query. The orchestrator will try calling Langflow, fail,
        # and then fallback to local resolver.
        res = orchestrator.execute("Check stock levels")
        
        # Check that it falls back successfully to local inventory resolution
        assert res["status"] == "success"
        assert post_call_count == 1  # Confirm 1 attempt occurred (latency optimized)

    finally:
        db.close()
