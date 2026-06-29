from fastapi.testclient import TestClient
import os
import sys

# Set path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ["DATABASE_URL"] = "sqlite:///erp.db"

from main import app
import database, models, auth

client = TestClient(app)
db = database.SessionLocal()

users = db.query(models.User).filter(models.User.is_deleted == False).all()
endpoints = [
    '/api/projects',
    '/api/clients',
    '/api/inventory',
    '/api/custom-fields/Project',
    '/api/staff'
]

print(f"Checking {len(users)} users against {len(endpoints)} endpoints...")
failures = []

for u in users:
    token = auth.create_access_token({"sub": u.email, "role": u.role})
    headers = {"Authorization": f"Bearer {token}"}
    for ep in endpoints:
        res = client.get(ep, headers=headers)
        if res.status_code != 200:
            failures.append((u.email, u.role, ep, res.status_code, res.json()))

print(f"Total Failures: {len(failures)}")
for f in failures:
    print(f"User: {f[0]} ({f[1]}) | Endpoint: {f[2]} | Status: {f[3]} | Detail: {f[4]}")
