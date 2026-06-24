import sys
sys.path.insert(0, '.')
import sqlite3
from datetime import date, datetime, timedelta

conn = sqlite3.connect('./erp.db')
c = conn.cursor()

print('Testing visualization stats...')

active_staff = c.execute("SELECT COUNT(*) FROM staff WHERE is_deleted=0 AND status='active'").fetchone()[0]
print(f'Active staff: {active_staff}')

att_records = c.execute("SELECT SUM(overtime_hours) FROM attendance WHERE date='" + date.today().isoformat() + "'").fetchone()[0]
print(f'OT hours today: {att_records}')

tasks = c.execute("SELECT COUNT(*) FROM tasks WHERE is_deleted=0").fetchone()[0]
print(f'Tasks: {tasks}')

today = date.today()
for i in range(5, -1, -1):
    month = today.month - i
    year = today.year
    if month <= 0:
        month += 12
        year -= 1
    month_start = datetime(year, month, 1)
    if month == 12:
        month_end = datetime(year + 1, 1, 1)
    else:
        month_end = datetime(year, month + 1, 1)
    
    total = c.execute(
        "SELECT SUM(total_cost) FROM purchase_orders WHERE is_deleted=0 AND status='received' AND created_at>=? AND created_at<?",
        (month_start.isoformat(), month_end.isoformat())
    ).fetchone()[0] or 0.0
    print(f'  Month expense: {total}')

conn.close()
print('Visualization test PASSED')
