import os
import sys
import shutil
from datetime import datetime, date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set python path to current directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import Base, get_db
from main import app
import models, crud, schemas, auth

# Setup fresh SQLite database file for testing
TEST_DB_FILE = "./test_upgrade_temp.db"
if os.path.exists(TEST_DB_FILE):
    os.remove(TEST_DB_FILE)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Re-create tables
Base.metadata.create_all(bind=engine)

# Seed default rules
db = TestingSessionLocal()
try:
    rule = db.query(models.AttendanceRule).first()
    if not rule:
        rule = models.AttendanceRule(
            late_grace_minutes=15,
            half_day_threshold_hours=4.0,
            min_hours_present=8.0
        )
        db.add(rule)
        db.commit()
finally:
    db.close()

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

# Helper to verify test status
tests_run = 0
tests_passed = 0

def assert_test(name, condition, details=""):
    global tests_run, tests_passed
    tests_run += 1
    if condition:
        tests_passed += 1
        print(f"[PASS] {name}: {details}")
    else:
        print(f"[FAIL] {name}: {details}")
        # We don't raise immediately so we can see all failures
        raise AssertionError(f"Test failed: {name}")

def test_user_auth_and_disabled_user():
    print("\n--- Running Test 1: User Authentication & Disabled Status ---")
    
    # 1. Register a user
    user_payload = {
        "email": "test_auth@allure.com",
        "password": "Password@1234",
        "full_name": "Test Auth User",
        "role": "worker",
        "employee_code": "EMP-AUTH-01",
        "phone": "9999999991",
        "department": "Production",
        "status": "active"
    }
    
    # Seed directly in db
    db = TestingSessionLocal()
    try:
        db_user = models.User(
            email=user_payload["email"],
            password_hash=auth.get_password_hash(user_payload["password"]),
            role=user_payload["role"],
            full_name=user_payload["full_name"],
            phone=user_payload["phone"],
            employee_code=user_payload["employee_code"],
            department=user_payload["department"],
            status="active"
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        # Link user to staff record
        db_staff = models.Staff(
            user_id=db_user.id,
            name=db_user.full_name,
            role="Worker",
            phone=db_user.phone,
            email=db_user.email,
            status="active"
        )
        db.add(db_staff)
        db.commit()
    finally:
        db.close()

    # 2. Login (should succeed)
    login_res = client.post("/api/auth/login", json={
        "email": "test_auth@allure.com",
        "password": "Password@1234"
    })
    assert_test("Login of active user succeeds", login_res.status_code == 200, f"Status: {login_res.status_code}")
    
    # 3. Disable user status directly in database
    db = TestingSessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == "test_auth@allure.com").first()
        user.status = "disabled"
        db.commit()
    finally:
        db.close()
        
    # 4. Try to login (should fail with 403 Forbidden because user is disabled)
    login_fail_res = client.post("/api/auth/login", json={
        "email": "test_auth@allure.com",
        "password": "Password@1234"
    })
    assert_test("Login of disabled user is blocked", login_fail_res.status_code == 403, f"Status: {login_fail_res.status_code}")


def test_authorization_rules():
    print("\n--- Running Test 2: Role Authorization Rules ---")
    
    # Create Super Admin, Factory Manager, and regular Worker
    db = TestingSessionLocal()
    try:
        # Create Super Admin
        sa_user = models.User(
            email="sa@allure.com",
            password_hash=auth.get_password_hash("Password@1234"),
            role="admin",
            full_name="Super Admin",
            status="active"
        )
        db.add(sa_user)
        
        # Create Factory Manager
        fm_user = models.User(
            email="fm@allure.com",
            password_hash=auth.get_password_hash("Password@1234"),
            role="factory_manager",
            full_name="Factory Manager",
            status="active"
        )
        db.add(fm_user)
        db.commit()
        db.refresh(fm_user)
        
        # Link to Staff
        fm_staff = models.Staff(
            user_id=fm_user.id,
            name=fm_user.full_name,
            role="Factory Manager",
            email=fm_user.email,
            status="active"
        )
        db.add(fm_staff)
        db.commit()
    finally:
        db.close()

    # Login as Super Admin
    sa_login = client.post("/api/auth/login", json={"email": "sa@allure.com", "password": "Password@1234"}).json()
    sa_token = sa_login["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}
    
    # Login as Factory Manager
    fm_login = client.post("/api/auth/login", json={"email": "fm@allure.com", "password": "Password@1234"}).json()
    fm_token = fm_login["access_token"]
    fm_headers = {"Authorization": f"Bearer {fm_token}"}
    
    # 1. Verify Factory Manager can see users list
    users_res = client.get("/api/users", headers=fm_headers)
    assert_test("Factory Manager can retrieve users list", users_res.status_code == 200, f"Status: {users_res.status_code}")
    
    # Get Super Admin ID
    db = TestingSessionLocal()
    sa_id = db.query(models.User).filter(models.User.email == "sa@allure.com").first().id
    db.close()
    
    # 2. Verify Factory Manager is BLOCKED from deleting Super Admin
    del_res = client.delete(f"/api/users/{sa_id}", headers=fm_headers)
    assert_test("Factory Manager blocked from deleting Super Admin", del_res.status_code in [400, 403], f"Status: {del_res.status_code}")
    
    # 3. Verify Factory Manager is BLOCKED from modifying Super Admin details
    mod_res = client.put(f"/api/users/{sa_id}", json={"full_name": "Tampered Admin"}, headers=fm_headers)
    assert_test("Factory Manager blocked from modifying Super Admin details", mod_res.status_code in [400, 403], f"Status: {mod_res.status_code}")


def test_selfie_enforcement_for_workers():
    print("\n--- Running Test 3: Enforced Selfie Check-In for Workers ---")
    
    # Re-enable the worker user
    db = TestingSessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == "test_auth@allure.com").first()
        user.status = "active"
        db.commit()
    finally:
        db.close()
        
    # Login as Factory Manager (allowed to do non-selfie)
    fm_login = client.post("/api/auth/login", json={"email": "fm@allure.com", "password": "Password@1234"}).json()
    fm_headers = {"Authorization": f"Bearer {fm_login['access_token']}"}
    
    # Login as Worker (blocked from doing non-selfie)
    w_login = client.post("/api/auth/login", json={"email": "test_auth@allure.com", "password": "Password@1234"}).json()
    w_headers = {"Authorization": f"Bearer {w_login['access_token']}"}
    
    # 1. Factory Manager regular check-in (should succeed)
    fm_checkin = client.post("/api/attendance/check-in", json={"device": "Office Terminal"}, headers=fm_headers)
    assert_test("Manager role allowed to use regular check-in", fm_checkin.status_code == 200, f"Status: {fm_checkin.status_code}")
    
    # 2. Worker regular check-in (should be blocked - 403)
    w_checkin = client.post("/api/attendance/check-in", json={"device": "BYOD mobile"}, headers=w_headers)
    assert_test("Worker role BLOCKED from using regular check-in", w_checkin.status_code == 403, f"Status: {w_checkin.status_code}")


def test_proxy_alert_detection():
    print("\n--- Running Test 4: Anti-Proxy Fingerprint Mismatch Alert ---")
    
    # Register worker-2
    db = TestingSessionLocal()
    try:
        user = models.User(
            email="worker2@allure.com",
            password_hash=auth.get_password_hash("Password@1234"),
            role="worker",
            full_name="Worker Two",
            status="active"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        staff = models.Staff(
            user_id=user.id,
            name=user.name if hasattr(user, "name") else user.full_name,
            role="Worker",
            email=user.email,
            status="active"
        )
        db.add(staff)
        db.commit()
    finally:
        db.close()

    # Login worker-2
    w_login = client.post("/api/auth/login", json={"email": "worker2@allure.com", "password": "Password@1234"}).json()
    w_headers = {"Authorization": f"Bearer {w_login['access_token']}"}
    
    # Perform Selfie Check-In 1: device fingerprint A, IP address A
    selfie_file = ("selfie.jpg", b"dummy_image_data_bytes_content_here", "image/jpeg")
    res1 = client.post(
        "/api/attendance/selfie-check-in",
        headers={"Authorization": f"Bearer {w_login['access_token']}"},
        files={"file": selfie_file},
        data={
            "device": "Device A",
            "ip_address": "192.168.1.10",
            "device_fingerprint": "FP-11111",
            "browser_details": "Chrome 120"
        }
    )
    assert_test("First selfie check-in succeeds", res1.status_code == 200, f"Status: {res1.status_code}")
    
    # Fast forward: Change the check-in date in database to yesterday so we can check in again today
    db = TestingSessionLocal()
    try:
        att = db.query(models.Attendance).filter(models.Attendance.ip_address == "192.168.1.10").first()
        att.date = date.today() - timedelta(days=1)
        db.commit()
    finally:
        db.close()
        
    # Perform Selfie Check-In 2: device fingerprint B (Proxy Signature Mismatch)
    res2 = client.post(
        "/api/attendance/selfie-check-in",
        headers={"Authorization": f"Bearer {w_login['access_token']}"},
        files={"file": selfie_file},
        data={
            "device": "Device B",
            "ip_address": "10.0.0.50",
            "device_fingerprint": "FP-22222", # Different fingerprint
            "browser_details": "Safari 17"
        }
    )
    assert_test("Second check-in succeeds", res2.status_code == 200, f"Status: {res2.status_code}")
    
    # Verify that the second check-in is flagged as suspicious
    db = TestingSessionLocal()
    try:
        att2 = db.query(models.Attendance).filter(models.Attendance.check_in_fingerprint == "FP-22222").first()
        assert_test("Suspicious proxy check-in marked is_suspicious=True", att2.is_suspicious == True, f"Suspicious reason: {att2.suspicious_reason}")
        
        # Verify notification created
        notif = db.query(models.Notification).filter(models.Notification.type == "proxy_alert").first()
        assert_test("Proxy alert system notification generated", notif is not None, f"Notif Description: {notif.description if notif else 'None'}")
    finally:
        db.close()


def test_general_material_request():
    print("\n--- Running Test 5: General Material Requests without Project ---")
    
    # Login as Project Manager (allowed to edit projects)
    fm_login = client.post("/api/auth/login", json={"email": "fm@allure.com", "password": "Password@1234"}).json()
    fm_headers = {"Authorization": f"Bearer {fm_login['access_token']}"}
    
    # Setup Category and Inventory item
    db = TestingSessionLocal()
    try:
        cat = models.Category(name="Lumber Wood", description="General Lumber")
        db.add(cat)
        db.commit()
        db.refresh(cat)
        
        item = models.InventoryItem(
            category_id=cat.id,
            sku="SKU-LUMB-01",
            name="Pine Lumber Board 2x4",
            quantity=100.0,
            unit="pcs",
            unit_cost=10.0,
            minimum_stock_level=10.0,
            barcode="123456789"
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        item_id = item.id
    finally:
        db.close()
        
    # 1. Create a Material Request with project_id = None (General Store Request)
    req_payload = {
        "project_id": None,
        "inventory_id": item_id,
        "quantity": 10.0,
        "notes": "General maintenance of wood racks"
    }
    
    res = client.post("/api/requests", json=req_payload, headers=fm_headers)
    assert_test("General store request created successfully", res.status_code == 200, f"Status: {res.status_code}")
    assert_test("General store request has project_id as null", res.json()["project_id"] is None, f"Project ID: {res.json()['project_id']}")


def test_purchase_order_category_validation():
    print("\n--- Running Test 6: Purchase Order Category Validation ---")
    
    # Login as Super Admin
    sa_login = client.post("/api/auth/login", json={"email": "sa@allure.com", "password": "Password@1234"}).json()
    sa_headers = {"Authorization": f"Bearer {sa_login['access_token']}"}
    
    # Fetch inventory item and supplier
    db = TestingSessionLocal()
    try:
        item = db.query(models.InventoryItem).first()
        item_id = item.id
        
        supplier = models.Supplier(name="Wood Supplier Ltd")
        db.add(supplier)
        db.commit()
        db.refresh(supplier)
        supplier_id = supplier.id
    finally:
        db.close()
        
    # 1. Submit PO with allowed category (Raw Material) - should succeed
    po_good = {
        "supplier_id": supplier_id,
        "inventory_id": item_id,
        "quantity": 50.0,
        "unit_cost": 9.5,
        "category": "Raw Material"
    }
    res_good = client.post("/api/purchasing", json=po_good, headers=sa_headers)
    assert_test("PO with valid category 'Raw Material' accepted", res_good.status_code == 200, f"Status: {res_good.status_code}")
    
    # 2. Submit PO with invalid category (Vacation) - should be rejected (422)
    po_bad = {
        "supplier_id": supplier_id,
        "inventory_id": item_id,
        "quantity": 10.0,
        "unit_cost": 200.0,
        "category": "Vacation"
    }
    res_bad = client.post("/api/purchasing", json=po_bad, headers=sa_headers)
    assert_test("PO with invalid category 'Vacation' rejected (422)", res_bad.status_code == 422, f"Status: {res_bad.status_code}")


def test_audit_logs():
    print("\n--- Running Test 7: Audit Logs Writing verification ---")
    
    db = TestingSessionLocal()
    try:
        # Check ActivityLog records
        logs = db.query(models.ActivityLog).all()
        assert_test("Audit log records created in database", len(logs) > 0, f"Log count: {len(logs)}")
        
        # Verify IP Address and User Agent are logged in recent records
        login_logs = db.query(models.ActivityLog).filter(models.ActivityLog.action.in_(["login", "selfie_check_in"])).all()
        has_client_details = any(l.ip_address is not None for l in login_logs)
        assert_test("ActivityLog contains client IP and device agent logs", has_client_details, f"Logged IPs: {[l.ip_address for l in login_logs]}")
    finally:
        db.close()


def cleanup():
    # Dispose engine to close all SQLite connections and release file lock
    engine.dispose()
    # Remove temporary database file
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception as e:
            print(f"Warning: Could not remove {TEST_DB_FILE}: {str(e)}")
    print("\nTemporary test database cleaned up.")

if __name__ == "__main__":
    try:
        test_user_auth_and_disabled_user()
        test_authorization_rules()
        test_selfie_enforcement_for_workers()
        test_proxy_alert_detection()
        test_general_material_request()
        test_purchase_order_category_validation()
        test_audit_logs()
        print(f"\n==================================================")
        print(f"ALL TESTS PASSED: {tests_passed}/{tests_run}")
        print(f"==================================================")
        cleanup()
        sys.exit(0)
    except Exception as e:
        print(f"\n[FAIL] Test suite execution halted due to unexpected error/failure:")
        import traceback
        traceback.print_exc()
        cleanup()
        sys.exit(1)
