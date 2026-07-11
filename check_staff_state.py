import requests

BASE = "http://localhost:8000"
login = requests.post(f"{BASE}/api/auth/login", json={"email": "admin@allure.com", "password": "admin123"})
token = login.json()["access_token"]
H = {"Authorization": f"Bearer {token}"}

# 1. Staff state
print("=== STAFF STATE ===")
r = requests.get(f"{BASE}/api/staff?include_deleted=true", headers=H)
staff = r.json()
for s in staff:
    name = s.get("name", "?")
    status = s.get("status", "?")
    deleted = s.get("is_deleted", False)
    print(f"  {name} | status={status} | is_deleted={deleted}")

# 2. Check projects import route - try PUT vs POST
print("\n=== PROJECTS IMPORT ROUTE ===")
proj_csv = "Project ID,Project Name,Client Name,Start Date,Expected End Date,Status,Remarks\nPROJ-SMOKE,Smoke Test Project,,2026-01-01,2026-12-31,planning,smoke test"
for method in ["POST", "PUT"]:
    files = {"file": ("proj.csv", proj_csv.encode(), "text/csv")}
    if method == "POST":
        r = requests.post(f"{BASE}/api/projects/import", headers=H, files=files)
    else:
        r = requests.put(f"{BASE}/api/projects/import", headers=H, files=files)
    print(f"  {method} /api/projects/import: {r.status_code} -> {r.text[:100]}")

# 3. Check Inventory CSV format - print what headers backend expects
print("\n=== INVENTORY CSV CORRECT FORMAT ===")
csv_data = "SKU,Name,Category,Unit,Quantity,Min Quantity,Unit Price\nSMK-001,Test Pipe,Raw Materials,pcs,10,2,15.00"
files = {"file": ("inv.csv", csv_data.encode(), "text/csv")}
r = requests.post(f"{BASE}/api/inventory/import", headers=H, files=files)
print(f"  POST /api/inventory/import: {r.status_code} -> {r.text[:200]}")

# 4. Check PO workflow - full create+approve+receive
print("\n=== PO FULL WORKFLOW ===")
# Get inventory item
r_inv = requests.get(f"{BASE}/api/inventory", headers=H)
items = r_inv.json()
active_items = [i for i in items if not i.get("is_deleted")]
print(f"  Active inventory items: {len(active_items)}")

r_sup = requests.get(f"{BASE}/api/suppliers", headers=H)
sups = [s for s in r_sup.json() if not s.get("is_deleted")]
print(f"  Active suppliers: {len(sups)}")

if active_items and sups:
    item = active_items[0]
    sup = sups[0]
    
    # Create PO
    po_data = {
        "supplier_id": sup["id"],
        "inventory_id": item["id"],
        "quantity": 5,
        "unit_cost": 100.0
    }
    r_create = requests.post(f"{BASE}/api/purchasing", headers=H, json=po_data)
    print(f"  Create PO: {r_create.status_code} -> {r_create.text[:150]}")
    
    if r_create.ok:
        po = r_create.json()
        po_id = po["id"]
        po_num = po.get("po_number", po_id)
        print(f"  PO Created: {po_num}")
        
        # Approve
        r_approve = requests.put(f"{BASE}/api/purchasing/{po_id}/status?status=approved", headers=H)
        print(f"  Approve PO: {r_approve.status_code} -> {r_approve.text[:100]}")
        
        # Get stock before
        r_inv2 = requests.get(f"{BASE}/api/inventory/{item['id']}", headers=H)
        qty_before = r_inv2.json().get("quantity", 0) if r_inv2.ok else "?"
        print(f"  Stock before receive: {qty_before}")
        
        # Receive goods
        r_receive = requests.put(f"{BASE}/api/purchasing/{po_id}/status?status=received", headers=H)
        print(f"  Receive Goods: {r_receive.status_code} -> {r_receive.text[:150]}")
        
        # Get stock after
        r_inv3 = requests.get(f"{BASE}/api/inventory/{item['id']}", headers=H)
        qty_after = r_inv3.json().get("quantity", 0) if r_inv3.ok else "?"
        print(f"  Stock after receive: {qty_after}")
        
        if isinstance(qty_before, (int, float)) and isinstance(qty_after, (int, float)):
            diff = qty_after - qty_before
            print(f"  Stock delta: +{diff} ({'PASS' if diff > 0 else 'FAIL - no change'})")

# 5. PDF and Excel exports
print("\n=== PDF EXPORT ===")
r = requests.get(f"{BASE}/api/reports/inventory/pdf", headers=H)
print(f"  HTTP: {r.status_code} | Type: {r.headers.get('content-type','?')} | Size: {len(r.content)} bytes | Valid: {r.content[:4] == b'%PDF'}")

print("\n=== EXCEL EXPORT ===")
r = requests.get(f"{BASE}/api/reports/inventory/excel", headers=H)
print(f"  HTTP: {r.status_code} | Type: {r.headers.get('content-type','?')} | Size: {len(r.content)} bytes | Valid: {r.content[:2] == b'PK'}")

# 6. Activity Logs sample
print("\n=== ACTIVITY LOGS ===")
r = requests.get(f"{BASE}/api/settings/logs", headers=H)
logs = r.json() if r.ok else []
print(f"  Total logs: {len(logs)}")
for log in logs[:3]:
    import json
    det = log.get("details", "")
    try:
        parsed = json.loads(det)
        print(f"  [{log.get('timestamp','')}] {parsed.get('action','?')} | {parsed.get('module','?')} | user={parsed.get('username','?')}")
    except Exception:
        print(f"  [{log.get('timestamp','')}] {det[:60]}")
