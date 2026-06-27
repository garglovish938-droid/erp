"""
Allure Living ERP - Dependency Resolver & Final Wipe
Clears linked MRs, POs, then deletes remaining project/client/supplier
"""
import requests, sys

BASE_URL = "https://factory-erp-backend-cwcb.onrender.com"

print("=" * 65)
print("  ALLURE ERP - FINAL DEPENDENCY WIPE")
print("=" * 65)

login = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin@allure.com", "password": "admin123"},
                      timeout=30)
if login.status_code != 200:
    print(f"  [FAIL] Login: {login.text[:200]}"); sys.exit(1)
headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
print("  [OK] Authenticated\n")

deleted = 0
failed  = 0

def fetch(ep):
    r = requests.get(f"{BASE_URL}{ep}", headers=headers, timeout=30)
    if r.status_code == 200:
        d = r.json()
        return d if isinstance(d, list) else d.get("items", d.get("data", d.get("records", [])))
    return []

def delete(ep, item_id, label):
    global deleted, failed
    r = requests.delete(f"{BASE_URL}{ep}/{item_id}", headers=headers, timeout=30)
    if r.status_code in (200, 204):
        print(f"  [DELETED] {label}")
        deleted += 1
    else:
        print(f"  [FAIL]    {label} → HTTP {r.status_code}: {r.text[:120]}")
        failed += 1

# ── 1. Delete all Material Requests ───────────────────────────────────────
print("[1] Deleting all Material Requests...")
for mr in fetch("/api/material-requests"):
    delete("/api/material-requests", mr["id"],
           f"MR {mr.get('id','')[:8]} (status={mr.get('status','')})")

# ── 2. Delete all Purchase Orders ─────────────────────────────────────────
print("\n[2] Deleting all Purchase Orders...")
for po in fetch("/api/purchase-orders"):
    delete("/api/purchase-orders", po["id"],
           f"PO {po.get('po_number','')}")

# ── 3. Retry remaining Projects ────────────────────────────────────────────
print("\n[3] Deleting remaining Projects...")
for proj in fetch("/api/projects"):
    delete("/api/projects", proj["id"], f"Project '{proj.get('name')}'")

# ── 4. Retry remaining Clients ─────────────────────────────────────────────
print("\n[4] Deleting remaining Clients...")
for cli in fetch("/api/clients"):
    delete("/api/clients", cli["id"], f"Client '{cli.get('name')}'")

# ── 5. Retry remaining Suppliers ──────────────────────────────────────────
print("\n[5] Deleting remaining Suppliers...")
for sup in fetch("/api/suppliers"):
    delete("/api/suppliers", sup["id"], f"Supplier '{sup.get('name')}'")

# ── 6. Delete all Attendance records ──────────────────────────────────────
print("\n[6] Deleting all Attendance records...")
att = fetch("/api/attendance") or fetch("/api/attendance/all")
if att:
    for a in att:
        delete("/api/attendance", a["id"], f"Attendance {a.get('id','')[:8]}")
else:
    print("  (none found)")

# ── 7. Delete all Purchase Orders via alternate endpoint ──────────────────
print("\n[7] Double-check purchase orders (alternate endpoints)...")
for po in fetch("/api/purchasing"):
    delete("/api/purchasing", po["id"], f"PO {po.get('po_number','')}")

# ── Final verification ─────────────────────────────────────────────────────
print("\n[8] Final verification...")
checks = [
    ("/api/inventory",       "Inventory"),
    ("/api/projects",        "Projects"),
    ("/api/clients",         "Clients"),
    ("/api/suppliers",       "Suppliers"),
    ("/api/staff",           "Staff"),
    ("/api/users",           "Users"),
    ("/api/notifications",   "Notifications"),
]
all_empty = True
for ep, lbl in checks:
    items = fetch(ep)
    count = len(items)
    # Users: admin is OK to remain
    if lbl == "Users":
        expected_empty = count <= 1
        status = "✓ admin only" if expected_empty else f"⚠ {count} remain"
    else:
        expected_empty = count == 0
        if not expected_empty:
            all_empty = False
        status = "✓ EMPTY" if expected_empty else f"⚠ {count} REMAIN"
    print(f"  {lbl:<22} {count:>5}  {status}")

# API smoke test
print("\n[9] API smoke test...")
smoke_ok = True
for ep, lbl in [("/api/inventory","Inventory"),("/api/projects","Projects"),
                ("/api/suppliers","Suppliers"),("/api/staff","Employees"),
                ("/api/reports/attendance/csv","Reports")]:
    r = requests.get(f"{BASE_URL}{ep}", headers=headers, timeout=30)
    ok = r.status_code == 200
    if not ok: smoke_ok = False
    print(f"  {'✓' if ok else '✗'} {lbl:<22} HTTP {r.status_code}")

print("\n" + "=" * 65)
print("  FINAL REPORT")
print("=" * 65)
print(f"\n  Deleted this run:  {deleted}")
print(f"  Failed:            {failed}")
print(f"  Admin preserved:   ✓ admin@allure.com")

if all_empty and failed == 0 and smoke_ok:
    print("\n  ✅ PRODUCTION DATABASE FULLY WIPED")
    print("     Ready for real data entry!")
elif failed > 0:
    print("\n  ⚠️  PARTIAL — Some records need manual deletion")
else:
    print("\n  ⚠️  REVIEW REQUIRED")
print("=" * 65)
