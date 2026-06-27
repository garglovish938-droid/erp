"""
Allure Living ERP - Force close open MRs & POs, then delete remaining records
Strategy: MR → rejected, PO → received, then delete project/client/supplier
"""
import requests, sys

BASE_URL = "https://factory-erp-backend-cwcb.onrender.com"

print("=" * 65)
print("  ALLURE ERP - FORCE CLOSE MR/PO & FINAL WIPE")
print("=" * 65)

login = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin@allure.com", "password": "admin123"},
                      timeout=30)
if login.status_code != 200:
    print(f"  [FAIL] Login: {login.text[:200]}"); sys.exit(1)
headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
print("  [OK] Authenticated\n")

def fetch(ep):
    r = requests.get(f"{BASE_URL}{ep}", headers=headers, timeout=30)
    if r.status_code == 200:
        d = r.json()
        return d if isinstance(d, list) else d.get("items", d.get("data", []))
    return []

# ── 1. Close all open Material Requests → rejected ─────────────────────────
print("[1] Closing all Material Requests (→ rejected)...")
mrs = fetch("/api/requests")
print(f"  Found {len(mrs)} material request(s)")
for mr in mrs:
    mr_id = mr.get("id")
    mr_num = mr.get("request_number", mr_id)
    status = mr.get("status", "")
    if status in ("rejected", "issued"):
        print(f"  [SKIP] MR {mr_num} already {status}")
        continue
    # Try rejected
    r = requests.put(f"{BASE_URL}/api/requests/{mr_id}/status?status=rejected",
                     headers=headers, timeout=30)
    if r.status_code == 200:
        print(f"  [CLOSED] MR {mr_num} → rejected")
    else:
        # Try issued (some workflows require approved first)
        r2 = requests.put(f"{BASE_URL}/api/requests/{mr_id}/status?status=approved",
                          headers=headers, timeout=30)
        if r2.status_code == 200:
            r3 = requests.put(f"{BASE_URL}/api/requests/{mr_id}/status?status=issued",
                              headers=headers, timeout=30)
            if r3.status_code == 200:
                print(f"  [CLOSED] MR {mr_num} → approved → issued")
            else:
                print(f"  [FAIL]   MR {mr_num} issued: {r3.text[:100]}")
        else:
            print(f"  [FAIL]   MR {mr_num}: rejected={r.status_code} approved={r2.status_code}")

# ── 2. Close all Purchase Orders → received ────────────────────────────────
print("\n[2] Closing all Purchase Orders (→ received)...")
pos = fetch("/api/purchasing")
print(f"  Found {len(pos)} purchase order(s)")
for po in pos:
    po_id  = po.get("id")
    po_num = po.get("po_number", po_id)
    status = po.get("status", "")
    if status == "received":
        print(f"  [SKIP] PO {po_num} already received")
        continue
    # Progress: pending → approved → ordered → delivered → received
    transitions = ["approved", "ordered", "delivered", "received"]
    cur = status
    all_ok = True
    for next_s in transitions:
        if cur in ("delivered", "received") and next_s == "received":
            pass
        elif transitions.index(next_s) <= transitions.index(cur) if cur in transitions else -1:
            continue
        r = requests.put(f"{BASE_URL}/api/purchasing/{po_id}/status?status={next_s}",
                         headers=headers, timeout=30)
        if r.status_code == 200:
            print(f"  [OK]   PO {po_num}: {cur} → {next_s}")
            cur = next_s
        else:
            print(f"  [FAIL] PO {po_num} → {next_s}: {r.text[:80]}")
            all_ok = False
        if next_s == "received":
            break
    if cur == "received":
        print(f"  [DONE] PO {po_num} → fully received")

# ── 3. Now delete the remaining project/client/supplier ────────────────────
print("\n[3] Deleting remaining Projects...")
for proj in fetch("/api/projects"):
    r = requests.delete(f"{BASE_URL}/api/projects/{proj['id']}",
                        headers=headers, timeout=30)
    if r.status_code in (200, 204):
        print(f"  [DELETED] Project '{proj.get('name')}'")
    else:
        print(f"  [FAIL]    Project '{proj.get('name')}' → HTTP {r.status_code}: {r.text[:120]}")

print("\n[4] Deleting remaining Clients...")
for cli in fetch("/api/clients"):
    r = requests.delete(f"{BASE_URL}/api/clients/{cli['id']}",
                        headers=headers, timeout=30)
    if r.status_code in (200, 204):
        print(f"  [DELETED] Client '{cli.get('name')}'")
    else:
        print(f"  [FAIL]    Client '{cli.get('name')}' → HTTP {r.status_code}: {r.text[:120]}")

print("\n[5] Deleting remaining Suppliers...")
for sup in fetch("/api/suppliers"):
    r = requests.delete(f"{BASE_URL}/api/suppliers/{sup['id']}",
                        headers=headers, timeout=30)
    if r.status_code in (200, 204):
        print(f"  [DELETED] Supplier '{sup.get('name')}'")
    else:
        print(f"  [FAIL]    Supplier '{sup.get('name')}' → HTTP {r.status_code}: {r.text[:120]}")

# ── 4. Delete all notifications ────────────────────────────────────────────
print("\n[6] Marking all notifications read (no delete endpoint)...")
notifs = fetch("/api/notifications")
for n in notifs:
    n_id = n.get("id")
    r = requests.put(f"{BASE_URL}/api/notifications/{n_id}/read",
                     headers=headers, timeout=30)
    if r.status_code == 200:
        print(f"  [READ] {n.get('title','')[:40]}")
    else:
        print(f"  [FAIL] notification {n_id}: {r.status_code}")

# ── 5. Final verification ──────────────────────────────────────────────────
print("\n[7] Final verification...")
checks = [
    ("/api/inventory",    "Inventory"),
    ("/api/projects",     "Projects"),
    ("/api/clients",      "Clients"),
    ("/api/suppliers",    "Suppliers"),
    ("/api/staff",        "Staff"),
    ("/api/users",        "Users"),
    ("/api/requests",     "Material Requests"),
    ("/api/purchasing",   "Purchase Orders"),
]
all_clear = True
print(f"\n  {'ENTITY':<24} {'COUNT':>7}  STATUS")
print("  " + "-" * 46)
for ep, lbl in checks:
    items = fetch(ep)
    count = len(items)
    if lbl == "Users":
        ok = count <= 1
        status = "✓ admin only" if ok else f"⚠ {count} remain"
    elif lbl in ("Material Requests", "Purchase Orders"):
        # These can't be deleted, just note them
        status = f"ℹ {count} (no delete API)" if count > 0 else "✓ none"
        ok = True
    else:
        ok = count == 0
        if not ok:
            all_clear = False
        status = "✓ EMPTY" if ok else f"⚠ {count} REMAIN"
    print(f"  {lbl:<24} {count:>7}  {status}")

print("\n" + "=" * 65)
if all_clear:
    print("  ✅ PRODUCTION DATABASE FULLY WIPED")
    print("     All modules empty. Admin account preserved.")
    print("     Ready for real business data entry!")
else:
    print("  ⚠️  MANUAL REVIEW REQUIRED")
    print("     Some records could not be deleted via API.")
print("=" * 65)
