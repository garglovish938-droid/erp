"""
Seed/update existing users with employee codes and ensure all test users have correct data.
Run once after migrate_db.py
"""
import sqlite3
import hashlib

DB_PATH = "./erp.db"
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("\n=== USER SEED/FIX ===\n")

# Fetch existing users
cursor.execute("SELECT id, email, full_name, role, employee_code, status FROM users WHERE is_deleted=0")
users = cursor.fetchall()
print(f"Found {len(users)} existing users:")
for u in users:
    print(f"  {u['email']} | role={u['role']} | emp_code={u['employee_code']} | status={u['status']}")

# Update admin employee code if missing
for u in users:
    if u['email'] == 'admin@allure.com' and not u['employee_code']:
        cursor.execute("UPDATE users SET employee_code='EMP-001', status='active' WHERE id=?", (u['id'],))
        print(f"\n  [+] Updated admin employee_code to EMP-001")
    elif not u['employee_code']:
        # Auto-assign employee code based on index
        emp_code = f"EMP-{100 + users.index(u):03d}"
        cursor.execute("UPDATE users SET employee_code=? WHERE id=?", (emp_code, u['id']))
        print(f"  [+] Auto-assigned employee_code={emp_code} to {u['email']}")
    
    # Ensure status is active for all non-deleted users
    if not u['status']:
        cursor.execute("UPDATE users SET status='active' WHERE id=?", (u['id'],))
        print(f"  [+] Set status=active for {u['email']}")

conn.commit()

# Re-read and print final state
cursor.execute("SELECT email, role, employee_code, status, phone FROM users WHERE is_deleted=0 ORDER BY role")
users = cursor.fetchall()
print("\n=== FINAL USER LIST ===")
print(f"{'Email':<35} {'Role':<15} {'Emp Code':<12} {'Status':<10} {'Phone'}")
print("-" * 90)
for u in users:
    print(f"{u['email']:<35} {u['role']:<15} {u['employee_code'] or 'N/A':<12} {u['status'] or 'N/A':<10} {u['phone'] or 'N/A'}")

conn.close()
print("\n=== USER SEED COMPLETE ===\n")
