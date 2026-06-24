"""
Allure Living ERP - FULL WIPE (keep only user accounts)
Removes ALL demo data: inventory, projects, clients, suppliers, staff, etc.
Only the 5 user login accounts are preserved.
"""
import sqlite3
import os

DB_PATH = "./erp.db"
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

print("=" * 55)
print("  FULL WIPE - REMOVING ALL DEMO DATA")
print("=" * 55)
print("\nSirf 5 user accounts bachenge, baaki sab delete...\n")

# Get all tables
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [row[0] for row in c.fetchall()]
print("Tables found:", tables)
print()

# Tables to completely wipe (NOT users)
wipe_tables = [
    "inventory",
    "stock_transactions",
    "projects",
    "project_assignments",
    "clients",
    "suppliers",
    "staff",
    "attendance",
    "material_requests",
    "activity_logs",
    "notifications",
    "login_history",
    "categories",
    "tasks",
    "documents",
    "custom_fields",
    "custom_field_values",
    "approval_rules",
    "workflows",
    "versions",
    "work_logs",
    "purchasing",
    "bom",
    "bill_of_materials",
]

for table in wipe_tables:
    if table in tables:
        c.execute(f"DELETE FROM {table}")
        print(f"  [-] Wiped table: {table} ({c.rowcount} rows deleted)")
    else:
        print(f"  [=] Table not found (skip): {table}")

# Verify users are safe
c.execute("SELECT COUNT(*) FROM users WHERE is_deleted=0")
user_count = c.fetchone()[0]
print(f"\n  [SAFE] Users preserved: {user_count}")

conn.commit()
conn.close()

# Remove backup files
bak_dir = "./backups"
if os.path.exists(bak_dir):
    files = os.listdir(bak_dir)
    for f in files:
        os.remove(os.path.join(bak_dir, f))
    print(f"  [-] Removed {len(files)} backup files")

print("\n" + "=" * 55)
print("  DATABASE FULLY WIPED")
print("=" * 55)

# Final verify
conn2 = sqlite3.connect(DB_PATH)
c2 = conn2.cursor()

c2.execute("SELECT email, role, employee_code FROM users WHERE is_deleted=0 ORDER BY role")
users = c2.fetchall()
print(f"\nREMAINING USERS ({len(users)}):")
for u in users:
    print(f"  {u[0]} | {u[1]} | {u[2]}")

# Check all other tables are empty
print("\nALL OTHER TABLES:")
for table in ["inventory", "projects", "clients", "suppliers", "staff", "attendance", "categories"]:
    if table in tables:
        c2.execute(f"SELECT COUNT(*) FROM {table}")
        cnt = c2.fetchone()[0]
        status = "EMPTY" if cnt == 0 else f"WARNING: {cnt} rows remain!"
        print(f"  {table}: {status}")

conn2.close()

print("\nDatabase bilkul clean hai!")
print("Ab aap apna real data add kar sakte hain.")
