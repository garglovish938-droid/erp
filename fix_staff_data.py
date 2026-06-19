import sqlite3

conn = sqlite3.connect("backend/erp.db")
cur = conn.cursor()

# Restore all real non-test staff
cur.execute(
    "UPDATE staff SET is_deleted = 0 WHERE name IN ('John Doe', 'Sarah Connor', 'David Smith')"
)
affected = cur.rowcount
conn.commit()
print(f"Restored {affected} staff members")

# Clean up E2E test records
cur.execute("DELETE FROM staff WHERE name = 'E2E Test Employee'")
deleted = cur.rowcount
conn.commit()
print(f"Removed {deleted} E2E test staff records")

# Clean up smoke test records
cur.execute("DELETE FROM projects WHERE name = 'SMOKE_TEST_PROJECT'")
cur.execute("DELETE FROM clients WHERE name = 'SMOKE_TEST_CLIENT'")
cur.execute("DELETE FROM suppliers WHERE name = 'SMOKE_TEST_SUPPLIER'")
cur.execute("DELETE FROM projects WHERE name = 'Smoke Test Project'")
conn.commit()
print("Removed smoke test records")

# Verify final state
cur.execute("SELECT name, role, status, is_deleted FROM staff")
rows = cur.fetchall()
print("\nFinal staff state:")
for r in rows:
    print(f"  {r[0]} | {r[1]} | status={r[2]} | is_deleted={r[3]}")

conn.close()
