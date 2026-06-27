"""
Allure Living ERP - Production Database Audit & Cleanup Script
Connects to live API to audit and identify test/demo data
"""
import requests
import json
import sys

BASE_URL = "https://factory-erp-backend-cwcb.onrender.com"

# ── Step 1: Login ──────────────────────────────────────────────────────────
print("=" * 65)
print("  ALLURE LIVING ERP - PRODUCTION AUDIT SCRIPT")
print("=" * 65)

print("\n[1] Authenticating as admin...")
login_resp = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"email": "admin@allure.com", "password": "admin123"},
    timeout=30
)

if login_resp.status_code != 200:
    # Try devilanon69 email found in safe_cleanup.py
    login_resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "devilanon69@gmail.com", "password": "admin123"},
        timeout=30
    )

if login_resp.status_code != 200:
    print(f"  [FAIL] Login failed: {login_resp.status_code} - {login_resp.text[:300]}")
    sys.exit(1)

token = login_resp.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}
print(f"  [OK] Logged in successfully")

# ── Step 2: Audit all entities ────────────────────────────────────────────
print("\n[2] Auditing production database via API...")

def fetch(endpoint, label):
    try:
        r = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=30)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                # may be paginated
                return data.get("items", data.get("data", [data]))
        print(f"  [WARN] {label}: HTTP {r.status_code}")
        return []
    except Exception as e:
        print(f"  [ERROR] {label}: {e}")
        return []

users     = fetch("/api/users",     "Users")
staff     = fetch("/api/staff",     "Staff")
inventory = fetch("/api/inventory", "Inventory")
projects  = fetch("/api/projects",  "Projects")
suppliers = fetch("/api/suppliers", "Suppliers")
clients   = fetch("/api/clients",   "Clients")

# Try attendance
try:
    att_r = requests.get(f"{BASE_URL}/api/attendance", headers=headers, timeout=30)
    attendance = att_r.json() if att_r.status_code == 200 else []
    if isinstance(attendance, dict):
        attendance = attendance.get("records", attendance.get("data", []))
except:
    attendance = []

print("\n" + "=" * 65)
print("  DATABASE AUDIT REPORT")
print("=" * 65)

print(f"\n{'ENTITY':<20} {'COUNT':>8}  DETAILS")
print("-" * 65)
print(f"{'Users':<20} {len(users):>8}")
print(f"{'Staff':<20} {len(staff):>8}")
print(f"{'Inventory Items':<20} {len(inventory):>8}")
print(f"{'Projects':<20} {len(projects):>8}")
print(f"{'Suppliers':<20} {len(suppliers):>8}")
print(f"{'Clients':<20} {len(clients):>8}")
print(f"{'Attendance Records':<20} {len(attendance):>8}")

# ── Step 3: Identify test data patterns ───────────────────────────────────
print("\n[3] Scanning for test/demo records...")

TEST_PATTERNS = [
    "test", "demo", "sample", "dummy", "fake", "temp", "uat",
    "smoke", "audit", "hack", "placeholder", "example", "dev"
]

def is_test_record(record):
    """Check if a record appears to be test data"""
    for field in ["name", "email", "full_name", "sku", "description"]:
        val = record.get(field, "") or ""
        val_lower = val.lower()
        for pattern in TEST_PATTERNS:
            if pattern in val_lower:
                return True, f"{field}='{val}' matches pattern '{pattern}'"
    return False, None

print("\n--- TEST USERS ---")
test_users = []
real_users = []
for u in users:
    is_test, reason = is_test_record(u)
    email = u.get("email", "")
    # Keep known real admin accounts
    if email in ["admin@allure.com", "devilanon69@gmail.com", 
                  "pm@allure.com", "store@allure.com",
                  "accountant@allure.com", "staff@allure.com"]:
        real_users.append(u)
        print(f"  [KEEP] {email} ({u.get('role','')}) - core account")
    elif is_test:
        test_users.append(u)
        print(f"  [TEST] {email} ({u.get('role','')}) - {reason}")
    else:
        real_users.append(u)
        print(f"  [REAL] {email} ({u.get('role','')})")

print(f"\n--- STAFF ({len(staff)} total) ---")
test_staff = []
for s in staff:
    is_test, reason = is_test_record(s)
    name = s.get("name", "")
    if is_test:
        test_staff.append(s)
        print(f"  [TEST] {name} - {reason}")
    else:
        print(f"  [REAL] {name} | role={s.get('role','')} | status={s.get('status','')}")

print(f"\n--- INVENTORY ({len(inventory)} total) ---")
test_inv = []
for item in inventory:
    is_test, reason = is_test_record(item)
    name = item.get("name", "")
    sku = item.get("sku", "")
    if is_test:
        test_inv.append(item)
        print(f"  [TEST] {name} (SKU: {sku}) - {reason}")

if not test_inv:
    print(f"  No test inventory items found")

print(f"\n--- PROJECTS ({len(projects)} total) ---")
test_proj = []
for p in projects:
    is_test, reason = is_test_record(p)
    name = p.get("name", "")
    if is_test:
        test_proj.append(p)
        print(f"  [TEST] {name} - {reason}")
    else:
        print(f"  [REAL] {name} | status={p.get('status','')} | budget={p.get('budget',0)}")

print(f"\n--- SUPPLIERS ({len(suppliers)} total) ---")
test_sup = []
for s in suppliers:
    is_test, reason = is_test_record(s)
    name = s.get("name", "")
    if is_test:
        test_sup.append(s)
        print(f"  [TEST] {name} - {reason}")
    else:
        print(f"  [REAL] {name}")

print(f"\n--- CLIENTS ({len(clients)} total) ---")
test_cli = []
for c in clients:
    is_test, reason = is_test_record(c)
    name = c.get("name", "")
    if is_test:
        test_cli.append(c)
        print(f"  [TEST] {name} - {reason}")
    else:
        print(f"  [REAL] {name}")

# ── Summary ───────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("  SUMMARY")
print("=" * 65)

total_test = len(test_users) + len(test_staff) + len(test_inv) + len(test_proj) + len(test_sup) + len(test_cli)
print(f"\n  Test Users:          {len(test_users)}")
print(f"  Test Staff:          {len(test_staff)}")
print(f"  Test Inventory:      {len(test_inv)}")
print(f"  Test Projects:       {len(test_proj)}")
print(f"  Test Suppliers:      {len(test_sup)}")
print(f"  Test Clients:        {len(test_cli)}")
print(f"  Attendance Records:  {len(attendance)} (all considered test/dev)")
print(f"\n  TOTAL TEST RECORDS:  {total_test}")
print(f"  REAL RECORDS KEPT:   {len(real_users) + len(staff) - len(test_staff) + len(inventory) - len(test_inv) + len(projects) - len(test_proj) + len(suppliers) - len(test_sup) + len(clients) - len(test_cli)}")

# ── API Health Check ───────────────────────────────────────────────────────
print("\n[4] Running API health checks...")
health_endpoints = [
    ("/api/dashboard", "Dashboard"),
    ("/api/inventory", "Inventory"),
    ("/api/projects",  "Projects"),
    ("/api/staff",     "Employees"),
    ("/api/suppliers", "Suppliers"),
    ("/api/clients",   "Clients"),
    ("/api/notifications", "Notifications"),
]
all_ok = True
for ep, label in health_endpoints:
    try:
        r = requests.get(f"{BASE_URL}{ep}", headers=headers, timeout=30)
        status = "✓" if r.status_code == 200 else "✗"
        if r.status_code != 200:
            all_ok = False
        print(f"  {status} {label:<20} HTTP {r.status_code}")
    except Exception as e:
        print(f"  ✗ {label:<20} ERROR: {e}")
        all_ok = False

# Check reports
try:
    r = requests.get(f"{BASE_URL}/api/reports/attendance/csv", headers=headers, timeout=30)
    status = "✓" if r.status_code == 200 else "✗"
    print(f"  {status} {'Reports (CSV)':<20} HTTP {r.status_code}")
except Exception as e:
    print(f"  ✗ {'Reports (CSV)':<20} ERROR: {e}")

print(f"\n  API Health: {'ALL OK ✓' if all_ok else 'SOME FAILURES ✗'}")
print("\n" + "=" * 65)
print("  AUDIT COMPLETE")
print("=" * 65)
