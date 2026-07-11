import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, get_db
from main import app
import models, auth, schemas

# Setup test DB
TEST_DB_FILE = "./test_barcode_scan.db"
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

# Create a mock authenticated user dependency override
def override_require_any_authenticated():
    return models.User(id="test-user-id", email="test@allure.com", role="admin")

# Overrides
app.dependency_overrides[auth.require_any_authenticated] = override_require_any_authenticated
app.dependency_overrides[auth.get_current_user] = override_require_any_authenticated

client = TestClient(app)

def test_barcode_scan_success():
    db = TestingSessionLocal()
    # 1. Create a dummy inventory item
    item = models.InventoryItem(
        id="test-item-id",
        name="Premium Teak Wood",
        sku="WD-TEAK-PREM",
        barcode="1234567890",
        quantity=50.0,
        unit="pcs",
        unit_cost=1200.0,
        is_deleted=False
    )
    db.add(item)
    db.commit()
    
    response = client.get("/api/inventory/scan/1234567890")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Premium Teak Wood"
    assert data["sku"] == "WD-TEAK-PREM"
    assert data["barcode"] == "1234567890"
    assert data["quantity"] == 50.0
    
    # Clean up
    db.delete(item)
    db.commit()
    db.close()

def test_barcode_scan_not_found():
    response = client.get("/api/inventory/scan/nonexistent")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

def teardown_module(module):
    # Clear overrides
    app.dependency_overrides.clear()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass
