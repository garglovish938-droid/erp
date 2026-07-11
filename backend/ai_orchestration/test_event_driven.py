import pytest
import os
from unittest.mock import MagicMock, patch

from services.event_service import EventService, ERPEvent
from services.automation_service import AutomationService
from services.barcode_service import BarcodeService
from services.email_service import EmailService
from services.whatsapp_service import WhatsAppService
from services.notification_service import NotificationService

def test_event_service_publish():
    """
    Verifies that EventService successfully broadcasts published events to subscribers.
    """
    calls = []
    def dummy_subscriber(event: ERPEvent):
        calls.append(event)
        
    EventService.subscribe(dummy_subscriber)
    try:
        payload = {"item_id": "test_item_1", "qty": 100}
        event = EventService.publish("STOCK_RECEIVED", {"id": "usr_123", "role": "admin"}, "inventory", payload)
        
        assert len(calls) == 1
        assert calls[0].event_type == "STOCK_RECEIVED"
        assert calls[0].payload == payload
        assert calls[0].user["id"] == "usr_123"
        assert calls[0].user["role"] == "admin"
        assert calls[0].correlation_id is not None
    finally:
        EventService.unsubscribe(dummy_subscriber)

def test_whatsapp_dedup():
    """
    Verifies that the WhatsApp deduplication registry skips duplicate messages within 1 hour.
    """
    with patch("requests.post") as mock_post:
        mock_post.return_value.status_code = 200
        
        from services.whatsapp_service import _dedup_cache
        _dedup_cache.clear()
        
        # First alert trigger -> returns True (dispatched)
        res1 = WhatsAppService.send_alert("owner", "low_stock", "Warning: SKU-001 is below safety limit")
        assert res1 is True
        
        # Second duplicate alert trigger -> returns False (deduplicated)
        res2 = WhatsAppService.send_alert("owner", "low_stock", "Warning: SKU-001 is below safety limit")
        assert res2 is False

def test_barcode_throttle():
    """
    Verifies that BarcodeService lookup prevents rapid duplicate scans within a 5-second window.
    """
    db = MagicMock()
    item_mock = MagicMock()
    item_mock.id = "inv_123"
    item_mock.sku = "SKU-999"
    item_mock.barcode = "998877"
    item_mock.quantity = 15.0
    item_mock.supplier_id = None
    db.query.return_value.filter.return_value.first.return_value = item_mock
    
    from services.barcode_service import _recent_scans
    _recent_scans.clear()
    
    # First scan signal -> returns details
    res = BarcodeService.lookup_barcode(db, "998877", "usr_1")
    assert res["sku"] == "SKU-999"
    
    # Immediate second scan -> raises ValueError due to double-scan safety window
    with pytest.raises(ValueError) as exc:
        BarcodeService.lookup_barcode(db, "998877", "usr_1")
    assert "Duplicate scan" in str(exc.value)

def test_excel_and_pdf_generation(tmp_path):
    """
    Verifies professional PDF and Excel sheets can be correctly generated.
    """
    pdf_path = str(tmp_path / "Monthly_Summary.pdf")
    xlsx_path = str(tmp_path / "Monthly_Summary.xlsx")
    
    # Test ReportLab PDF generator
    from ai_orchestration.pdf_generator import generate_pdf_report
    sections = [{"header": "Summary Section", "content": "Professional operating summary text"}]
    pdf_success = generate_pdf_report(pdf_path, "Allure Executive Report", sections)
    assert pdf_success is True
    assert os.path.exists(pdf_path)
    
    # Test openpyxl Excel generator
    xlsx_success = EmailService.generate_excel_report(
        xlsx_path,
        "Cash Book Operations",
        ["Date", "Operation Type", "Amount"],
        [["2026-07-11", "Deposit", "50000.00"]]
    )
    assert xlsx_success is True
    assert os.path.exists(xlsx_path)

def test_trigger_daily_report_api(monkeypatch):
    """
    Verifies that the automated POST /api/ai/reports/trigger-daily route functions correctly.
    """
    from fastapi.testclient import TestClient
    from main import app
    import auth, models
    
    def override_require_manager():
         return models.User(id="test-manager", email="manager@allure.com", role="factory_manager")
         
    app.dependency_overrides[auth.require_manager_or_higher] = override_require_manager
    
    client = TestClient(app)
    try:
        def mock_generate_report(db):
             return {"status": "success"}
             
        monkeypatch.setattr("ai_orchestration.daily_report_scheduler.generate_daily_report", mock_generate_report)
        
        response = client.post("/api/ai/reports/trigger-daily")
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    finally:
        app.dependency_overrides.clear()

def test_security_gates_and_reset_password(monkeypatch):
    """
    Verifies Phase 7 security gates: Only super admin can create users/staff.
    Also verifies password reset triggers Gmail SMTP dispatches.
    """
    from fastapi.testclient import TestClient
    from fastapi import HTTPException
    from main import app
    import auth, models
    
    def override_require_manager():
        raise HTTPException(status_code=403, detail="Access denied")
        
    app.dependency_overrides[auth.require_super_admin] = override_require_manager
    client = TestClient(app)
    try:
        resp = client.post("/api/users", json={"email": "newuser@allure.com", "password": "Password@123", "role": "worker", "full_name": "Monu Worker"})
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.clear()
        
    db_mock = MagicMock()
    user_mock = models.User(id="usr_123", email="employee@allure.com", password_hash="old_hash", full_name="Monu Worker")
    
    email_called = []
    def mock_send_email(to_email, subject, text_body, attachment_path=None):
        email_called.append((to_email, subject))
        return True
        
    monkeypatch.setattr("ai_orchestration.email_client.send_smtp_email", mock_send_email)
    
    def override_require_super_admin():
        return models.User(id="super-admin-id", email="sa@allure.com", role="super_admin")
    app.dependency_overrides[auth.get_current_user] = override_require_super_admin
    
    # We must patch get_db to return a mock DB session that returns user_mock on query
    def override_get_db():
        session = MagicMock()
        session.query.return_value.filter.return_value.first.return_value = user_mock
        yield session
        
    app.dependency_overrides[auth.get_db] = override_get_db
    
    try:
        resp = client.post("/api/users/usr_123/reset-password", json={"password": "NewStrongPassword@123"})
        assert resp.status_code == 200
        assert len(email_called) == 1
        assert email_called[0][0] == "employee@allure.com"
        assert "Password Reset" in email_called[0][1]
    finally:
        app.dependency_overrides.clear()
