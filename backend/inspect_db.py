import sqlite3, os

conn = sqlite3.connect('./erp.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

print("=== CURRENT DATABASE STATE ===\n")

c.execute("SELECT email, role, employee_code FROM users WHERE is_deleted=0 ORDER BY role")
users = c.fetchall()
print(f"USERS ({len(users)}):")
for u in users:
    print(f"  {u['email']} | {u['role']} | {u['employee_code']}")

c.execute("SELECT name, sku, quantity FROM inventory WHERE is_deleted=0")
inv = c.fetchall()
print(f"\nINVENTORY ({len(inv)} items):")
for i in inv:
    print(f"  {i['name']} | {i['sku']} | qty={i['quantity']}")

c.execute("SELECT name, status FROM projects WHERE is_deleted=0")
proj = c.fetchall()
print(f"\nPROJECTS ({len(proj)}):")
for p in proj:
    print(f"  {p['name']} | {p['status']}")

c.execute("SELECT name FROM clients WHERE is_deleted=0")
cli = c.fetchall()
print(f"\nCLIENTS ({len(cli)}):")
for cl in cli:
    print(f"  {cl['name']}")

c.execute("SELECT name FROM suppliers WHERE is_deleted=0")
sup = c.fetchall()
print(f"\nSUPPLIERS ({len(sup)}):")
for s in sup:
    print(f"  {s['name']}")

c.execute("SELECT name, role FROM staff WHERE is_deleted=0")
stf = c.fetchall()
print(f"\nSTAFF ({len(stf)}):")
for s in stf:
    print(f"  {s['name']} | {s['role']}")

c.execute("SELECT COUNT(*) FROM stock_transactions")
print(f"\nSTOCK TRANSACTIONS: {c.fetchone()[0]}")

c.execute("SELECT COUNT(*) FROM material_requests WHERE is_deleted=0")
print(f"MATERIAL REQUESTS: {c.fetchone()[0]}")

c.execute("SELECT COUNT(*) FROM attendance")
print(f"ATTENDANCE RECORDS: {c.fetchone()[0]}")

c.execute("SELECT COUNT(*) FROM activity_logs")
print(f"ACTIVITY LOGS: {c.fetchone()[0]}")

bak_dir = './backups'
baks = os.listdir(bak_dir) if os.path.exists(bak_dir) else []
print(f"BACKUP FILES: {len(baks)}")
for b in baks:
    print(f"  {b}")

c.execute("SELECT COUNT(*) FROM notifications")
print(f"NOTIFICATIONS: {c.fetchone()[0]}")

conn.close()
