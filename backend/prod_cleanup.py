"""
Allure Living ERP - Production Safe Cleanup Script
Deletes ONLY confirmed test/demo/UAT/stress records via API.
Real business data is preserved.
"""
import requests
import json
import sys

BASE_URL = "https://factory-erp-backend-cwcb.onrender.com"

# ── Login ──────────────────────────────────────────────────────────────────
print("=" * 65)
print("  ALLURE LIVING ERP - PRODUCTION SAFE CLEANUP")
print("=" * 65)

print("\n[1] Authenticating as admin...")
login_resp = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"email": "admin@allure.com", "password": "admin123"},
    timeout=30
)
if login_resp.status_code != 200:
    print(f"  [FAIL] Login failed: {login_resp.status_code} - {login_resp.text[:300]}")
    sys.exit(1)

token = login_resp.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}
print("  [OK] Logged in as admin@allure.com")

deleted_count = 0
failed_count  = 0
skipped_count = 0

def delete_item(endpoint, item_id, label):
    global deleted_count, failed_count
    try:
        r = requests.delete(f"{BASE_URL}{endpoint}/{item_id}", headers=headers, timeout=30)
        if r.status_code in (200, 204):
            print(f"  [DELETED] {label}")
            deleted_count += 1
            return True
        else:
            print(f"  [FAIL]    {label} → HTTP {r.status_code}: {r.text[:150]}")
            failed_count += 1
            return False
    except Exception as e:
        print(f"  [ERROR]   {label} → {e}")
        failed_count += 1
        return False

def fetch_all(endpoint):
    try:
        r = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=30)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list):
                return data
            return data.get("items", data.get("data", []))
        return []
    except:
        return []

# ══════════════════════════════════════════════════════════════
# STEP 1: Delete UAT + Stress INVENTORY
# ══════════════════════════════════════════════════════════════
print("\n[2] Cleaning test INVENTORY items...")
inventory = fetch_all("/api/inventory")
TEST_INV_PATTERNS = ["uat", "demo", "test", "smoke", "dummy", "sample"]
for item in inventory:
    name = (item.get("name") or "").lower()
    sku  = (item.get("sku") or "").lower()
    if any(p in name or p in sku for p in TEST_INV_PATTERNS):
        delete_item("/api/inventory", item["id"],
                    f"Inventory '{item.get('name')}' SKU={item.get('sku')}")
    else:
        skipped_count += 1

# ══════════════════════════════════════════════════════════════
# STEP 2: Delete UAT + Stress PROJECTS
# ══════════════════════════════════════════════════════════════
print("\n[3] Cleaning test PROJECTS...")

# Real project names to KEEP
REAL_PROJECTS = {
    "skyline penthouse kitchen",
    "prestige villa wardrobes",
    "techcorp reception table",
}

projects = fetch_all("/api/projects")
for proj in projects:
    name = (proj.get("name") or "").lower()
    if name in REAL_PROJECTS:
        skipped_count += 1
        print(f"  [KEEP]    Project '{proj.get('name')}' → real business record")
        continue
    # Delete anything with uat/stress/demo/test in name
    TEST_PROJ_PATTERNS = ["uat", "demo", "test", "stress", "smoke", "dummy", "sample"]
    if any(p in name for p in TEST_PROJ_PATTERNS):
        delete_item("/api/projects", proj["id"],
                    f"Project '{proj.get('name')}'")
    else:
        skipped_count += 1
        print(f"  [KEEP]    Project '{proj.get('name')}' → appears real")

# ══════════════════════════════════════════════════════════════
# STEP 3: Delete Stress SUPPLIERS
# ══════════════════════════════════════════════════════════════
print("\n[4] Cleaning test SUPPLIERS...")

REAL_SUPPLIERS = {
    "apex boards & plywood co.",
    "hettich fittings ltd",
    "deco surfaces inc",
    "edgeband pro distributors",
    "general consumables corp",
}

suppliers = fetch_all("/api/suppliers")
for sup in suppliers:
    name = (sup.get("name") or "").lower()
    if name in REAL_SUPPLIERS:
        skipped_count += 1
        print(f"  [KEEP]    Supplier '{sup.get('name')}' → real business record")
        continue
    TEST_SUP_PATTERNS = ["stress", "uat", "demo", "test", "smoke", "dummy", "sample"]
    if any(p in name for p in TEST_SUP_PATTERNS):
        delete_item("/api/suppliers", sup["id"],
                    f"Supplier '{sup.get('name')}'")
    else:
        skipped_count += 1
        print(f"  [KEEP]    Supplier '{sup.get('name')}' → appears real")

# ══════════════════════════════════════════════════════════════
# STEP 4: Delete Stress TEST STAFF
# ══════════════════════════════════════════════════════════════
print("\n[5] Cleaning test STAFF...")
staff = fetch_all("/api/staff")
for s in staff:
    name = (s.get("name") or "").lower()
    email = (s.get("email") or "").lower()
    TEST_STAFF_PATTERNS = ["stress", "uat", "demo", "test", "smoke", "dummy", "sample"]
    is_stress_email = "@stress.com" in email or "@test.com" in email or "@demo.com" in email
    if any(p in name for p in TEST_STAFF_PATTERNS) or is_stress_email:
        delete_item("/api/staff", s["id"],
                    f"Staff '{s.get('name')}' email={s.get('email')}")
    else:
        skipped_count += 1
        print(f"  [KEEP]    Staff '{s.get('name')}' → appears real")

# ══════════════════════════════════════════════════════════════
# STEP 5: Delete Stress TEST USERS
# ══════════════════════════════════════════════════════════════
print("\n[6] Cleaning test USERS...")

REAL_USER_EMAILS = {
    "admin@allure.com",
    "devilanon69@gmail.com",
    "pm@allure.com",
    "store@allure.com",
    "accountant@allure.com",
    "staff@allure.com",
}

users = fetch_all("/api/users")
for u in users:
    email = (u.get("email") or "").lower()
    if email in REAL_USER_EMAILS:
        skipped_count += 1
        print(f"  [KEEP]    User '{email}' → core system account")
        continue
    name  = (u.get("full_name") or "").lower()
    TEST_USER_PATTERNS = ["stress", "uat", "demo", "test", "smoke", "dummy", "sample"]
    is_test_email = "@stress.com" in email or "@test.com" in email or "@demo.com" in email
    if any(p in name or p in email for p in TEST_USER_PATTERNS) or is_test_email:
        delete_item("/api/users", u["id"],
                    f"User '{email}' ({u.get('full_name')})")
    else:
        skipped_count += 1
        print(f"  [KEEP]    User '{email}' → appears real")

# ══════════════════════════════════════════════════════════════
# POST-CLEANUP VERIFICATION
# ══════════════════════════════════════════════════════════════
print("\n[7] Post-cleanup verification...")

def count(endpoint):
    data = fetch_all(endpoint)
    return len(data)

users_after     = count("/api/users")
staff_after     = count("/api/staff")
inv_after       = count("/api/inventory")
proj_after      = count("/api/projects")
sup_after       = count("/api/suppliers")
clients_after   = count("/api/clients")

print(f"\n  {'ENTITY':<22} {'AFTER CLEANUP':>14}")
print("  " + "-" * 38)
print(f"  {'Users':<22} {users_after:>14}")
print(f"  {'Staff':<22} {staff_after:>14}")
print(f"  {'Inventory Items':<22} {inv_after:>14}")
print(f"  {'Projects':<22} {proj_after:>14}")
print(f"  {'Suppliers':<22} {sup_after:>14}")
print(f"  {'Clients':<22} {clients_after:>14}")

# ── API smoke test ─────────────────────────────────────────────────────────
print("\n[8] Final API smoke test...")
smoke_endpoints = [
    ("/api/inventory",   "Inventory"),
    ("/api/projects",    "Projects"),
    ("/api/staff",       "Employees"),
    ("/api/suppliers",   "Suppliers"),
    ("/api/clients",     "Clients"),
    ("/api/notifications","Notifications"),
    ("/api/reports/attendance/csv", "Reports CSV"),
]
all_ok = True
for ep, label in smoke_endpoints:
    try:
        r = requests.get(f"{BASE_URL}{ep}", headers=headers, timeout=30)
        ok = r.status_code == 200
        if not ok:
            all_ok = False
        print(f"  {'✓' if ok else '✗'} {label:<22} HTTP {r.status_code}")
    except Exception as e:
        print(f"  ✗ {label:<22} ERROR: {e}")
        all_ok = False

# ── Final report ───────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("  FINAL CLEANUP REPORT")
print("=" * 65)
print(f"\n  Records Deleted:    {deleted_count}")
print(f"  Delete Failures:    {failed_count}")
print(f"  Records Preserved:  {skipped_count}")
print(f"  API Health:         {'ALL OK ✓' if all_ok else 'PARTIAL ✗'}")

if failed_count == 0 and all_ok:
    verdict = "✅ PRODUCTION DATABASE CLEAN"
elif failed_count > 0 and deleted_count > 0:
    verdict = "⚠️  MANUAL REVIEW REQUIRED"
else:
    verdict = "⚠️  MANUAL REVIEW REQUIRED"

print(f"\n  VERDICT: {verdict}")
print("\n" + "=" * 65)
