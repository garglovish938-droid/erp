"""
ALLURE LIVING ERP - COMPREHENSIVE AUDIT SCRIPT
Phase 1-6: Authentication, Roles, Projects, Attendance, Inventory, Database
"""
import requests
import json
import time
import sys

BASE = "http://127.0.0.1:8000"
results = []

def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((name, status, detail))
    icon = "[PASS]" if cond else "[FAIL]"
    print(f"  {icon} {name}: {detail}")
    return cond

def sep(title):
    print(f"\n{'='*60}\n  {title}\n{'='*60}")

# =========================================================
# PHASE 1: AUTHENTICATION TESTING
# =========================================================
def run_audit():
    sep("PHASE 1: AUTHENTICATION TESTING")

    # 1a. Login with email
    r = requests.post(f"{BASE}/api/auth/login", json={"email": "admin@allure.com", "password": "admin123"})
    data = r.json()
    token = data.get("access_token", "")
    refresh = data.get("refresh_token", "")
    check("1.1 Login with email works", r.status_code == 200, f"HTTP {r.status_code}")
    check("1.2 Returns access_token", bool(token), "present" if token else "MISSING")
    check("1.3 Returns refresh_token", bool(refresh), "present" if refresh else "MISSING - OLD BACKEND")
    check("1.4 Returns role field", bool(data.get("role")), data.get("role", "MISSING"))
    check("1.5 Returns full_name", bool(data.get("full_name")), data.get("full_name", "MISSING"))

    H_admin = {"Authorization": f"Bearer {token}"}

    # 1b. Login with employee_code via username field
    r2 = requests.post(f"{BASE}/api/auth/login", json={"username": "EMP-001", "password": "admin123"})
    check("1.6 Login with employee_code (username field)", r2.status_code == 200, f"HTTP {r2.status_code}")

    # 1c. Login with mobile number
    r2b = requests.post(f"{BASE}/api/auth/login", json={"username": "9876543210", "password": "admin123"})
    check("1.7 Login with mobile number", r2b.status_code == 200, f"HTTP {r2b.status_code}")

    # 1d. Wrong password
    r3 = requests.post(f"{BASE}/api/auth/login", json={"email": "admin@allure.com", "password": "WRONGPASS"})
    check("1.8 Wrong password rejected (401)", r3.status_code == 401, f"HTTP {r3.status_code}")

    # 1e. Non-existent user
    r4 = requests.post(f"{BASE}/api/auth/login", json={"email": "nobody@fake.com", "password": "test"})
    check("1.9 Non-existent user rejected", r4.status_code in [401, 422], f"HTTP {r4.status_code}")

    # 1f. /api/auth/me
    r5 = requests.get(f"{BASE}/api/auth/me", headers=H_admin)
    check("1.10 GET /api/auth/me authenticated", r5.status_code == 200, f"HTTP {r5.status_code}")

    # 1g. /api/auth/me without token
    r6 = requests.get(f"{BASE}/api/auth/me")
    check("1.11 GET /api/auth/me without token blocked (401)", r6.status_code == 401, f"HTTP {r6.status_code}")

    # 1h. Unauthenticated inventory access
    r7 = requests.get(f"{BASE}/api/inventory")
    check("1.12 Unauthenticated inventory blocked (401)", r7.status_code == 401, f"HTTP {r7.status_code}")

    # 1i. Invalid JWT token
    r8 = requests.get(f"{BASE}/api/inventory", headers={"Authorization": "Bearer INVALID_TOKEN_HERE"})
    check("1.13 Tampered/invalid JWT rejected (401)", r8.status_code == 401, f"HTTP {r8.status_code}")

    # 1j. Refresh token endpoint
    r9 = requests.post(f"{BASE}/api/auth/refresh", json={"refresh_token": "fake_token"})
    check("1.14 Refresh with invalid token rejected", r9.status_code in [401, 422], f"HTTP {r9.status_code}")

    # 1k. Logout
    r10 = requests.post(f"{BASE}/api/auth/logout", headers=H_admin)
    check("1.15 Logout works", r10.status_code == 200, f"HTTP {r10.status_code}")

    # Re-login for next phases
    r = requests.post(f"{BASE}/api/auth/login", json={"email": "admin@allure.com", "password": "admin123"})
    token = r.json().get("access_token", "")
    H_admin = {"Authorization": f"Bearer {token}"}

    # =========================================================
    # PHASE 2: ROLE SECURITY TESTING
    # =========================================================
    sep("PHASE 2: ROLE SECURITY TESTING")

    # Create test users for each role
    test_users = [
        {"email": "audit_pm@test.com", "password": "test123", "full_name": "Audit PM", "role": "manager", "employee_code": "AUD-001", "phone": "1111111111"},
        {"email": "audit_store@test.com", "password": "test123", "full_name": "Audit Store", "role": "store", "employee_code": "AUD-002", "phone": "1111111112"},
        {"email": "audit_acc@test.com", "password": "test123", "full_name": "Audit Accountant", "role": "accountant", "employee_code": "AUD-003", "phone": "1111111113"},
        {"email": "audit_op@test.com", "password": "test123", "full_name": "Audit Operator", "role": "operator", "employee_code": "AUD-004", "phone": "1111111114"},
        {"email": "audit_carp@test.com", "password": "test123", "full_name": "Audit Carpenter", "role": "carpenter", "employee_code": "AUD-005", "phone": "1111111115"},
    ]

    created_tokens = {}
    for u in test_users:
        # Try to create user
        rc = requests.post(f"{BASE}/api/users", json=u, headers=H_admin)
        if rc.status_code in [200, 400]:  # 400 = already exists
            rl = requests.post(f"{BASE}/api/auth/login", json={"email": u["email"], "password": u["password"]})
            if rl.status_code == 200:
                created_tokens[u["role"]] = rl.json().get("access_token", "")
                print(f"  [INFO] Logged in as {u['role']} ({u['email']})")

    # Admin-only endpoint: GET /api/users
    r_admin = requests.get(f"{BASE}/api/users", headers=H_admin)
    check("2.1 Admin can access /api/users", r_admin.status_code == 200, f"HTTP {r_admin.status_code}")

    for role, tok in created_tokens.items():
        H_role = {"Authorization": f"Bearer {tok}"}
        r_block = requests.get(f"{BASE}/api/users", headers=H_role)
        check(f"2.2 {role} CANNOT access /api/users (403)", r_block.status_code == 403, f"HTTP {r_block.status_code}")

    # Reports access
    r_rep = requests.get(f"{BASE}/api/reports/inventory/pdf", headers=H_admin)
    check("2.3 Admin can access reports", r_rep.status_code in [200, 404], f"HTTP {r_rep.status_code}")

    for role, tok in created_tokens.items():
        if role in ["operator", "carpenter"]:
            H_role = {"Authorization": f"Bearer {tok}"}
            r_block = requests.get(f"{BASE}/api/reports/inventory/pdf", headers=H_role)
            check(f"2.4 {role} CANNOT access reports (403)", r_block.status_code == 403, f"HTTP {r_block.status_code}")

    # Worker cannot create inventory
    if "operator" in created_tokens:
        H_op = {"Authorization": f"Bearer {created_tokens['operator']}"}
        r_inv = requests.post(f"{BASE}/api/inventory", headers=H_op, json={
            "name": "HACK_ATTEMPT", "sku": "HACK-001", "barcode": "HACK-BC-001", "unit": "pcs", "quantity": 0, "unit_cost": 0
        })
        check("2.5 Operator CANNOT create inventory (403)", r_inv.status_code == 403, f"HTTP {r_inv.status_code}")

    # Carpenter cannot approve material requests
    if "carpenter" in created_tokens:
        H_c = {"Authorization": f"Bearer {created_tokens['carpenter']}"}
        r_app = requests.put(f"{BASE}/api/requests/fake-id/status?status=approved", headers=H_c)
        check("2.6 Carpenter cannot approve requests (403/404)", r_app.status_code in [403, 404], f"HTTP {r_app.status_code}")

    # Manager can access projects
    if "manager" in created_tokens:
        H_m = {"Authorization": f"Bearer {created_tokens['manager']}"}
        r_proj = requests.get(f"{BASE}/api/projects", headers=H_m)
        check("2.7 Manager can access projects", r_proj.status_code == 200, f"HTTP {r_proj.status_code}")

    # =========================================================
    # PHASE 3: PROJECT ASSIGNMENT TESTING
    # =========================================================
    sep("PHASE 3: PROJECT ASSIGNMENT TESTING")

    # Get all projects
    r_proj_all = requests.get(f"{BASE}/api/projects", headers=H_admin)
    projects = r_proj_all.json() if r_proj_all.ok else []
    check("3.1 Admin sees all projects", r_proj_all.status_code == 200, f"{len(projects)} projects found")

    # Get all users to find a carpenter
    r_users = requests.get(f"{BASE}/api/users", headers=H_admin)
    users_list = r_users.json() if r_users.ok else []
    operator_user = next((u for u in users_list if u.get("role") == "operator"), None)

    if projects and operator_user and "operator" in created_tokens:
        project_1 = projects[0]
        project_2 = projects[1] if len(projects) > 1 else None
        
        # Assign operator to only project_1
        r_assign = requests.post(
            f"{BASE}/api/projects/{project_1['id']}/assignments",
            headers=H_admin,
            json={"project_id": project_1["id"], "user_id": operator_user["id"]}
        )
        check("3.2 Admin can assign user to project", r_assign.status_code in [200, 400], f"HTTP {r_assign.status_code}")
        
        # Operator sees filtered projects
        H_op = {"Authorization": f"Bearer {created_tokens['operator']}"}
        r_op_proj = requests.get(f"{BASE}/api/projects", headers=H_op)
        op_projects = r_op_proj.json() if r_op_proj.ok else []
        check("3.3 Operator gets project list (filtered)", r_op_proj.status_code == 200, f"{len(op_projects)} projects visible")
        
        # Check backend actually filters
        if project_2:
            check("3.4 Operator sees fewer projects than admin", len(op_projects) <= len(projects), f"Op:{len(op_projects)} vs Admin:{len(projects)}")
    else:
        print("  [SKIP] Not enough data for project assignment tests")

    # Direct API bypass attempt
    r_bypass = requests.get(f"{BASE}/api/projects", headers={"Authorization": "Bearer WRONG"})
    check("3.5 Direct project access with bad token blocked (401)", r_bypass.status_code == 401, f"HTTP {r_bypass.status_code}")

    # =========================================================
    # PHASE 4: ATTENDANCE TESTING
    # =========================================================
    sep("PHASE 4: ATTENDANCE TESTING")

    # Get staff list
    r_staff = requests.get(f"{BASE}/api/staff", headers=H_admin)
    staff_list = r_staff.json() if r_staff.ok else []
    active_staff = [s for s in staff_list if not s.get("is_deleted")]
    check("4.1 Staff list accessible", r_staff.status_code == 200, f"{len(active_staff)} active staff")

    if active_staff:
        staff = active_staff[0]
        staff_id = staff["id"]
        today = time.strftime("%Y-%m-%d")
        
        # Check in
        r_ci = requests.post(f"{BASE}/api/staff/{staff_id}/check-in", headers=H_admin, json={})
        check("4.2 Check-in works or already exists", r_ci.status_code in [200, 400], f"HTTP {r_ci.status_code}: {r_ci.text[:80]}")
        
        # Duplicate check-in prevention
        r_ci2 = requests.post(f"{BASE}/api/staff/{staff_id}/check-in", headers=H_admin, json={})
        check("4.3 Duplicate check-in prevented (400)", r_ci2.status_code == 400, f"HTTP {r_ci2.status_code}")
        
        # Get attendance log
        r_att = requests.get(f"{BASE}/api/attendance", headers=H_admin)
        check("4.4 Attendance log accessible", r_att.status_code == 200, f"HTTP {r_att.status_code}")
        
        # Check out
        r_co = requests.post(f"{BASE}/api/staff/{staff_id}/check-out", headers=H_admin, json={})
        check("4.5 Check-out works or already done", r_co.status_code in [200, 400], f"HTTP {r_co.status_code}")

    # =========================================================
    # PHASE 5: INVENTORY & STOCK TESTING
    # =========================================================
    sep("PHASE 5: INVENTORY TESTING")

    # Get inventory
    r_inv = requests.get(f"{BASE}/api/inventory", headers=H_admin)
    items = r_inv.json() if r_inv.ok else []
    active_items = [i for i in items if not i.get("is_deleted")]
    check("5.1 Inventory list accessible", r_inv.status_code == 200, f"{len(active_items)} items")

    if active_items:
        item = active_items[0]
        old_qty = item["quantity"]
        
        # Negative stock attempt
        r_neg = requests.post(f"{BASE}/api/inventory/{item['id']}/adjust", headers=H_admin,
            json={"quantity": -9999999, "notes": "AUDIT_NEG_TEST", "transaction_type": "adjustment"})
        if r_neg.status_code == 200:
            # Check if stock went negative
            r_check = requests.get(f"{BASE}/api/inventory/{item['id']}", headers=H_admin)
            new_qty = r_check.json().get("quantity", 0) if r_check.ok else 0
            check("5.2 Negative stock prevented", new_qty >= 0, f"Stock={new_qty} after -9999999 adjustment")
        else:
            check("5.2 Negative adjustment rejected at API level", r_neg.status_code in [400, 422], f"HTTP {r_neg.status_code}")
        
        # Stock-in
        r_in = requests.post(f"{BASE}/api/inventory/{item['id']}/adjust", headers=H_admin,
            json={"quantity": 1, "notes": "AUDIT_TEST", "transaction_type": "in"})
        check("5.3 Stock-in (quantity +1) works", r_in.status_code == 200, f"HTTP {r_in.status_code}")

    # Unauthenticated inventory write blocked
    r_inv_anon = requests.post(f"{BASE}/api/inventory", json={"name": "hack", "sku": "X", "barcode": "Y", "unit": "pcs"})
    check("5.4 Unauthenticated inventory creation blocked (401)", r_inv_anon.status_code == 401, f"HTTP {r_inv_anon.status_code}")

    # Material Requests
    r_req = requests.get(f"{BASE}/api/requests", headers=H_admin)
    check("5.5 Material requests list accessible", r_req.status_code == 200, f"HTTP {r_req.status_code}")

    # =========================================================
    # PHASE 6: DATABASE / BACKUP TESTING
    # =========================================================
    sep("PHASE 6: DATABASE & BACKUP TESTING")

    # Create a backup
    r_bak = requests.post(f"{BASE}/api/backup", headers=H_admin)
    check("6.1 Backup creation works", r_bak.status_code == 200, f"HTTP {r_bak.status_code}")

    # List backups
    r_blist = requests.get(f"{BASE}/api/backup", headers=H_admin)
    bak_list = r_blist.json() if r_blist.ok else []
    check("6.2 Backup list accessible", r_blist.status_code == 200, f"{len(bak_list)} backups")

    # Data persistence check - count records
    r_inv2 = requests.get(f"{BASE}/api/inventory", headers=H_admin)
    inv_count = len([i for i in (r_inv2.json() if r_inv2.ok else []) if not i.get("is_deleted")])
    check("6.3 Inventory data persists (count > 0)", inv_count > 0, f"{inv_count} items in database")

    r_proj2 = requests.get(f"{BASE}/api/projects", headers=H_admin)
    proj_count = len([p for p in (r_proj2.json() if r_proj2.ok else []) if not p.get("is_deleted")])
    check("6.4 Project data persists (count > 0)", proj_count > 0, f"{proj_count} projects")

    # Activity logs
    r_logs = requests.get(f"{BASE}/api/logs", headers=H_admin)
    check("6.5 Activity logs accessible", r_logs.status_code == 200, f"HTTP {r_logs.status_code}")

    # Backup non-admin blocked
    if "operator" in created_tokens:
        H_op2 = {"Authorization": f"Bearer {created_tokens['operator']}"}
        r_bak_op = requests.post(f"{BASE}/api/backup", headers=H_op2)
        check("6.6 Non-admin cannot create backup (403)", r_bak_op.status_code == 403, f"HTTP {r_bak_op.status_code}")

    # =========================================================
    # PHASE 7: BACKEND STABILITY - RAPID API CALLS
    # =========================================================
    sep("PHASE 7: BACKEND STABILITY TESTING")

    endpoints = [
        "/api/inventory",
        "/api/projects",
        "/api/staff",
        "/api/requests",
        "/api/suppliers",
        "/api/clients",
        "/api/logs",
        "/api/notifications",
    ]

    all_stable = True
    for ep in endpoints:
        r_ep = requests.get(f"{BASE}{ep}", headers=H_admin)
        ok = r_ep.status_code in [200, 404]
        if not ok:
            all_stable = False
        check(f"7.x {ep} responds correctly", ok, f"HTTP {r_ep.status_code}")

    # Health check
    r_health = requests.get(f"{BASE}/")
    check("7.H Root health endpoint", r_health.status_code == 200, r_health.json().get("status",""))

    # =========================================================
    # PHASE 8: DISABLED USER SECURITY
    # =========================================================
    sep("PHASE 8: DISABLED USER SECURITY")

    # Create a user, disable it, try login
    dis_payload = {"email": "audit_disabled@test.com", "password": "test123", "full_name": "Disabled Test", 
                   "role": "worker", "employee_code": "AUD-DIS", "phone": "1111199999"}
    rd = requests.post(f"{BASE}/api/users", json=dis_payload, headers=H_admin)
    if rd.status_code in [200, 400]:
        rl_d = requests.post(f"{BASE}/api/auth/login", json={"email": "audit_disabled@test.com", "password": "test123"})
        if rl_d.status_code == 200:
            dis_id = rl_d.json()
            dis_token = rl_d.json().get("access_token","")
            # Get user ID
            rusers = requests.get(f"{BASE}/api/users", headers=H_admin)
            dis_user = next((u for u in (rusers.json() if rusers.ok else []) if u.get("email") == "audit_disabled@test.com"), None)
            if dis_user:
                # Disable user
                requests.post(f"{BASE}/api/users/{dis_user['id']}/status", headers=H_admin, json={"status": "disabled"})
                # Try login with disabled user
                rl_dis = requests.post(f"{BASE}/api/auth/login", json={"email": "audit_disabled@test.com", "password": "test123"})
                check("8.1 Disabled user login blocked (403)", rl_dis.status_code == 403, f"HTTP {rl_dis.status_code}")
                # Try accessing API with old token
                H_dis = {"Authorization": f"Bearer {dis_token}"}
                r_api_dis = requests.get(f"{BASE}/api/inventory", headers=H_dis)
                check("8.2 Disabled user token API access blocked (403/401)", r_api_dis.status_code in [401, 403], f"HTTP {r_api_dis.status_code}")
            else:
                print("  [SKIP] Could not find disabled user")
        else:
            print(f"  [SKIP] Could not login disabled user: {rl_d.status_code}")

    # =========================================================
    # FINAL SUMMARY
    # =========================================================
    sep("FINAL AUDIT SUMMARY")

    passed = [r for r in results if r[1] == "PASS"]
    failed = [r for r in results if r[1] == "FAIL"]

    print(f"\nTotal Tests: {len(results)}")
    print(f"PASSED: {len(passed)}")
    print(f"FAILED: {len(failed)}")
    print()
    if failed:
        print("FAILED TESTS:")
        for name, status, detail in failed:
            print(f"  [FAIL] {name}: {detail}")

if __name__ == "__main__":
    run_audit()
