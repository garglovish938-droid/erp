import os
os.environ["DATABASE_URL"] = "sqlite:///test_finance_upgrade.db"
import sys
import shutil
from datetime import datetime, date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import Base, get_db
from main import app
import models, crud, schemas, auth

TEST_DB_FILE = "./test_finance_upgrade.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
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
    # Setup test users
    db = TestingSessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.email == "admin_test@allure.com").first()
        if not admin:
            passwords = {
                "admin": auth.get_password_hash("admin123"),
                "manager": auth.get_password_hash("manager123"),
                "worker": auth.get_password_hash("worker123")
            }
            
            admin_user = models.User(
                email="admin_test@allure.com",
                password_hash=passwords["admin"],
                role="admin",
                full_name="Test Admin",
                status="active"
            )
            manager_user = models.User(
                email="manager_test@allure.com",
                password_hash=passwords["manager"],
                role="manager",
                full_name="Test Manager",
                status="active"
            )
            worker_user = models.User(
                email="worker_test@allure.com",
                password_hash=passwords["worker"],
                role="worker",
                full_name="Test Worker",
                status="active"
            )
            db.add_all([admin_user, manager_user, worker_user])
            
        wallet = db.query(models.FactoryWallet).filter(models.FactoryWallet.id == "default").first()
        if not wallet:
            wallet = models.FactoryWallet(
                id="default",
                name="Main Factory Wallet",
                opening_balance=10000.0,
                balance=10000.0,
                status="active"
            )
            db.add(wallet)
        else:
            wallet.opening_balance = 10000.0
            wallet.balance = 10000.0
            
        db.commit()
    finally:
        db.close()

def get_token(email, password):
    resp = client.post("/api/auth/login", json={"username": email, "password": password})
    return resp.json()["access_token"]

def test_optional_client_receipt():
    token = get_token("admin_test@allure.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create client first
    db = TestingSessionLocal()
    client_obj = models.Client(name="Receipt Test Client")
    db.add(client_obj)
    db.commit()
    client_id = client_obj.id
    db.close()
    
    # Create payment with optional project and invoice fields
    payload = {
        "client_id": client_id,
        "received_amount": 5000.0,
        "payment_method": "UPI",
        "remarks": "Test Direct Receipt",
        "receipt_type": "Direct Receipt"
    }
    
    # Send as form fields (data=payload instead of json=payload)
    resp = client.post("/api/project-payments", data=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_id"] is None
    assert data["invoice_number"] is None
    assert data["invoice_amount"] == 0.0
    assert data["received_amount"] == 5000.0
    assert data["pending_amount"] == -5000.0  # Advance/Direct payment pending is -received

def test_cash_book_dynamic_running_balance():
    db = TestingSessionLocal()
    db.query(models.CashBook).delete()
    
    e1 = models.CashBook(transaction_id="TX-001", date=date(2026, 7, 1), transaction_type="IN", category="Manual", amount=1000.0, payment_method="Cash")
    e2 = models.CashBook(transaction_id="TX-002", date=date(2026, 7, 2), transaction_type="OUT", category="Manual", amount=300.0, payment_method="Cash")
    e3 = models.CashBook(transaction_id="TX-003", date=date(2026, 7, 3), transaction_type="IN", category="Manual", amount=500.0, payment_method="Cash")
    
    db.add_all([e1, e2, e3])
    db.commit()
    db.close()
    
    token = get_token("admin_test@allure.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}
    
    resp = client.get("/api/cash-book", headers=headers)
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) == 3
    assert entries[0]["transaction_id"] == "TX-001"
    assert entries[0]["running_balance"] == 1000.0
    
    assert entries[1]["transaction_id"] == "TX-002"
    assert entries[1]["running_balance"] == 700.0
    
    assert entries[2]["transaction_id"] == "TX-003"
    assert entries[2]["running_balance"] == 1200.0
    
    resp_filtered = client.get("/api/cash-book?start_date=2026-07-02", headers=headers)
    entries_f = resp_filtered.json()
    assert len(entries_f) == 2
    assert entries_f[0]["transaction_id"] == "TX-002"
    assert entries_f[0]["running_balance"] == 700.0
    assert entries_f[1]["transaction_id"] == "TX-003"
    assert entries_f[1]["running_balance"] == 1200.0

def test_wallet_chronological_running_balance():
    db = TestingSessionLocal()
    db.query(models.FactoryWalletTransaction).delete()
    wallet = db.query(models.FactoryWallet).filter(models.FactoryWallet.id == "default").first()
    wallet.opening_balance = 5000.0
    wallet.balance = 5000.0
    db.commit()
    
    t1 = crud.log_wallet_transaction(db, "default", "FUND_ADDED", 2000.0, 0.0, "Add July 1", txn_date=date(2026, 7, 1))
    t2 = crud.log_wallet_transaction(db, "default", "EXPENSE_DEDUCTED", 0.0, 1000.0, "Expense July 2", txn_date=date(2026, 7, 2))
    t3 = crud.log_wallet_transaction(db, "default", "FUND_ADDED", 1500.0, 0.0, "Add July 3", txn_date=date(2026, 7, 3))
    db.commit()
    
    assert t1.running_balance == 7000.0
    assert t2.running_balance == 6000.0
    assert t3.running_balance == 7500.0
    assert wallet.balance == 7500.0
    
    t2.expense_deducted = 2000.0
    db.commit()
    
    crud.recalculate_wallet_running_balances(db, "default")
    db.commit()
    
    db.refresh(t1)
    db.refresh(t2)
    db.refresh(t3)
    db.refresh(wallet)
    
    assert t1.running_balance == 7000.0
    assert t2.running_balance == 5000.0
    assert t3.running_balance == 6500.0
    assert wallet.balance == 6500.0
    db.close()

def test_wallet_transfer_internal():
    db = TestingSessionLocal()
    new_wallet = db.query(models.FactoryWallet).filter(models.FactoryWallet.id == "wallet2").first()
    if not new_wallet:
        new_wallet = models.FactoryWallet(id="wallet2", name="Second Wallet", opening_balance=0.0, balance=0.0)
        db.add(new_wallet)
        db.commit()
    else:
        new_wallet.balance = 0.0
        db.commit()
        
    wallet1 = db.query(models.FactoryWallet).filter(models.FactoryWallet.id == "default").first()
    wallet1.balance = 6500.0
    db.commit()
    
    token = get_token("admin_test@allure.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {
        "source_wallet_id": "default",
        "destination_wallet_id": "wallet2",
        "amount": 1500.0,
        "remarks": "Internal Transfer Test"
    }
    
    resp = client.post("/api/factory-wallet/transfer", json=payload, headers=headers)
    assert resp.status_code == 200
    
    db.refresh(new_wallet)
    db.refresh(wallet1)
    
    assert wallet1.balance == 5000.0
    assert new_wallet.balance == 1500.0
    db.close()

def test_wallet_transfer_from_cash_book():
    db = TestingSessionLocal()
    db.query(models.CashBook).delete()
    cb_in = models.CashBook(transaction_id="TX-IN-VAL", date=date.today(), transaction_type="IN", category="Injection", amount=10000.0, payment_method="Cash")
    db.add(cb_in)
    
    wallet2 = db.query(models.FactoryWallet).filter(models.FactoryWallet.id == "wallet2").first()
    if not wallet2:
        wallet2 = models.FactoryWallet(id="wallet2", name="Second Wallet", opening_balance=0.0, balance=1500.0)
        db.add(wallet2)
    else:
        wallet2.balance = 1500.0
    db.commit()
    
    token = get_token("admin_test@allure.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {
        "source_wallet_id": "cash_book",
        "destination_wallet_id": "wallet2",
        "amount": 3000.0,
        "remarks": "Cash Book Source Transfer"
    }
    resp = client.post("/api/factory-wallet/transfer", json=payload, headers=headers)
    assert resp.status_code == 200
    
    db.refresh(wallet2)
    assert wallet2.balance == 4500.0
    
    cb_entries = db.query(models.CashBook).filter(models.CashBook.reference_type == "wallet_transfer").all()
    assert len(cb_entries) == 1
    assert cb_entries[0].transaction_type == "OUT"
    assert cb_entries[0].amount == 3000.0
    db.close()

def test_security_access_control():
    worker_token = get_token("worker_test@allure.com", "worker123")
    worker_headers = {"Authorization": f"Bearer {worker_token}"}
    
    resp = client.delete("/api/expenses/some-expense-id", headers=worker_headers)
    assert resp.status_code == 403
    
    manager_token = get_token("manager_test@allure.com", "manager123")
    manager_headers = {"Authorization": f"Bearer {manager_token}"}
    
    rule_payload = {
        "late_grace_minutes": 20,
        "half_day_threshold_hours": 5.0,
        "min_hours_present": 8.0
    }
    resp = client.put("/api/settings/attendance-rules", json=rule_payload, headers=manager_headers)
    assert resp.status_code == 403
    
    resp = client.get("/api/projects/some-project-id/audit-trail", headers=worker_headers)
    assert resp.status_code == 403

def test_ai_chat_finance():
    token = get_token("admin_test@allure.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {
        "message": "What is our wallet balance and cash book status?"
    }
    resp = client.post("/api/ai/chat", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "Financial Status Summary" in data["response"]
    assert "Company Capital Cash Book Balance" in data["response"]

def test_ai_chat_langflow_fallback(monkeypatch):
    from config import settings
    orig_url = settings.LANGFLOW_API_URL
    orig_id = settings.LANGFLOW_FLOW_ID
    
    settings.LANGFLOW_API_URL = "http://localhost:7860/api/v1/run"
    settings.LANGFLOW_FLOW_ID = "mock-flow-id"
    
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
                                        "text": "Hello from mock Langflow!"
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
            
    monkeypatch.setattr("requests.post", lambda *args, **kwargs: MockResponse())
    
    token = get_token("admin_test@allure.com", "admin123")
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {"message": "hello xyz"}
    resp = client.post("/api/ai/chat", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["response"] == "Hello from mock Langflow!"
    
    settings.LANGFLOW_API_URL = orig_url
    settings.LANGFLOW_FLOW_ID = orig_id

def teardown_module(module):
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass
