import os
import sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base
import models
from config import settings
from ai_orchestration.pdf_generator import generate_pdf_report
from ai_orchestration.email_client import send_smtp_email
from ai_orchestration.daily_report_scheduler import generate_daily_report

TEST_DB_FILE = "./test_notifications.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def test_pdf_generation():
    output_pdf = "./test_backups/test_report.pdf"
    if os.path.exists(output_pdf):
        os.remove(output_pdf)

    sections = [
        {"header": "Summary Section", "content": "This is a testing PDF output content description."},
        {"header": "Metrics Table", "table_data": [["Metric", "Value"], ["Present Workers", "12"], ["Pending orders", "2"]]}
    ]

    success = generate_pdf_report(output_pdf, "Test Notification Report", sections)
    assert success is True
    assert os.path.exists(output_pdf)
    assert os.path.getsize(output_pdf) > 0

    # Cleanup
    if os.path.exists(output_pdf):
        os.remove(output_pdf)

def test_smtp_simulation_fallback():
    # Calling email utility with blank username/password executes simulated logs
    success = send_smtp_email(
        to_email="test_recipient@allure.com",
        subject="Test Alert Notification",
        text_body="System alerts details."
    )
    assert success is True

def test_daily_report_pdf_archiver():
    db = TestingSessionLocal()
    try:
        # Seed records for daily report aggregation
        project = models.Project(name="Test Notify Project", status="active", completion_percentage=45)
        item = models.InventoryItem(
            name="Testing Oak Board",
            sku="MAT-TST-1",
            barcode="444001",
            quantity=8.0,
            unit="Sheets",
            unit_cost=100.0,
            minimum_stock_level=12.0 # Trigger low stock
        )
        db.add_all([project, item])
        db.commit()

        # Run scheduler report generation
        res = generate_daily_report(db)
        assert res["status"] == "success"
        
        # Verify both txt and pdf files exist
        assert os.path.exists(res["report_archived"])
        pdf_path = res["report_archived"].replace(".txt", ".pdf")
        assert os.path.exists(pdf_path)
        assert os.path.getsize(pdf_path) > 0

        # Cleanup created files
        if os.path.exists(res["report_archived"]):
            os.remove(res["report_archived"])
        if os.path.exists(pdf_path):
            os.remove(pdf_path)

    finally:
        db.close()
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass
