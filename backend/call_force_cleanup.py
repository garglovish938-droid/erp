import requests, json

BASE_URL = "https://factory-erp-backend-cwcb.onrender.com"

login = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin@allure.com", "password": "admin123"},
                      timeout=30)
if login.status_code != 200:
    print("Login failed:", login.text[:200])
    exit(1)

token = login.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("Logged in OK. Calling force-cleanup endpoint...")

r = requests.delete(f"{BASE_URL}/api/admin/force-cleanup",
                    headers=headers, timeout=60)
print(f"HTTP {r.status_code}")
try:
    print(json.dumps(r.json(), indent=2))
except:
    print(r.text[:500])
