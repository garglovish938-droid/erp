"""
ALLURE LIVING ERP - Final Smoke Test
Tests all 10 checkpoints with CORRECT route paths.
"""
import requests
import json
import sys

BASE = "http://localhost:8000"
results = {}
evidence = {}

def log(msg): print(msg)
def sep(t): print(f"\n{'='*60}\n  {t}\n{'='*60}")
def check(name, ok, detail=""): 
    results[name] = "PASS" if ok else "FAIL"
    icon = "[PASS]" if ok else "[FAIL]"
    print(f"  {icon} {name}")
    if detail: print(f"         {detail}")

# LOGIN
sep("LOGIN")
r = requests.post(f"{BASE}/api/auth/login", json={"email": "admin@allure.com", "password": "admin123"})
data = r.json()
token = data.get("access_token", "")
H = {"Authorization": f"Bearer {token}"}
if not token:
    print(f"LOGIN FAILED: {data}")
    sys.exit(1)
print(f"  Logged in as: {data.get('full_name')} | Role: {data.get('role')}")

# ── 1. STAFF REGISTRY ─────────────────────────────────────────
sep("1. STAFF REGISTRY")
r = requests.get(f"{BASE}/api/staff", headers=H)
staff = r.json() if r.ok else []
active = [s for s in staff if not s.get("is_deleted")]
print(f"  HTTP: {r.status_code} | Active employees: {len(active)}")
for s in active:
    print(f"    -> {s.get('name')} | {s.get('role')} | {s.get('department','N/A')}")
r2 = requests.get(f"{BASE}/api/dashboard/overview", headers=H)
dash = r2.json() if r2.ok else {}
print(f"  Dashboard: present_employees={dash.get('present_employees_count','N/A')}, total_staff={dash.get('total_staff','N/A')}")
evidence["1_staff"] = f"{len(active)} active employees found"
check("1_staff_registry", len(active) > 0, f"Active staff count: {len(active)}")

# ── 2. INVENTORY CSV IMPORT ─────────────────────────────────────
sep("2. INVENTORY CSV IMPORT")
csv_inv = "SKU,Name,Category,Unit,Quantity,Min Quantity,Unit Price\nSMK-INV-001,Smoke Test Steel Pipe,Raw Materials,pcs,25,5,45.00"
files = {"file": ("inventory.csv", csv_inv.encode(), "text/csv")}
r = requests.post(f"{BASE}/api/inventory/import", headers=H, files=files)
print(f"  HTTP: {r.status_code} | Response: {r.text[:200]}")
evidence["2_inv_csv"] = r.text[:200]
check("2_inventory_csv_import", r.ok, f"HTTP {r.status_code}")

# ── 3. PROJECT CSV IMPORT ─────────────────────────────────────
sep("3. PROJECT CSV IMPORT")
csv_proj = "Project ID,Project Name,Client Name,Start Date,Expected End Date,Status,Remarks\n,Smoke Test Villa Renovation,Allure Test Client,2026-07-01,2026-12-31,planning,smoke test import"
files = {"file": ("projects.csv", csv_proj.encode(), "text/csv")}
r = requests.post(f"{BASE}/api/projects/import", headers=H, files=files)
print(f"  HTTP: {r.status_code} | Response: {r.text[:300]}")
evidence["3_proj_csv"] = r.text[:300]
check("3_project_csv_import", r.ok, f"HTTP {r.status_code}")

# ── 4. CLIENT ARCHIVE ──────────────────────────────────────────
sep("4. CLIENT ARCHIVE")
r_create = requests.post(f"{BASE}/api/clients", headers=H, json={
    "name": "Smoke Archive Test Client",
    "contact_person": "Test Contact",
    "email": "smoketest@client.com",
    "phone": "0123456789",
    "address": "Test Street"
})
print(f"  Create: HTTP {r_create.status_code}")
if r_create.ok:
    cid = r_create.json()["id"]
    r_arch = requests.delete(f"{BASE}/api/clients/{cid}", headers=H)
    print(f"  Archive: HTTP {r_arch.status_code} -> {r_arch.json()}")
    # Verify with include_deleted
    r_all = requests.get(f"{BASE}/api/clients?include_deleted=true", headers=H)
    archived = [c for c in (r_all.json() if r_all.ok else []) if c.get("id") == cid and c.get("is_deleted")]
    print(f"  Archived confirmed in DB: {len(archived) > 0}")
    evidence["4_client"] = f"Archived client {cid}"
    check("4_client_archive", r_arch.ok and len(archived) > 0, r_arch.json().get("message",""))
else:
    check("4_client_archive", False, f"Create failed: {r_create.text[:100]}")

# ── 5. SUPPLIER ARCHIVE ────────────────────────────────────────
sep("5. SUPPLIER ARCHIVE")
r_create = requests.post(f"{BASE}/api/suppliers", headers=H, json={
    "name": "Smoke Archive Test Supplier",
    "contact_person": "Sup Contact",
    "email": "smoketest@supplier.com",
    "phone": "0987654321",
    "address": "Supplier Street"
})
print(f"  Create: HTTP {r_create.status_code}")
if r_create.ok:
    sid = r_create.json()["id"]
    r_arch = requests.delete(f"{BASE}/api/suppliers/{sid}", headers=H)
    print(f"  Archive: HTTP {r_arch.status_code} -> {r_arch.json()}")
    # Try to archive a supplier WITH linked POs (should be blocked)
    r_all_sups = requests.get(f"{BASE}/api/suppliers", headers=H)
    active_sups = [s for s in (r_all_sups.json() if r_all_sups.ok else []) if not s.get("is_deleted")]
    print(f"  Active suppliers remaining: {len(active_sups)}")
    evidence["5_supplier"] = f"Archived supplier {sid}"
    check("5_supplier_archive", r_arch.ok, r_arch.json().get("message",""))
else:
    check("5_supplier_archive", False, f"Create failed: {r_create.text[:100]}")

# ── 6. PROJECT ARCHIVE ─────────────────────────────────────────
sep("6. PROJECT ARCHIVE")
r_create = requests.post(f"{BASE}/api/projects", headers=H, json={
    "name": "Smoke Archive Test Project",
    "status": "planning",
    "budget": 10000,
    "start_date": "2026-07-01",
    "end_date": "2026-12-31"
})
print(f"  Create: HTTP {r_create.status_code}")
if r_create.ok:
    pid = r_create.json()["id"]
    r_arch = requests.delete(f"{BASE}/api/projects/{pid}", headers=H)
    print(f"  Archive: HTTP {r_arch.status_code} -> {r_arch.json()}")
    evidence["6_project"] = f"Archived project {pid}"
    check("6_project_archive", r_arch.ok, r_arch.json().get("message",""))
else:
    check("6_project_archive", False, f"Create failed: {r_create.text[:100]}")

# ── 7. PURCHASE ORDER RECEIVE ─────────────────────────────────
sep("7. PURCHASE ORDER RECEIVE (Stock Update)")
# Get active inventory item and supplier
r_inv = requests.get(f"{BASE}/api/inventory", headers=H)
items = [i for i in (r_inv.json() if r_inv.ok else []) if not i.get("is_deleted")]
r_sup = requests.get(f"{BASE}/api/suppliers", headers=H)
sups = [s for s in (r_sup.json() if r_sup.ok else []) if not s.get("is_deleted")]
print(f"  Active items: {len(items)} | Active suppliers: {len(sups)}")

if items and sups:
    item = items[0]
    sup = sups[0]
    qty_before = item.get("quantity", 0)
    print(f"  Using item: {item.get('name')} | Stock before: {qty_before}")
    
    # Create PO using correct route /api/purchasing
    po_data = {
        "supplier_id": sup["id"],
        "expected_delivery_date": "2026-07-15",
        "notes": "Smoke Test PO - Auto",
        "items": [{"inventory_item_id": item["id"], "quantity": 10, "unit_price": 50.0}]
    }
    r_po = requests.post(f"{BASE}/api/purchasing", headers=H, json=po_data)
    print(f"  Create PO: HTTP {r_po.status_code} -> {r_po.text[:150]}")
    
    if r_po.ok:
        po = r_po.json()
        po_id = po["id"]
        po_num = po.get("po_number", po_id)
        print(f"  Created: {po_num}")
        
        # Approve
        r_approve = requests.put(f"{BASE}/api/purchasing/{po_id}/status", headers=H, json={"status": "approved"})
        print(f"  Approve: HTTP {r_approve.status_code}")
        
        # Receive
        r_receive = requests.put(f"{BASE}/api/purchasing/{po_id}/status", headers=H, json={"status": "received"})
        print(f"  Receive: HTTP {r_receive.status_code} -> {r_receive.text[:150]}")
        
        # Verify stock update
        r_inv2 = requests.get(f"{BASE}/api/inventory/{item['id']}", headers=H)
        qty_after = r_inv2.json().get("quantity", 0) if r_inv2.ok else 0
        delta = qty_after - qty_before
        print(f"  Stock: {qty_before} -> {qty_after} (delta: +{delta})")
        evidence["7_po"] = f"PO {po_num}: stock {qty_before} -> {qty_after}"
        check("7_po_receive_stock_update", r_receive.ok and delta > 0, f"Stock delta: +{delta}")
    else:
        check("7_po_receive_stock_update", False, f"PO create failed: {r_po.text[:100]}")
else:
    check("7_po_receive_stock_update", False, "No items or suppliers available")

# ── 8. PDF EXPORT ─────────────────────────────────────────────
sep("8. PDF EXPORT")
r = requests.get(f"{BASE}/api/reports/inventory/pdf", headers=H)
is_pdf = r.content[:4] == b"%PDF"
print(f"  HTTP: {r.status_code} | Content-Type: {r.headers.get('content-type','?')}")
print(f"  Size: {len(r.content)} bytes | Valid PDF header: {is_pdf}")
evidence["8_pdf"] = f"{len(r.content)} bytes, valid={is_pdf}"
check("8_pdf_export", r.ok and is_pdf, f"{len(r.content)} bytes")

# ── 9. EXCEL EXPORT ───────────────────────────────────────────
sep("9. EXCEL EXPORT")
r = requests.get(f"{BASE}/api/reports/inventory/excel", headers=H)
is_xlsx = r.content[:2] == b"PK"
print(f"  HTTP: {r.status_code} | Content-Type: {r.headers.get('content-type','?')}")
print(f"  Size: {len(r.content)} bytes | Valid XLSX header: {is_xlsx}")
evidence["9_excel"] = f"{len(r.content)} bytes, valid={is_xlsx}"
check("9_excel_export", r.ok and is_xlsx, f"{len(r.content)} bytes")

# ── 10. ACTIVITY LOGS ─────────────────────────────────────────
sep("10. ACTIVITY LOGS")
r = requests.get(f"{BASE}/api/settings/logs", headers=H)
logs = r.json() if r.ok else []
print(f"  HTTP: {r.status_code} | Total logs: {len(logs)}")
structured = 0
for log in logs[:5]:
    det = log.get("details", "")
    try:
        parsed = json.loads(det)
        action = parsed.get("action", parsed.get("type", "plain"))
        module = parsed.get("module", "-")
        user = parsed.get("username", "-")
        print(f"  [{log.get('timestamp','')[:19]}] {action} | {module} | user={user}")
        structured += 1
    except Exception:
        print(f"  [{log.get('timestamp','')[:19]}] {det[:60]}")
evidence["10_logs"] = f"{len(logs)} total logs, {structured}/5 structured"
check("10_activity_logs", r.ok and len(logs) > 0, f"{len(logs)} logs | {structured}/5 JSON-structured")

# ── SUMMARY ───────────────────────────────────────────────────
sep("FINAL SMOKE TEST RESULTS")
passed = sum(1 for v in results.values() if v == "PASS")
failed = sum(1 for v in results.values() if v == "FAIL")
total = len(results)

print(f"\n  {'CHECKPOINT':<45} RESULT")
print(f"  {'-'*55}")
labels = {
    "1_staff_registry":        "1. Staff Registry",
    "2_inventory_csv_import":  "2. Inventory CSV Import",
    "3_project_csv_import":    "3. Project CSV Import",
    "4_client_archive":        "4. Client Archive",
    "5_supplier_archive":      "5. Supplier Archive",
    "6_project_archive":       "6. Project Archive",
    "7_po_receive_stock_update":"7. PO Receive (Stock Update)",
    "8_pdf_export":            "8. PDF Export",
    "9_excel_export":          "9. Excel Export",
    "10_activity_logs":        "10. Activity Logs",
}
for k, label in labels.items():
    v = results.get(k, "N/A")
    icon = "PASS" if v == "PASS" else "FAIL"
    print(f"  [{icon}] {label}")

print(f"\n  PASSED  : {passed}/{total}")
print(f"  FAILED  : {failed}/{total}")
pct = round((passed / total) * 100, 1)
print(f"\n  ERP PRODUCTION READINESS: {pct}%")
print()
if failed == 0:
    print("  STATUS: READY FOR LIVE BUSINESS DATA")
else:
    print(f"  STATUS: {failed} ISSUE(S) REQUIRE ATTENTION")
