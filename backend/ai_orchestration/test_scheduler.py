import os
import sys
import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base
import models
from ai_orchestration.daily_report_scheduler import generate_daily_report
from config import settings

TEST_DB_FILE = "./test_scheduler.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def test_daily_report_generation(monkeypatch):
    db = TestingSessionLocal()
    try:
        # Mock settings
        monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
        monkeypatch.setattr(settings, "OLLAMA_URL", "")
        monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "http://mock-webhook/run")

        # Seed mock database values
        item = models.InventoryItem(
            name="Report Material",
            sku="MAT-REP-1",
            barcode="888001",
            quantity=10.0,
            unit="Sheets",
            unit_cost=150.0,
            minimum_stock_level=5.0
        )
        project = models.Project(
            name="Report Project",
            status="active",
            completion_percentage=45
        )
        expense = models.DailyExpense(
            expense_id="EXP-REP-TEST",
            expense_category="General",
            amount=500.0,
            expense_date=date.today(),
            description="Report Test Expense"
        )
        
        db.add_all([item, project, expense])
        db.commit()

        # Mock requests.post
        requests_called = {}
        def mock_post(url, json=None, headers=None, timeout=None):
            requests_called[url] = json
            class MockResponse:
                status_code = 200
                def json(self):
                    return {"status": "success"}
            return MockResponse()

        monkeypatch.setattr("requests.post", mock_post)

        # Execute
        result = generate_daily_report(db)

        # Assertions
        assert result["status"] == "success"
        assert result["automation_trigger"] == "triggered"
        assert "Local Fallback" in result["summary"]
        
        # Verify JSON payload details
        assert "http://mock-webhook/run" in requests_called
        payload = requests_called["http://mock-webhook/run"]
        assert payload["is_owner_report"] is True
        assert payload["data"]["total_valuation"] == 1500.0
        assert payload["data"]["today_expense"] == 500.0
        assert payload["data"]["active_projects"] == 1
        
    finally:
        db.close()
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass
