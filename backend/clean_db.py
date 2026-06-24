"""
Allure Living ERP - Database Cleanup Script
Removes all test/audit/demo data. Real business data is preserved.
"""
import sqlite3
import os
import shutil

DB_PATH = "./erp.db"
BACKUP_DIR = "./backups"

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

print("=" * 55)
print("  ALLURE LIVING ERP - DATABASE CLEANUP")
print("=" * 55)
print("\nRemoving all test/audit/demo data...\n")

# ─── 1. REMOVE TEST INVENTORY ITEMS ───────────────────────────
print("[1] Cleaning inventory...")

# Remove items clearly added as test data (by SKU pattern or name)
test_inventory_skus = [
    "SMK-INV-001",   # Smoke Test Steel Pipe
    "HACK",          # Audit hack attempt
    "HK-01",
    "HK",
]
test_inventory_names = [
    "Smoke Test",
    "HACK",
    "AUDIT",
]

# Hard delete test inventory items
for sku in test_inventory_skus:
    c.execute("DELETE FROM stock_transactions WHERE inventory_id IN (SELECT id FROM inventory WHERE sku=?)", (sku,))
    c.execute("DELETE FROM inventory WHERE sku=?", (sku,))
    print(f"  [-] Removed inventory item with SKU: {sku}")

for name_part in test_inventory_names:
    c.execute("DELETE FROM stock_transactions WHERE inventory_id IN (SELECT id FROM inventory WHERE name LIKE ?)", (f"%{name_part}%",))
    rows = c.execute("DELETE FROM inventory WHERE name LIKE ?", (f"%{name_part}%",))
    if c.rowcount > 0:
        print(f"  [-] Removed inventory items matching: {name_part}")

# ─── 2. REMOVE TEST PROJECTS ───────────────────────────────────
print("\n[2] Cleaning projects...")

test_project_names = [
    "Smoke Test",
    "Audit Test",
    "HACK_PROJECT",
    "HACK",
]
for name_part in test_project_names:
    # Remove assignments first
    c.execute("""
        DELETE FROM project_assignments WHERE project_id IN
        (SELECT id FROM projects WHERE name LIKE ?)
    """, (f"%{name_part}%",))
    c.execute("DELETE FROM projects WHERE name LIKE ?", (f"%{name_part}%",))
    if c.rowcount > 0:
        print(f"  [-] Removed project: {name_part}")

# ─── 3. REMOVE TEST CLIENTS ────────────────────────────────────
print("\n[3] Cleaning clients...")

test_client_names = [
    "Allure Test Client",
    "Test Client",
    "HACK",
    "Audit",
]
for name in test_client_names:
    c.execute("DELETE FROM clients WHERE name LIKE ?", (f"%{name}%",))
    if c.rowcount > 0:
        print(f"  [-] Removed client: {name}")

# ─── 4. REMOVE TEST USERS ──────────────────────────────────────
print("\n[4] Cleaning test users...")

# Keep only the real 5 users
real_emails = [
    "admin@allure.com",
    "pm@allure.com",
    "store@allure.com",
    "accountant@allure.com",
    "staff@allure.com",
]
test_user_patterns = [
    "%@test.com",
    "%audit_%",
    "%_disabled@%",
    "%hack%",
    "%HACK%",
]
for pattern in test_user_patterns:
    c.execute("DELETE FROM users WHERE email LIKE ? AND email NOT IN ({})".format(
        ",".join(["?" for _ in real_emails])
    ), [pattern] + real_emails)
    if c.rowcount > 0:
        print(f"  [-] Removed test users matching: {pattern}")

# ─── 5. CLEAR ALL ATTENDANCE RECORDS ──────────────────────────
print("\n[5] Clearing attendance records...")
c.execute("SELECT COUNT(*) FROM attendance")
att_count = c.fetchone()[0]
c.execute("DELETE FROM attendance")
print(f"  [-] Removed {att_count} attendance records (all were test check-ins)")

# ─── 6. CLEAR ALL STOCK TRANSACTIONS ──────────────────────────
print("\n[6] Clearing stock transactions...")
c.execute("SELECT COUNT(*) FROM stock_transactions")
txn_count = c.fetchone()[0]
c.execute("DELETE FROM stock_transactions")
print(f"  [-] Removed {txn_count} stock transactions (all test adjustments)")

# ─── 7. CLEAR ALL ACTIVITY LOGS ───────────────────────────────
print("\n[7] Clearing activity logs...")
c.execute("SELECT COUNT(*) FROM activity_logs")
log_count = c.fetchone()[0]
c.execute("DELETE FROM activity_logs")
print(f"  [-] Removed {log_count} activity log entries")

# ─── 8. CLEAR NOTIFICATIONS ────────────────────────────────────
print("\n[8] Clearing notifications...")
c.execute("SELECT COUNT(*) FROM notifications")
notif_count = c.fetchone()[0]
c.execute("DELETE FROM notifications")
print(f"  [-] Removed {notif_count} notifications")

# ─── 9. CLEAR LOGIN HISTORY ────────────────────────────────────
print("\n[9] Clearing login history...")
c.execute("DELETE FROM login_history")
print(f"  [-] Cleared login history")

# ─── 10. CLEAR MATERIAL REQUESTS ──────────────────────────────
print("\n[10] Clearing material requests...")
c.execute("SELECT COUNT(*) FROM material_requests")
mr_count = c.fetchone()[0]
c.execute("DELETE FROM material_requests")
print(f"  [-] Removed {mr_count} material requests (test data)")

# ─── 11. CLEAR PURCHASE ORDERS ────────────────────────────────
print("\n[11] Clearing purchase orders...")
try:
    c.execute("SELECT COUNT(*) FROM purchasing")
    po_count = c.fetchone()[0]
    c.execute("DELETE FROM purchasing")
    print(f"  [-] Removed {po_count} purchase orders (test data)")
except:
    print("  [=] No purchasing table found, skipping")

# ─── 12. CLEAR PROJECT ASSIGNMENTS ────────────────────────────
print("\n[12] Clearing project assignments...")
c.execute("DELETE FROM project_assignments")
print("  [-] Cleared project assignments (reset for real use)")

# ─── 13. CLEAR TASKS ──────────────────────────────────────────
print("\n[13] Clearing tasks...")
try:
    c.execute("SELECT COUNT(*) FROM tasks")
    t_count = c.fetchone()[0]
    c.execute("DELETE FROM tasks")
    print(f"  [-] Removed {t_count} tasks")
except:
    print("  [=] No tasks table found, skipping")

# ─── 14. CLEAR WORK LOGS ──────────────────────────────────────
print("\n[14] Clearing work logs...")
try:
    c.execute("SELECT COUNT(*) FROM work_logs")
    wl_count = c.fetchone()[0]
    c.execute("DELETE FROM work_logs")
    print(f"  [-] Removed {wl_count} work logs")
except:
    print("  [=] No work_logs table found, skipping")

# ─── 15. REMOVE ALL BACKUP FILES ──────────────────────────────
print("\n[15] Removing backup files...")
if os.path.exists(BACKUP_DIR):
    files = os.listdir(BACKUP_DIR)
    for f in files:
        fp = os.path.join(BACKUP_DIR, f)
        os.remove(fp)
        print(f"  [-] Deleted backup: {f}")
    print(f"  [-] Total {len(files)} backup files removed")
else:
    print("  [=] No backups directory found")

# ─── 16. RESET REAL INVENTORY QUANTITIES ──────────────────────
# Reset inventory to realistic starting quantities (undo audit adjustments)
print("\n[16] Resetting real inventory to clean quantities...")

real_inventory_reset = [
    ("PLY-18-MR", 60),      # Plywood 18mm
    ("MDF-12", 60),          # MDF Board
    ("HDW-HNG-SC", 120),    # Cabinet Hinges
    ("LAM-WH-GL-1", 8),     # White Gloss Laminate
    ("ACC-EB-WH-2", 350),   # Edge Banding
    ("CON-PVA-5", 15),      # PVA Wood Glue
]
for sku, qty in real_inventory_reset:
    c.execute("UPDATE inventory SET quantity=? WHERE sku=?", (qty, sku))
    if c.rowcount > 0:
        print(f"  [=] Reset {sku} quantity to {qty}")

conn.commit()

# ─── FINAL STATE ──────────────────────────────────────────────
print("\n" + "=" * 55)
print("  CLEANUP COMPLETE — FINAL STATE")
print("=" * 55)

c.execute("SELECT email, role, employee_code FROM users WHERE is_deleted=0 ORDER BY role")
users = c.fetchall()
print(f"\nUSERS ({len(users)}) - preserved:")
for u in users:
    print(f"  ✓ {u[0]} | {u[1]} | {u[2]}")

c.execute("SELECT name, sku, quantity FROM inventory WHERE is_deleted=0")
inv = c.fetchall()
print(f"\nINVENTORY ({len(inv)} items) - preserved:")
for i in inv:
    print(f"  ✓ {i[0]} | {i[1]} | qty={i[2]}")

c.execute("SELECT name FROM projects WHERE is_deleted=0")
proj = c.fetchall()
print(f"\nPROJECTS ({len(proj)}) - preserved:")
for p in proj:
    print(f"  ✓ {p[0]}")

c.execute("SELECT name FROM clients WHERE is_deleted=0")
cli = c.fetchall()
print(f"\nCLIENTS ({len(cli)}) - preserved:")
for cl in cli:
    print(f"  ✓ {cl[0]}")

c.execute("SELECT name FROM suppliers WHERE is_deleted=0")
sup = c.fetchall()
print(f"\nSUPPLIERS ({len(sup)}) - preserved:")
for s in sup:
    print(f"  ✓ {s[0]}")

c.execute("SELECT name, role FROM staff WHERE is_deleted=0")
stf = c.fetchall()
print(f"\nSTAFF ({len(stf)}) - preserved:")
for s in stf:
    print(f"  ✓ {s[0]} | {s[1]}")

conn.close()

print("\n" + "=" * 55)
print("  DATABASE IS NOW CLEAN & READY FOR REAL DATA")
print("=" * 55)
print("\nSaara test data remove ho gaya.")
print("Ab aap apna real data add kar sakte hain.")
