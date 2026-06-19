"""
Final targeted verification for the 2 remaining failing checkpoints.
"""
import requests

BASE = "http://localhost:8000"
r = requests.post(f"{BASE}/api/auth/login", json={"email": "admin@allure.com", "password": "admin123"})
token = r.json()["access_token"]
H = {"Authorization": f"Bearer {token}"}

# --- CHECK 1: STAFF REGISTRY ---
print("=== 1. STAFF REGISTRY ===")
r = requests.get(f"{BASE}/api/staff", headers=H)
staff = r.json() if r.ok else []
active = [s for s in staff if not s.get("is_deleted")]
print(f"HTTP: {r.status_code} | Active employees: {len(active)}")
for s in active:
    print(f"  -> {s.get('name')} | {s.get('role')} | status={s.get('status')}")
print(f"RESULT: {'PASS' if len(active) > 0 else 'FAIL'}")

# --- CHECK 7: PO RECEIVE ---
print("\n=== 7. PURCHASE ORDER RECEIVE ===")
r_inv = requests.get(f"{BASE}/api/inventory", headers=H)
items = [i for i in (r_inv.json() if r_inv.ok else []) if not i.get("is_deleted")]
r_sup = requests.get(f"{BASE}/api/suppliers", headers=H)
sups = [s for s in (r_sup.json() if r_sup.ok else []) if not s.get("is_deleted")]

item = items[0]
sup = sups[0]
qty_before = item.get("quantity", 0)
print(f"Item: {item.get('name')} | Stock before: {qty_before}")

# Create PO with correct single-item schema
po_data = {
    "supplier_id": sup["id"],
    "inventory_id": item["id"],
    "quantity": 5,
    "unit_cost": 100.0
}
r_create = requests.post(f"{BASE}/api/purchasing", headers=H, json=po_data)
print(f"Create PO: HTTP {r_create.status_code} | {r_create.text[:200]}")

if r_create.ok:
    po = r_create.json()
    po_id = po["id"]
    po_num = po.get("po_number", po_id)
    print(f"PO Created: {po_num}")
    
    # Approve with query param
    r_approve = requests.put(f"{BASE}/api/purchasing/{po_id}/status?status=approved", headers=H)
    print(f"Approve: HTTP {r_approve.status_code}")
    
    # Receive with query param
    r_receive = requests.put(f"{BASE}/api/purchasing/{po_id}/status?status=received", headers=H)
    print(f"Receive: HTTP {r_receive.status_code} | {r_receive.text[:200]}")
    
    # Check stock
    r_inv2 = requests.get(f"{BASE}/api/inventory/{item['id']}", headers=H)
    qty_after = r_inv2.json().get("quantity", 0) if r_inv2.ok else 0
    delta = qty_after - qty_before
    print(f"Stock: {qty_before} -> {qty_after} (delta: +{delta})")
    print(f"RESULT: {'PASS' if delta > 0 else 'FAIL - no stock change'}")
else:
    print(f"RESULT: FAIL - {r_create.text[:200]}")
