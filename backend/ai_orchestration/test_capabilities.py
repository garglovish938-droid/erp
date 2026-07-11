import os
import sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base
import models
from ai_orchestration.system_capabilities import inventory_tool, finance_tool, dashboard_tool

TEST_DB_FILE = "./test_capabilities.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def test_capabilities_permissions():
    # Worker role should be denied for finance tool
    res = finance_tool(None, "worker", "get_capital_balance")
    assert res["status"] == "error"
    assert "Permission Denied" in res["message"]
    
    # Accountant role should be allowed (will try database query, which is empty but doesn't throw auth error)
    db = TestingSessionLocal()
    try:
        res = finance_tool(db, "accountant", "get_capital_balance")
        assert res["status"] == "success"
        assert res["balance"] == 0.0
    finally:
        db.close()

def test_dashboard_tool():
    db = TestingSessionLocal()
    try:
        res = dashboard_tool(db, "worker")
        assert res["status"] == "success"
        assert "active_projects" in res
        assert "inventory_items" in res
    finally:
        db.close()
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass
