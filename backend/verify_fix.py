import requests

BASE = "http://127.0.0.1:8000"
results = []

def t(name, cond, detail=""):
    s = "PASS" if cond else "FAIL"
    results.append((s, name, detail))
    print(f"  [{s}] {name}: {detail}")
    return cond

print("\n=== POST-MIGRATION VERIFICATION ===\n")

# 1. Employee code login
r1 = requests.post(f"{BASE}/api/auth/login", json={"username": "EMP-001", "password": "admin123"})
d1 = r1.json()
token = d1.get("access_token", "")
refresh = d1.get("refresh_token", "")
t("Employee code login EMP-001", r1.status_code == 200, f"HTTP {r1.status_code} role={d1.get('role')} refresh={bool(refresh)}")

# 2. Mobile login
r2 = requests.post(f"{BASE}/api/auth/login", json={"username": "9876543210", "password": "admin123"})
t("Mobile number login 9876543210", r2.status_code == 200, f"HTTP {r2.status_code}")

# 3. Email login
r3 = requests.post(f"{BASE}/api/auth/login", json={"email": "admin@allure.com", "password": "admin123"})
t("Email login admin@allure.com", r3.status_code == 200, f"HTTP {r3.status_code}")
H = {"Authorization": f"Bearer {token}"}

# 4. Refresh token
r4 = requests.post(f"{BASE}/api/auth/refresh", json={"refresh_token": refresh})
t("Refresh token valid", r4.status_code == 200, f"HTTP {r4.status_code}")

# 5. Invalid refresh
r5 = requests.post(f"{BASE}/api/auth/refresh", json={"refresh_token": "INVALID_TOKEN"})
t("Invalid refresh rejected 401", r5.status_code == 401, f"HTTP {r5.status_code}")

# 6. Wrong password
r6 = requests.post(f"{BASE}/api/auth/login", json={"username": "EMP-001", "password": "WRONG"})
t("Wrong password rejected 401", r6.status_code == 401, f"HTTP {r6.status_code}")

# 7. Core endpoints
eps = [
    "/api/inventory", "/api/projects", "/api/staff", "/api/requests",
    "/api/suppliers", "/api/clients", "/api/notifications", "/api/purchasing",
    "/api/attendance", "/api/dashboard/overview", "/api/settings/logs",
    "/api/settings/backups", "/api/auth/me", "/api/tasks"
]
for ep in eps:
    r = requests.get(f"{BASE}{ep}", headers=H)
    t(ep, r.status_code == 200, f"HTTP {r.status_code}")

# 8. Admin check-in (400 not 404 since admin has no staff record)
r_ci = requests.post(f"{BASE}/api/attendance/check-in", headers=H, json={})
t("Admin check-in returns 400 not 404", r_ci.status_code == 400, f"HTTP {r_ci.status_code} {r_ci.json().get('detail','')[:50]}")

# 9. Worker login by employee code
r_wl = requests.post(f"{BASE}/api/auth/login", json={"username": "EMP-104", "password": "staff123"})
t("Worker login by employee code EMP-104", r_wl.status_code == 200, f"HTTP {r_wl.status_code}")

if r_wl.ok:
    Hw = {"Authorization": f"Bearer {r_wl.json().get('access_token', '')}"}
    r_rep = requests.get(f"{BASE}/api/reports/inventory/pdf", headers=Hw)
    t("Worker BLOCKED from inventory report 403", r_rep.status_code == 403, f"HTTP {r_rep.status_code}")
    r_uu = requests.get(f"{BASE}/api/auth/users", headers=Hw)
    t("Worker BLOCKED from user list 403", r_uu.status_code == 403, f"HTTP {r_uu.status_code}")
    r_inv = requests.post(f"{BASE}/api/inventory", headers=Hw, json={"name": "HACK", "sku": "HK", "barcode": "HB", "unit": "pcs", "quantity": 0, "unit_cost": 0})
    t("Worker BLOCKED from creating inventory 403", r_inv.status_code == 403, f"HTTP {r_inv.status_code}")

# 10. Manager login + report access
r_ml = requests.post(f"{BASE}/api/auth/login", json={"username": "EMP-101", "password": "pm123"})
t("Manager login by employee code EMP-101", r_ml.status_code == 200, f"HTTP {r_ml.status_code}")
if r_ml.ok:
    Hm = {"Authorization": f"Bearer {r_ml.json().get('access_token', '')}"}
    r_proj = requests.get(f"{BASE}/api/projects", headers=Hm)
    t("Manager CAN access projects", r_proj.status_code == 200, f"HTTP {r_proj.status_code}")
    r_mu = requests.get(f"{BASE}/api/auth/users", headers=Hm)
    t("Manager BLOCKED from user list 403", r_mu.status_code == 403, f"HTTP {r_mu.status_code}")

# 11. Backup
r_bak = requests.post(f"{BASE}/api/settings/backup", headers=H)
t("Backup creation works", r_bak.status_code == 200, f"HTTP {r_bak.status_code}")

# 12. Unauthenticated access
r_anon = requests.get(f"{BASE}/api/inventory")
t("Unauthenticated access blocked 401", r_anon.status_code == 401, f"HTTP {r_anon.status_code}")

print()
passed = sum(1 for s, _, _ in results if s == "PASS")
failed_tests = [(n, d) for s, n, d in results if s == "FAIL"]
print(f"RESULT: {passed}/{len(results)} PASSED")
if failed_tests:
    print("FAILED:")
    for n, d in failed_tests:
        print(f"  [FAIL] {n}: {d}")
else:
    print("ALL TESTS PASSED!")
