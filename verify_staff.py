import requests
r = requests.post("http://localhost:8000/api/auth/login", json={"email": "admin@allure.com", "password": "admin123"})
H = {"Authorization": "Bearer " + r.json()["access_token"]}
r2 = requests.get("http://localhost:8000/api/staff", headers=H)
staff = r2.json()
active = [s for s in staff if not s.get("is_deleted")]
print(f"Active staff: {len(active)}")
for s in active:
    name = s.get("name", "?")
    role = s.get("role", "?")
    print(f"  {name} | {role}")
print("RESULT:", "PASS" if len(active) >= 3 else "FAIL")
