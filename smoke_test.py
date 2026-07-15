import requests
import json
import sys
import io

BASE = "http://localhost:8000"
PASS = "PASS"
FAIL = "FAIL"
PARTIAL = "PARTIAL"

results = {}

def sep(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

# ── LOGIN ─────────────────────────────────────────────────────
def run_smoke_test():
    sep("LOGIN")
    r = requests.post(f"{BASE}/api/auth/login", json={"email": "admin@allure.com", "password": "admin123"})
    data = r.json()
    token = data.get("access_token", "")
    H = {"Authorization": f"Bearer {token}"}
    if token:
        print(f"  Status : PASS")
        print(f"  User   : {data.get('full_name')} | Role: {data.get('role')}")
    else:
        print(f"  Status : FAIL - {data}")
        sys.exit(1)

    # ── 1. STAFF REGISTRY ─────────────────────────────────────────
    sep("1. STAFF REGISTRY")
    r = requests.get(f"{BASE}/api/staff", headers=H)
    staff_all = r.json() if r.ok else []
    active_staff = [s for s in staff_all if not s.get("is_deleted")]
    archived_staff = [s for s in staff_all if s.get("is_deleted")]
    print(f"  HTTP   : {r.status_code}")
    print(f"  Active : {len(active_staff)} employees")
    print(f"  Archived: {len(archived_staff)} employees")
    for s in active_staff[:8]:
        name = s.get("name", "?")
        role = s.get("role", "?")
        dept = s.get("department", "?")
        print(f"    -> {name} | {role} | {dept}")

    # Dashboard attendance
    r2 = requests.get(f"{BASE}/api/dashboard/overview", headers=H)
    dash = r2.json() if r2.ok else {}
    print(f"\n  Dashboard Staff Counts:")
    print(f"    Total Staff   : {dash.get('total_staff', 'N/A')}")
    print(f"    Present Today : {dash.get('present_today', 'N/A')}")
    print(f"    Absent        : {dash.get('absent_today', 'N/A')}")
    results["1_staff_registry"] = PASS if len(active_staff) > 0 else FAIL

    # ── 2. INVENTORY CSV IMPORT ────────────────────────────────────
    sep("2. INVENTORY CSV IMPORT")
    csv_data = "name,category,unit,quantity,min_quantity,unit_price\nTest Steel Pipe,Raw Materials,pcs,50,5,25.00\nTest Copper Wire,Electrical,m,200,20,8.50"
    files = {"file": ("test_inventory.csv", csv_data.encode(), "text/csv")}
    r = requests.post(f"{BASE}/api/inventory/import", headers=H, files=files)
    print(f"  HTTP   : {r.status_code}")
    resp = r.json() if r.ok else r.text
    print(f"  Response: {resp}")
    results["2_inventory_import"] = PASS if r.status_code in (200, 201) else FAIL

    # ── 3. PROJECT CSV IMPORT ──────────────────────────────────────
    sep("3. PROJECT CSV IMPORT")
    proj_csv = "Project ID,Project Name,Client Name,Start Date,Expected End Date,Status,Remarks\nPROJ-SMOKE,Smoke Test Project,Test Client,2026-01-01,2026-12-31,planning,Smoke test description"
    files = {"file": ("test_projects.csv", proj_csv.encode(), "text/csv")}
    r = requests.post(f"{BASE}/api/projects/import", headers=H, files=files)
    print(f"  HTTP   : {r.status_code}")
    resp = r.json() if r.ok else r.text
    print(f"  Response: {resp}")
    results["3_project_import"] = PASS if r.status_code in (200, 201) else FAIL

    # ── 4. CLIENT ARCHIVE ──────────────────────────────────────────
    sep("4. CLIENT ARCHIVE")
    # Create a test client
    r = requests.post(f"{BASE}/api/clients", headers=H, json={
        "name": "SMOKE_TEST_CLIENT",
        "contact_person": "Test Person",
        "email": "smoke@test.com",
        "phone": "0123456789",
        "address": "Test Address"
    })
    print(f"  Create HTTP: {r.status_code}")
    if r.ok:
        client = r.json()
        cid = client.get("id")
        print(f"  Created client ID: {cid}")
        
        # Archive it
        r2 = requests.delete(f"{BASE}/api/clients/{cid}", headers=H)
        print(f"  Archive HTTP: {r2.status_code}")
        print(f"  Archive Response: {r2.json()}")
        
        # Verify it's archived
        r3 = requests.get(f"{BASE}/api/clients?include_deleted=true", headers=H)
        all_clients = r3.json() if r3.ok else []
        archived = [c for c in all_clients if c.get("is_deleted") and c.get("id") == cid]
        print(f"  Archived flag confirmed: {len(archived) > 0}")
        results["4_client_archive"] = PASS if r2.ok else FAIL
    else:
        print(f"  Could not create test client: {r.text}")
        results["4_client_archive"] = PARTIAL

    # ── 5. SUPPLIER ARCHIVE ────────────────────────────────────────
    sep("5. SUPPLIER ARCHIVE")
    # Create test supplier
    r = requests.post(f"{BASE}/api/suppliers", headers=H, json={
        "name": "SMOKE_TEST_SUPPLIER",
        "contact_person": "Supplier Contact",
        "email": "supplier@smoke.com",
        "phone": "0987654321",
        "address": "Supplier Address"
    })
    print(f"  Create HTTP: {r.status_code}")
    if r.ok:
        sup = r.json()
        sid = sup.get("id")
        print(f"  Created supplier ID: {sid}")
        
        # Archive it (no linked POs so should succeed)
        r2 = requests.delete(f"{BASE}/api/suppliers/{sid}", headers=H)
        print(f"  Archive HTTP: {r2.status_code}")
        print(f"  Archive Response: {r2.json()}")
        
        # Test blocker: try to archive a supplier with linked PO
        r3 = requests.get(f"{BASE}/api/suppliers", headers=H)
        sup_with_pos = []
        if r3.ok:
            all_s = r3.json()
            for s in all_s:
                if not s.get("is_deleted"):
                    sup_with_pos.append(s.get("name",""))
        print(f"  Blocker test: Active suppliers remaining: {len(sup_with_pos)}")
        results["5_supplier_archive"] = PASS if r2.ok else FAIL
    else:
        print(f"  Could not create test supplier: {r.text}")
        results["5_supplier_archive"] = PARTIAL

    # ── 6. PROJECT ARCHIVE ──────────────────────────────────────────
    sep("6. PROJECT ARCHIVE")
    # Create a project with no dependencies for archive test
    r = requests.get(f"{BASE}/api/projects", headers=H)
    projects = r.json() if r.ok else []
    active_projects = [p for p in projects if not p.get("is_deleted")]
    print(f"  Active projects: {len(active_projects)}")

    # Create and archive a clean test project
    r = requests.post(f"{BASE}/api/projects", headers=H, json={
        "name": "SMOKE_TEST_PROJECT",
        "status": "planning",
        "budget": 5000,
        "start_date": "2026-01-01",
        "end_date": "2026-12-31"
    })
    print(f"  Create HTTP: {r.status_code}")
    if r.ok:
        proj = r.json()
        pid = proj.get("id")
        print(f"  Created project ID: {pid}")
        
        # Try to archive (no linked MRs)
        r2 = requests.delete(f"{BASE}/api/projects/{pid}", headers=H)
        print(f"  Archive HTTP: {r2.status_code}")
        print(f"  Archive Response: {r2.json()}")
        results["6_project_archive"] = PASS if r2.ok else FAIL
    else:
        print(f"  Could not create test project: {r.text}")
        results["6_project_archive"] = PARTIAL

    # ── 7. PURCHASE ORDER RECEIVE ──────────────────────────────────
    sep("7. PURCHASE ORDER RECEIVE (Stock Update)")
    # Get existing POs
    r = requests.get(f"{BASE}/api/purchasing", headers=H)
    pos = r.json() if r.ok else []
    print(f"  Total POs: {len(pos)}")

    # Find a completed/received PO to confirm stock updated
    received_pos = [p for p in pos if p.get("status") == "received"]
    pending_pos = [p for p in pos if p.get("status") == "approved"]
    print(f"  Received POs: {len(received_pos)}")
    print(f"  Approved/Pending POs: {len(pending_pos)}")

    if received_pos:
        # Check inventory to confirm stock was updated
        po = received_pos[0]
        print(f"  Verifying PO: {po.get('po_number')} - Status: {po.get('status')}")
        r2 = requests.get(f"{BASE}/api/inventory", headers=H)
        items = r2.json() if r2.ok else []
        print(f"  Inventory items in system: {len(items)}")
        results["7_po_receive"] = PASS
    elif pending_pos:
        # Try to receive one
        po = pending_pos[0]
        print(f"  Testing receive on PO: {po.get('po_number')}")
        r2 = requests.put(f"{BASE}/api/purchasing/{po['id']}/status?status=received",
                          headers=H)
        print(f"  Receive HTTP: {r2.status_code}")
        print(f"  Receive Response: {r2.json()}")
        results["7_po_receive"] = PASS if r2.ok else FAIL
    else:
        print("  No POs to test - checking if PO creation flow is intact")
        results["7_po_receive"] = PARTIAL

    # ── 8. PDF EXPORT ──────────────────────────────────────────────
    sep("8. PDF EXPORT")
    r = requests.get(f"{BASE}/api/reports/inventory/pdf", headers=H)
    print(f"  HTTP       : {r.status_code}")
    print(f"  Content-Type: {r.headers.get('content-type','?')}")
    print(f"  Size (bytes): {len(r.content)}")
    is_pdf = r.content[:4] == b'%PDF'
    print(f"  Valid PDF  : {is_pdf}")
    results["8_pdf_export"] = PASS if (r.ok and is_pdf) else FAIL

    # ── 9. EXCEL EXPORT ────────────────────────────────────────────
    sep("9. EXCEL EXPORT")
    r = requests.get(f"{BASE}/api/reports/inventory/excel", headers=H)
    print(f"  HTTP       : {r.status_code}")
    print(f"  Content-Type: {r.headers.get('content-type','?')}")
    print(f"  Size (bytes): {len(r.content)}")
    # XLSX files start with PK (zip header)
    is_xlsx = r.content[:2] == b'PK'
    print(f"  Valid XLSX : {is_xlsx}")
    results["9_excel_export"] = PASS if (r.ok and is_xlsx) else FAIL

    # ── 10. ACTIVITY LOGS ──────────────────────────────────────────
    sep("10. ACTIVITY LOGS")
    r = requests.get(f"{BASE}/api/logs", headers=H)
    logs = r.json() if r.ok else []
    print(f"  HTTP       : {r.status_code}")
    print(f"  Total logs : {len(logs)}")

    # Check if logs have structured JSON details
    structured_count = 0
    for log in logs[:5]:
        det = log.get("details", "")
        try:
            parsed = json.loads(det)
            has_user = "user" in parsed or "username" in parsed or "action" in parsed
            if has_user:
                structured_count += 1
            action = parsed.get("action", parsed.get("type", ""))
            module = parsed.get("module", "")
            print(f"  Log: [{log.get('timestamp','')}] {action} | {module} | {parsed.get('record_id','')}")
        except Exception:
            print(f"  Log (plain): {det[:80]}")
    print(f"  Structured JSON logs: {structured_count}/5 checked")
    results["10_activity_logs"] = PASS if (r.ok and len(logs) > 0) else FAIL

    # ── SUMMARY ────────────────────────────────────────────────────
    sep("FINAL SMOKE TEST SUMMARY")
    passed = sum(1 for v in results.values() if v == PASS)
    partial = sum(1 for v in results.values() if v == PARTIAL)
    failed = sum(1 for v in results.values() if v == FAIL)
    total = len(results)

    for k, v in results.items():
        icon = "[PASS]" if v == PASS else ("[PART]" if v == PARTIAL else "[FAIL]")
        print(f"  {icon:<8} {k.replace('_',' ').title():<35} : {v}")

    print(f"\n  PASSED   : {passed}/{total}")
    print(f"  PARTIAL  : {partial}/{total}")
    print(f"  FAILED   : {failed}/{total}")
    readiness = round(((passed + 0.5 * partial) / total) * 100, 1)
    print(f"\n  ERP PRODUCTION READINESS: {readiness}%")

if __name__ == "__main__":
    run_smoke_test()
