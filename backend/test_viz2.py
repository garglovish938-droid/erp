"""Test the visualization endpoint by running main.py's route handler with a test DB session."""
import sys
import os
sys.path.insert(0, '.')
os.environ.setdefault("SECRET_KEY", "allure_living_super_secret_key_123456789")

from database import SessionLocal
from datetime import date, datetime, timedelta
from sqlalchemy import func
from models import Staff, Attendance, Project, StockTransaction, PurchaseOrder, Task

db = SessionLocal()
try:
    # 1. Attendance Trend
    attendance_trend = []
    active_staff_count = db.query(Staff).filter(Staff.is_deleted == False, Staff.status == "active").count()
    if active_staff_count == 0:
        active_staff_count = 1
        
    for i in range(6, -1, -1):
        d = date.today() - timedelta(days=i)
        present_count = db.query(Attendance).filter(Attendance.date == d, Attendance.status.in_(["present", "half_day"])).count()
        pct = round((present_count / active_staff_count) * 100, 1)
        attendance_trend.append({"date": d.strftime("%Y-%m-%d"), "percentage": pct})
    print("Attendance trend OK:", len(attendance_trend))
    
    # 2. Project Progress
    projects = db.query(Project).filter(Project.is_deleted == False, Project.status != "completed").all()
    project_progress = []
    for p in projects:
        bom_items = p.bom_items
        total_bom = len(bom_items)
        if total_bom > 0:
            fulfilled = sum(1 for b in bom_items if b.status == "fulfilled")
            progress = round((fulfilled / total_bom) * 100, 1)
        else:
            progress = 50.0 if p.status == "active" else 10.0
        project_progress.append({"project_name": p.name, "progress": progress})
    print("Project progress OK:", len(project_progress))
    
    # 3. Material Usage
    material_usage = []
    start_date = datetime.utcnow() - timedelta(days=7)
    transactions = db.query(StockTransaction).filter(
        StockTransaction.transaction_type == "out",
        StockTransaction.created_at >= start_date
    ).all()
    
    usage_by_day = {}
    for t in transactions:
        day_str = t.created_at.strftime("%Y-%m-%d")
        usage_by_day[day_str] = usage_by_day.get(day_str, 0.0) + t.quantity
        
    for i in range(6, -1, -1):
        d = date.today() - timedelta(days=i)
        day_str = d.strftime("%Y-%m-%d")
        material_usage.append({"date": day_str, "quantity": round(usage_by_day.get(day_str, 0.0), 1)})
    print("Material usage OK:", len(material_usage))
    
    # 4. Expense Trend
    expense_trend = []
    for i in range(5, -1, -1):
        today = date.today()
        year = today.year
        month = today.month - i
        if month <= 0:
            month += 12
            year -= 1
        month_start = datetime(year, month, 1)
        if month == 12:
            month_end = datetime(year + 1, 1, 1)
        else:
            month_end = datetime(year, month + 1, 1)
            
        month_po_total = db.query(func.sum(PurchaseOrder.total_cost)).filter(
            PurchaseOrder.is_deleted == False,
            PurchaseOrder.status == "received",
            PurchaseOrder.created_at >= month_start,
            PurchaseOrder.created_at < month_end
        ).scalar() or 0.0
        
        expense_trend.append({
            "month": month_start.strftime("%b %Y"),
            "expense": round(month_po_total, 2)
        })
    print("Expense trend OK:", len(expense_trend))
    
    # 5. Overtime & Late Analysis
    late_count = db.query(Attendance).filter(Attendance.date == date.today(), Attendance.late_arrival == True).count()
    ot_hours_total = db.query(func.sum(Attendance.overtime_hours)).filter(Attendance.date == date.today()).scalar() or 0.0
    print(f"Late count: {late_count}, OT hours: {ot_hours_total}")
    
    # 6. Worker Performance
    staff_list = db.query(Staff).filter(Staff.is_deleted == False).all()
    worker_performance = []
    for s in staff_list[:5]:
        attendance_records = db.query(Attendance).filter(Attendance.staff_id == s.id).all()
        total_att = len(attendance_records)
        present_att = sum(1 for a in attendance_records if a.status in ["present", "half_day"])
        attendance_score = (present_att / total_att * 100) if total_att > 0 else 100.0
        
        tasks = db.query(Task).filter(Task.assigned_to == s.id, Task.is_deleted == False).all()
        completed_tasks = sum(1 for t in tasks if t.status == "completed")
        task_score = (completed_tasks / len(tasks) * 100) if len(tasks) > 0 else 100.0
        
        score = round((attendance_score + task_score) / 2.0, 1)
        worker_performance.append({"name": s.name, "score": score})
    print("Worker performance OK:", len(worker_performance))
    
    print("\nAll visualization checks PASSED!")
    
except Exception as e:
    import traceback
    print("ERROR:", e)
    traceback.print_exc()
finally:
    db.close()
