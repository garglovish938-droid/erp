import sqlite3
import requests
import json
import os

BASE_URL = "http://127.0.0.1:8000"

conn = sqlite3.connect('erp.db')
c = conn.cursor()

print("=" * 60)
print("ALLURE LIVING ERP - SYSTEM VERIFICATION REPORT")
print("=" * 60)

print("\n=== DATABASE TABLES ===")
tables = [row[0] for row in c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
for t in tables:
    print(f"  ✓ {t}")

print("\n=== DATA COUNTS ===")
print(f"  Users (active):      {c.execute('SELECT COUNT(*) FROM users WHERE is_deleted=0').fetchone()[0]}")
print(f"  Staff (active):      {c.execute('SELECT COUNT(*) FROM staff WHERE is_deleted=0').fetchone()[0]}")
print(f"  Attendance records:  {c.execute('SELECT COUNT(*) FROM attendance').fetchone()[0]}")
print(f"  Inventory (active):  {c.execute('SELECT COUNT(*) FROM inventory WHERE is_deleted=0').fetchone()[0]}")
print(f"  Projects (active):   {c.execute('SELECT COUNT(*) FROM projects WHERE is_deleted=0').fetchone()[0]}")
print(f"  Suppliers (active):  {c.execute('SELECT COUNT(*) FROM suppliers WHERE is_deleted=0').fetchone()[0]}")
print(f"  Clients (active):    {c.execute('SELECT COUNT(*) FROM clients WHERE is_deleted=0').fetchone()[0]}")
print(f"  Purchase Orders:     {c.execute('SELECT COUNT(*) FROM purchase_orders WHERE is_deleted=0').fetchone()[0]}")

print("\n=== SHIFTS ===")
shifts = c.execute("SELECT id, name, check_in_time, check_out_time FROM shifts WHERE is_deleted=0").fetchall()
if shifts:
    for s in shifts:
        print(f"  {s[1]}: {s[2]} - {s[3]}")
else:
    print("  (no shifts defined)")

print("\n=== ATTENDANCE RULES ===")
rules = c.execute("SELECT * FROM attendance_rules").fetchall()
if rules:
    for r in rules:
        print(f"  Grace: {r[1]}min, Half-day: {r[2]}hrs, Min hours: {r[3]}hrs")
else:
    print("  (no rules - using defaults)")

print("\n=== STAFF WITH SHIFTS ===")
staff_shifts = c.execute("""
    SELECT s.name, s.role, sh.name as shift_name, u.email, u.employee_code
    FROM staff s 
    LEFT JOIN shifts sh ON s.shift_id = sh.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.is_deleted=0
""").fetchall()
for row in staff_shifts:
    print(f"  {row[0]} ({row[1]}) | Shift: {row[2] or 'None'} | {row[3] or 'No user'}")

print("\n=== ATTENDANCE COLUMNS ===")
cols = c.execute("PRAGMA table_info(attendance)").fetchall()
for col in cols:
    print(f"  {col[1]} ({col[2]})")

print("\n=== RECENT ATTENDANCE ===")
recent = c.execute("""
    SELECT s.name, a.date, a.status, a.check_in, a.check_out, a.check_in_selfie
    FROM attendance a
    JOIN staff s ON a.staff_id = s.id
    ORDER BY a.created_at DESC LIMIT 5
""").fetchall()
for row in recent:
    print(f"  {row[0]} | {row[1]} | {row[2]} | In:{row[3]} Out:{row[4]} | Selfie:{row[5]}")

conn.close()

print("\n=== API HEALTH CHECKS ===")
endpoints = [
    ("GET", "/api/staff", "Staff list"),
    ("GET", "/api/inventory", "Inventory list"),
    ("GET", "/api/projects", "Projects list"),
    ("GET", "/api/suppliers", "Suppliers list"),
    ("GET", "/api/shifts", "Shifts list"),
    ("GET", "/api/settings/attendance-rules", "Attendance rules"),
    ("GET", "/api/notifications", "Notifications"),
]

admin_token = None
try:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@allureliving.com", "password": "Admin@1234"}, timeout=5)
    if r.status_code == 200:
        admin_token = r.json().get("access_token")
        print(f"  Admin Login: ✓ (token obtained)")
    else:
        print(f"  Admin Login: ✗ ({r.status_code})")
except Exception as e:
    print(f"  Admin Login: ✗ ({e})")

headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}

for method, path, label in endpoints:
    try:
        r = requests.get(f"{BASE_URL}{path}", headers=headers, timeout=5)
        status = "✓" if r.status_code == 200 else "✗"
        print(f"  {status} {label}: HTTP {r.status_code}")
    except Exception as e:
        print(f"  ✗ {label}: Error - {e}")

print("\n=== UPLOAD DIRECTORIES ===")
upload_dirs = ["uploads/selfies", "uploads/work_photos"]
for d in upload_dirs:
    exists = os.path.isdir(d)
    if exists:
        files = os.listdir(d)
        print(f"  ✓ {d}: {len(files)} files")
    else:
        print(f"  ✗ {d}: NOT FOUND")

print("\n" + "=" * 60)
print("VERIFICATION COMPLETE")
print("=" * 60)
