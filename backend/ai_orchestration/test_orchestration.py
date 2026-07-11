import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set database env before imports
os.environ["DATABASE_URL"] = "sqlite:///test_orchestration.db"
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, get_db
from main import app
import models, auth
from ai_orchestration.orchestrator import classify_intent, AIOrchestrator

TEST_DB_FILE = "./test_orchestration.db"
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

def setup_module(module):
    db = TestingSessionLocal()
    try:
        passwords = {
            "admin": auth.get_password_hash("admin123"),
            "worker": auth.get_password_hash("worker123")
        }
        admin_user = db.query(models.User).filter(models.User.email == "admin_orch@allure.com").first()
        if not admin_user:
            admin_user = models.User(
                email="admin_orch@allure.com",
                password_hash=passwords["admin"],
                role="admin",
                full_name="Orch Admin",
                status="active"
            )
            db.add(admin_user)
            
        worker_user = db.query(models.User).filter(models.User.email == "worker_orch@allure.com").first()
        if not worker_user:
            worker_user = models.User(
                email="worker_orch@allure.com",
                password_hash=passwords["worker"],
                role="worker",
                full_name="Orch Worker",
                status="active"
            )
            db.add(worker_user)
        db.commit()
    finally:
        db.close()

def get_token(email, password):
    resp = client.post("/api/auth/login", json={"username": email, "password": password})
    return resp.json()["access_token"]

def test_intent_classification():
    assert classify_intent("how much stock is left") == "flow_1_inventory"
    assert classify_intent("project delay analysis") == "flow_2_project"
    assert classify_intent("add a daily expense of 500") == "flow_3_expense"
    assert classify_intent("what is my wallet burn rate") == "flow_4_wallet"
    assert classify_intent("show capital cash book balance") == "flow_5_cashbook"
    assert classify_intent("pending payments from clients") == "flow_6_receipt"
    assert classify_intent("employee attendance logs") == "flow_7_employee"
    assert classify_intent("generate monthly reports in pdf") == "flow_8_reporting"
    assert classify_intent("send whatsapp notification alert") == "flow_9_notification"
    assert classify_intent("ocr scan invoice copy") == "flow_10_ocr"
    assert classify_intent("how do you work dify knowledge base") == "flow_11_chatbot"
    assert classify_intent("github repository commits check") == "flow_12_github"
    assert classify_intent("monitor memory and database health") == "flow_13_monitor_prod"
    assert classify_intent("security monitor failed login attempts") == "flow_14_monitor_sec"
    assert classify_intent("audit logs rollback advice") == "flow_15_audit"

def test_orchestrate_rbac_restrictions():
    worker_token = get_token("worker_orch@allure.com", "worker123")
    headers = {"Authorization": f"Bearer {worker_token}"}
    
    # Wallet flow is admin/manager/accountant only, worker is unauthorized
    payload = {"message": "check wallet balance"}
    resp = client.post("/api/ai/orchestrate", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "unauthorized"
    assert "Access Denied" in resp.json()["response"]

def test_orchestrate_all_flows_fallback():
    admin_token = get_token("admin_orch@allure.com", "admin123")
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 1. Inventory Flow fallback
    resp = client.post("/api/ai/orchestrate", json={"message": "inventory items check"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["flow_id"] == "flow_1_inventory"
    assert "Inventory Assistant" in resp.json()["response"]
    
    # 2. Wallet Flow fallback (Admin is allowed)
    resp = client.post("/api/ai/orchestrate", json={"message": "wallet balances"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["flow_id"] == "flow_4_wallet"
    assert "Wallet Assistant" in resp.json()["response"]
    
    # 3. Production Monitor fallback
    resp = client.post("/api/ai/orchestrate", json={"message": "monitor cpu metrics"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["flow_id"] == "flow_13_monitor_prod"
    assert "Production Monitor" in resp.json()["response"]

def test_ai_chat_langflow_mock(monkeypatch):
    from config import settings
    orig_url = settings.LANGFLOW_API_URL
    orig_id = settings.LANGFLOW_FLOW_ID
    orig_mode = settings.LANGFLOW_MODE
    
    settings.LANGFLOW_API_URL = "http://localhost:7860/api/v1/run"
    settings.LANGFLOW_FLOW_ID = "mock-flow-id"
    settings.LANGFLOW_MODE = "production"
    
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
                                        "text": "Hello from mock Langflow Orchestration!"
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
            
    monkeypatch.setattr("requests.post", lambda *args, **kwargs: MockResponse())
    
    token = get_token("admin_orch@allure.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {"message": "hello dify orchestrator"}
    resp = client.post("/api/ai/orchestrate", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["response"] == "Hello from mock Langflow Orchestration!"
    assert resp.json()["engine"] == "Langflow Gateway"
    
    settings.LANGFLOW_API_URL = orig_url
    settings.LANGFLOW_FLOW_ID = orig_id
    settings.LANGFLOW_MODE = orig_mode

def teardown_module(module):
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass
