import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, get_db
from main import app
from config import settings

TEST_DB_FILE = "./test_sprint3_endpoints.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_liveness_endpoint():
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "alive"

def test_readiness_endpoint(monkeypatch):
    from ai_orchestration import health_diagnostics
    def mock_run_diagnostics_audit(db):
        return {
            "status": "healthy",
            "database": {"status": "healthy", "details": "Active"},
            "redis_cache": {"status": "healthy", "details": "Active"},
            "workflow_graph": {"status": "healthy", "details": "Active"}
        }
    import main
    monkeypatch.setattr(main, "run_diagnostics_audit", mock_run_diagnostics_audit)
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"

def test_full_health_endpoint(monkeypatch):
    from ai_orchestration import health_diagnostics
    def mock_run_diagnostics_audit(db):
        return {
            "status": "healthy",
            "database": {"status": "healthy", "details": "Active"},
            "redis_cache": {"status": "healthy", "details": "Active"},
            "workflow_graph": {"status": "healthy", "details": "Active"}
        }
    import main
    monkeypatch.setattr(main, "run_diagnostics_audit", mock_run_diagnostics_audit)
    response = client.get("/health")
    assert response.status_code == 200
    assert "database" in response.json()
    assert "redis_cache" in response.json()

def test_unhealthy_readiness_dependency(monkeypatch):
    # Mock run_diagnostics_audit to return unhealthy database status
    from ai_orchestration import health_diagnostics
    def mock_run_diagnostics_audit(db):
        return {
            "status": "unhealthy",
            "database": {"status": "unhealthy", "details": "Connection failed"},
            "redis_cache": {"status": "healthy", "details": "Active"},
            "workflow_graph": {"status": "healthy", "details": "Active"}
        }
    import main
    monkeypatch.setattr(main, "run_diagnostics_audit", mock_run_diagnostics_audit)
    
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["status"] == "unhealthy"

    # Full health check should also return 503 when unhealthy
    full_response = client.get("/health")
    assert full_response.status_code == 503
    assert full_response.json()["status"] == "unhealthy"

def teardown_module(module):
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass
