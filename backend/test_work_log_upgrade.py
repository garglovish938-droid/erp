import os
os.environ["DATABASE_URL"] = "sqlite:///test.db"
import sys
import json
from datetime import datetime, date
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
# We reuse or re-create it
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except:
        pass

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
        raise AssertionError(f"Test failed: {name}")

def test_workflow():
    print("\n=== STARTING UPGRADE WORK FLOW TESTS ===")
    
    # 1. Register test users (Worker 1, Worker 2, and Supervisor)
    db = TestingSessionLocal()
    try:
        w1 = models.User(
            email="worker1@allure.com",
            password_hash=auth.get_password_hash("Password@1234"),
            role="worker",
            full_name="Worker One",
            employee_code="EMP-W1",
            status="active"
        )
        w2 = models.User(
            email="worker2@allure.com",
            password_hash=auth.get_password_hash("Password@1234"),
            role="worker",
            full_name="Worker Two",
            employee_code="EMP-W2",
            status="active"
        )
        manager = models.User(
            email="manager@allure.com",
            password_hash=auth.get_password_hash("Password@1234"),
            role="manager",
            full_name="Project Manager",
            employee_code="EMP-MGR",
            status="active"
        )
        db.add_all([w1, w2, manager])
        db.commit()
        db.refresh(w1)
        db.refresh(w2)
        db.refresh(manager)
        
        # Link to staff
        s1 = models.Staff(user_id=w1.id, name=w1.full_name, role="Worker", email=w1.email, status="active")
        s2 = models.Staff(user_id=w2.id, name=w2.full_name, role="Worker", email=w2.email, status="active")
        sm = models.Staff(user_id=manager.id, name=manager.full_name, role="Manager", email=manager.email, status="active")
        db.add_all([s1, s2, sm])
        
        # Create a test client and project
        test_client = models.Client(name="John Doe", email="john@doe.com", phone="1234567890")
        db.add(test_client)
        db.commit()
        db.refresh(test_client)
        
        project = models.Project(
            name="Upgrade Project Alpha",
            client_id=test_client.id,
            status="active",
            budget=500000.0,
            completion_percentage=10
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        
        assign1 = models.ProjectAssignment(project_id=project.id, user_id=w1.id)
        assign2 = models.ProjectAssignment(project_id=project.id, user_id=w2.id)
        db.add_all([assign1, assign2])
        db.commit()
        
        w1_id = w1.id
        w2_id = w2.id
        manager_id = manager.id
        project_id = project.id
    finally:
        db.close()

    # Get login tokens
    w1_token = client.post("/api/auth/login", json={"email": "worker1@allure.com", "password": "Password@1234"}).json()["access_token"]
    w2_token = client.post("/api/auth/login", json={"email": "worker2@allure.com", "password": "Password@1234"}).json()["access_token"]
    manager_token = client.post("/api/auth/login", json={"email": "manager@allure.com", "password": "Password@1234"}).json()["access_token"]

    headers_w1 = {"Authorization": f"Bearer {w1_token}"}
    headers_w2 = {"Authorization": f"Bearer {w2_token}"}
    headers_mgr = {"Authorization": f"Bearer {manager_token}"}

    # Test 1: Create a daily log
    print("\n--- Running Test: Create Daily Log ---")
    log_payload = {
        "task": "Polishing main dining tabletop",
        "hours_worked": 6.5,
        "progress_percentage": 25,
        "remarks": "Polished the wood finish twice, needs to dry overnight",
        "device_time": "2026-06-29 14:00:00"
    }
    
    # Send as form-data
    res = client.post(
        f"/api/projects/{project_id}/daily-log",
        data={k: str(v) for k, v in log_payload.items()},
        headers=headers_w1
    )
    assert_test("Create daily progress log response code", res.status_code == 200, f"Status: {res.status_code}")
    log_data = res.json()
    log_id = log_data["log_id"]

    # Fetch daily-logs to verify pending state
    logs_res = client.get(f"/api/projects/{project_id}/daily-logs", headers=headers_w1)
    logs_list = logs_res.json()["logs"]
    created_log = next((l for l in logs_list if l["id"] == log_id), None)
    assert_test("Created log exists in list", created_log is not None)
    assert_test("Created log status is pending", created_log["approval_status"] == "pending", f"Status: {created_log['approval_status']}")
    assert_test("Created log owner user matches", created_log["user_id"] == w1_id)

    # Test 2: Edit permissions
    print("\n--- Running Test: Edit Progress Log Permissions ---")
    edit_payload = {
        "task": "Polishing main dining tabletop & chair legs",
        "hours_worked": 7.0,
        "progress_percentage": 30,
        "remarks": "Dried sooner than expected, did a third coat",
        "device_time": "2026-06-29 16:30:00"
    }
    
    # W2 tries to edit W1's log (should fail)
    res_edit_fail = client.put(
        f"/api/projects/{project_id}/daily-logs/{log_id}",
        data={k: str(v) for k, v in edit_payload.items()},
        headers=headers_w2
    )
    assert_test("Worker 2 cannot edit Worker 1's log", res_edit_fail.status_code == 403, f"Status: {res_edit_fail.status_code}")
    
    # W1 edits own log (should succeed)
    res_edit_ok = client.put(
        f"/api/projects/{project_id}/daily-logs/{log_id}",
        data={k: str(v) for k, v in edit_payload.items()},
        headers=headers_w1
    )
    assert_test("Worker 1 edits own log successfully", res_edit_ok.status_code == 200, f"Status: {res_edit_ok.status_code}")
    
    # Fetch list and verify edit changes
    logs_res = client.get(f"/api/projects/{project_id}/daily-logs", headers=headers_w1)
    edited_log = next((l for l in logs_res.json()["logs"] if l["id"] == log_id), None)
    assert_test("Edits reflected in database task", edited_log["task"] == "Polishing main dining tabletop & chair legs")
    assert_test("Edits reflected in database progress_percentage", edited_log["progress_percentage"] == 30)

    # Test 3: Supervisor Comment & Approval
    print("\n--- Running Test: Supervisor Approval/Reject and Comments ---")
    approval_payload = {
        "status": "approved",
        "comment": "Exceptional gloss finish, looks ready for shipment."
    }
    
    # Worker 1 tries to approve own log (should fail)
    res_app_fail = client.put(
        f"/api/projects/{project_id}/daily-logs/{log_id}/approve",
        json=approval_payload,
        headers=headers_w1
    )
    assert_test("Worker cannot approve daily log", res_app_fail.status_code == 451 or res_app_fail.status_code == 403, f"Status: {res_app_fail.status_code}")

    # Manager approves log (should succeed)
    res_app_ok = client.put(
        f"/api/projects/{project_id}/daily-logs/{log_id}/approve",
        json=approval_payload,
        headers=headers_mgr
    )
    assert_test("Supervisor approves daily log successfully", res_app_ok.status_code == 200, f"Status: {res_app_ok.status_code}")
    
    # Fetch list and verify approval
    logs_res = client.get(f"/api/projects/{project_id}/daily-logs", headers=headers_w1)
    approved_log = next((l for l in logs_res.json()["logs"] if l["id"] == log_id), None)
    assert_test("Status changed to approved", approved_log["approval_status"] == "approved")
    assert_test("Comment added to daily log", approved_log["supervisor_comment"] == "Exceptional gloss finish, looks ready for shipment.")

    # Test 4: Delete permissions
    print("\n--- Running Test: Delete Progress Log Permissions ---")
    
    # Create another log to test deletion
    log2_payload = {
        "task": "Sanding tabletops",
        "hours_worked": 4.0,
        "progress_percentage": 45,
        "remarks": "Sanded to clean state",
        "device_time": "2026-06-29 17:00:00"
    }
    log2_res = client.post(
        f"/api/projects/{project_id}/daily-log",
        data={k: str(v) for k, v in log2_payload.items()},
        headers=headers_w1
    )
    log2_id = log2_res.json()["log_id"]

    # W2 tries to delete W1's log (should fail)
    res_del_fail = client.delete(
        f"/api/projects/{project_id}/daily-logs/{log2_id}",
        headers=headers_w2
    )
    assert_test("Worker 2 cannot delete Worker 1's log", res_del_fail.status_code == 403, f"Status: {res_del_fail.status_code}")

    # W1 deletes own log (should succeed)
    res_del_ok = client.delete(
        f"/api/projects/{project_id}/daily-logs/{log2_id}",
        headers=headers_w1
    )
    assert_test("Worker 1 deletes own log successfully", res_del_ok.status_code == 200, f"Status: {res_del_ok.status_code}")

    # Test 5: Verify project audit trail timeline
    print("\n--- Running Test: Project Activity Timeline Audit Trail ---")
    res_trail = client.get(
        f"/api/projects/{project_id}/audit-trail",
        headers=headers_mgr
    )
    assert_test("Fetch audit trail succeeds", res_trail.status_code == 200, f"Status: {res_trail.status_code}")
    trail_data = res_trail.json()
    assert_test("Audit trail has records", len(trail_data) >= 3, f"Length: {len(trail_data)}")
    
    actions = [t["action"] for t in trail_data]
    print(f"Recorded activities: {actions}")
    assert_test("Audit trail contains Submit Work Log", "Submit Work Log" in actions)
    assert_test("Audit trail contains Edit Work Log", "Edit Work Log" in actions)
    assert_test("Audit trail contains Approve Work Log", "Approve Work Log" in actions)

    print(f"\nUpgrade Workflow Test completed successfully: {tests_passed}/{tests_run} assertions passed!")

if __name__ == "__main__":
    test_workflow()
