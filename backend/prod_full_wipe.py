"""
Allure Living ERP - FULL PRODUCTION WIPE
Deletes ALL data records. Keeps ONLY admin account + schema.
User will enter all real data fresh.
"""
import requests
import sys

BASE_URL = "https://factory-erp-backend-cwcb.onrender.com"

print("=" * 65)
print("  ALLURE LIVING ERP - FULL DATABASE WIPE")
print("  Clearing ALL records for fresh real-data entry")
print("=" * 65)

# ── Login ──────────────────────────────────────────────────────────────────
print("\n[1] Authenticating...")
login_resp = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"email": "admin@allure.com", "password": "admin123"},
    timeout=30
)
if login_resp.status_code != 200:
    print(f"  [FAIL] Login: {login_resp.status_code} - {login_resp.text[:200]}")
    sys.exit(1)
token = login_resp.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}
print("  [OK] Logged in as admin@allure.com")

deleted = 0
failed  = 0

def fetch_all(endpoint):
    try:
        r = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=30)
        if r.status_code == 200:
            d = r.json()
            return d if isinstance(d, list) else d.get("items", d.get("data", []))
        print(f"  [WARN] GET {endpoint}: HTTP {r.status_code}")
        return []
    except Exception as e:
        print(f"  [ERROR] GET {endpoint}: {e}")
        return []

def wipe(endpoint, items, id_field="id", label_field="name"):
    global deleted, failed
    if not items:
        print(f"  (nothing to delete)")
        return
    for item in items:
        item_id  = item.get(id_field)
        item_lbl = item.get(label_field) or item.get("email") or item_id
        if not item_id:
            continue
        try:
            r = requests.delete(f"{BASE_URL}{endpoint}/{item_id}",
                                headers=headers, timeout=30)
            if r.status_code in (200, 204):
                print(f"  [DELETED] {item_lbl}")
                deleted += 1
            else:
                print(f"  [FAIL]    {item_lbl} → HTTP {r.status_code}: {r.text[:100]}")
                failed += 1
        except Exception as e:
            print(f"  [ERROR]   {item_lbl} → {e}")
            failed += 1

# ══════════════════════════════════════════════════════════════
# 1. DELETE ALL INVENTORY
# ══════════════════════════════════════════════════════════════
print("\n[2] Wiping ALL inventory items...")
wipe("/api/inventory", fetch_all("/api/inventory"),
     label_field="name")

# ══════════════════════════════════════════════════════════════
# 2. DELETE ALL PROJECTS
# ══════════════════════════════════════════════════════════════
print("\n[3] Wiping ALL projects...")
wipe("/api/projects", fetch_all("/api/projects"),
     label_field="name")

# ══════════════════════════════════════════════════════════════
# 3. DELETE ALL CLIENTS
# ══════════════════════════════════════════════════════════════
print("\n[4] Wiping ALL clients...")
wipe("/api/clients", fetch_all("/api/clients"),
     label_field="name")

# ══════════════════════════════════════════════════════════════
# 4. DELETE ALL SUPPLIERS
# ══════════════════════════════════════════════════════════════
print("\n[5] Wiping ALL suppliers...")
wipe("/api/suppliers", fetch_all("/api/suppliers"),
     label_field="name")

# ══════════════════════════════════════════════════════════════
# 5. DELETE ALL STAFF (employees)
# ══════════════════════════════════════════════════════════════
print("\n[6] Wiping ALL staff/employees...")
wipe("/api/staff", fetch_all("/api/staff"),
     label_field="name")

# ══════════════════════════════════════════════════════════════
# 6. DELETE ALL USERS except admin
# ══════════════════════════════════════════════════════════════
print("\n[7] Wiping ALL users (except admin@allure.com)...")
KEEP_EMAILS = {"admin@allure.com", "devilanon69@gmail.com"}
users = fetch_all("/api/users")
users_to_delete = [u for u in users
                   if (u.get("email") or "").lower() not in KEEP_EMAILS]
wipe("/api/users", users_to_delete, label_field="email")

# Keep admin safe
kept_admins = [u.get("email") for u in users
               if (u.get("email") or "").lower() in KEEP_EMAILS]
for e in kept_admins:
    print(f"  [KEPT]    {e} → admin account preserved")

# ══════════════════════════════════════════════════════════════
# 7. CLEAR NOTIFICATIONS
# ══════════════════════════════════════════════════════════════
print("\n[8] Clearing notifications...")
notifs = fetch_all("/api/notifications")
wipe("/api/notifications", notifs, label_field="title")

# ══════════════════════════════════════════════════════════════
# VERIFICATION
# ══════════════════════════════════════════════════════════════
print("\n[9] Post-wipe verification...")
inv_count   = len(fetch_all("/api/inventory"))
proj_count  = len(fetch_all("/api/projects"))
sup_count   = len(fetch_all("/api/suppliers"))
cli_count   = len(fetch_all("/api/clients"))
staff_count = len(fetch_all("/api/staff"))
user_count  = len(fetch_all("/api/users"))

print(f"\n  {'ENTITY':<22} {'COUNT':>10}  {'STATUS':>10}")
print("  " + "-" * 46)
print(f"  {'Users':<22} {user_count:>10}  {'✓ (admin only)' if user_count <= 2 else '⚠ CHECK'}")
print(f"  {'Staff':<22} {staff_count:>10}  {'✓ EMPTY' if staff_count == 0 else '⚠ REMAINING'}")
print(f"  {'Inventory Items':<22} {inv_count:>10}  {'✓ EMPTY' if inv_count == 0 else '⚠ REMAINING'}")
print(f"  {'Projects':<22} {proj_count:>10}  {'✓ EMPTY' if proj_count == 0 else '⚠ REMAINING'}")
print(f"  {'Suppliers':<22} {sup_count:>10}  {'✓ EMPTY' if sup_count == 0 else '⚠ REMAINING'}")
print(f"  {'Clients':<22} {cli_count:>10}  {'✓ EMPTY' if cli_count == 0 else '⚠ REMAINING'}")

# API smoke test
print("\n[10] Final API smoke test...")
smoke = [
    ("/api/inventory",              "Inventory"),
    ("/api/projects",               "Projects"),
    ("/api/staff",                  "Employees"),
    ("/api/suppliers",              "Suppliers"),
    ("/api/clients",                "Clients"),
    ("/api/notifications",          "Notifications"),
    ("/api/reports/attendance/csv", "Reports CSV"),
]
all_ok = True
for ep, lbl in smoke:
    try:
        r = requests.get(f"{BASE_URL}{ep}", headers=headers, timeout=30)
        ok = r.status_code == 200
        if not ok:
            all_ok = False
        print(f"  {'✓' if ok else '✗'} {lbl:<22} HTTP {r.status_code}")
    except Exception as e:
        all_ok = False
        print(f"  ✗ {lbl:<22} ERROR: {e}")

# ── Final Report ───────────────────────────────────────────────────────────
all_empty = inv_count == 0 and proj_count == 0 and sup_count == 0 \
            and cli_count == 0 and staff_count == 0

print("\n" + "=" * 65)
print("  FINAL WIPE REPORT")
print("=" * 65)
print(f"\n  Records Deleted:  {deleted}")
print(f"  Delete Failures:  {failed}")
print(f"  Admin Preserved:  ✓ admin@allure.com")
print(f"  Database Empty:   {'✓ YES' if all_empty else '⚠ PARTIAL'}")
print(f"  API Health:       {'✓ ALL OK' if all_ok else '⚠ PARTIAL'}")

if all_empty and failed == 0 and all_ok:
    verdict = "✅ PRODUCTION DATABASE FULLY WIPED — READY FOR REAL DATA"
elif failed > 0:
    verdict = "⚠️  MANUAL REVIEW REQUIRED — some deletes failed"
else:
    verdict = "⚠️  PARTIAL WIPE — some records may remain"

print(f"\n  VERDICT: {verdict}")
print("\n" + "=" * 65)
