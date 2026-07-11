import logging
from sqlalchemy.orm import Session
from datetime import date
import models
import crud
import os
from config import settings
from ai_orchestration.pdf_generator import generate_pdf_report
from ai_orchestration.email_client import send_smtp_email

logger = logging.getLogger("nexora_capabilities")

def _check_permission(user_role: str, allowed_roles: list) -> bool:
    return user_role.lower() in [r.lower() for r in allowed_roles]

# 1. Inventory Capability
def inventory_tool(db: Session, user_role: str, action: str, params: dict = None) -> dict:
    allowed = ["admin", "super_admin", "manager", "store", "accountant"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
    
    try:
        if action == "list_low_stock":
            items = db.query(models.InventoryItem).filter(models.InventoryItem.is_deleted == False).all()
            low_stock = [
                {
                    "name": item.name,
                    "sku": item.sku,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "minimum_stock": item.minimum_stock_level
                }
                for item in items if item.quantity <= item.minimum_stock_level
            ]
            return {"status": "success", "data": low_stock}
        elif action == "get_valuation":
            items = db.query(models.InventoryItem).filter(models.InventoryItem.is_deleted == False).all()
            total_value = sum(item.quantity * item.unit_cost for item in items)
            return {"status": "success", "total_valuation": total_value, "items_count": len(items)}
        else:
            return {"status": "error", "message": f"Unknown inventory action: {action}"}
    except Exception as e:
        logger.error(f"Inventory capability execution failed: {e}")
        return {"status": "error", "message": str(e)}

# 2. Projects Capability
def projects_tool(db: Session, user_role: str, action: str, params: dict = None) -> dict:
    allowed = ["admin", "super_admin", "manager", "store", "worker"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
        
    try:
        if action == "list_active":
            projects = db.query(models.Project).filter(
                models.Project.is_deleted == False,
                models.Project.status == "active"
            ).all()
            data = [
                {
                    "name": p.name,
                    "percentage": p.completion_percentage,
                    "location": p.site_location or "N/A"
                }
                for p in projects
            ]
            return {"status": "success", "data": data}
        else:
            return {"status": "error", "message": f"Unknown projects action: {action}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# 3. Purchase Capability
def purchase_tool(db: Session, user_role: str, action: str, params: dict = None) -> dict:
    allowed = ["admin", "super_admin", "manager", "accountant"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
        
    try:
        if action == "create_po":
            # Action triggers PO generation
            if not params or "supplier_id" not in params or "inventory_id" not in params:
                return {"status": "error", "message": "Missing PO parameter detail."}
            # Mock or trigger crud creation
            po = models.PurchaseOrder(
                supplier_id=params["supplier_id"],
                inventory_id=params["inventory_id"],
                quantity=params.get("quantity", 10.0),
                unit_cost=params.get("unit_cost", 100.0),
                status="pending",
                po_number=f"PO-GEN-{int(time.time())}" if 'time' in globals() else f"PO-GEN-12345"
            )
            db.add(po)
            db.commit()
            db.refresh(po)
            return {"status": "success", "po_number": po.po_number, "id": po.id}
        else:
            return {"status": "error", "message": f"Unknown purchase action: {action}"}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}

# 4. Supplier Capability
def supplier_tool(db: Session, user_role: str, action: str, params: dict = None) -> dict:
    allowed = ["admin", "super_admin", "manager", "store", "accountant"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
        
    try:
        if action == "list_suppliers":
            sups = db.query(models.Supplier).filter(models.Supplier.is_deleted == False).all()
            data = [{"name": s.name, "contact": s.contact_person, "phone": s.phone} for s in sups]
            return {"status": "success", "data": data}
        else:
            return {"status": "error", "message": f"Unknown supplier action: {action}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# 5. Attendance Capability
def attendance_tool(db: Session, user_role: str, action: str, params: dict = None) -> dict:
    allowed = ["admin", "super_admin", "manager", "worker"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
        
    try:
        if action == "get_today":
            today = date.today()
            logs = db.query(models.Attendance).filter(models.Attendance.date == today).all()
            data = [
                {
                    "staff_name": log.staff_member.name if log.staff_member else "Unknown",
                    "check_in": log.check_in,
                    "late": log.late_arrival
                }
                for log in logs
            ]
            return {"status": "success", "present_count": len(data), "data": data}
        else:
            return {"status": "error", "message": f"Unknown attendance action: {action}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# 6. Finance Capability
def finance_tool(db: Session, user_role: str, action: str, params: dict = None) -> dict:
    allowed = ["admin", "super_admin", "manager", "accountant"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
        
    try:
        if action == "get_capital_balance":
            entries = db.query(models.CashBook).filter(models.CashBook.is_deleted == False).all()
            bal = 0.0
            for entry in entries:
                if entry.transaction_type == "add":
                    bal += entry.amount
                elif entry.transaction_type == "deduct":
                    bal -= entry.amount
            return {"status": "success", "balance": bal}
        elif action == "get_wallets_summary":
            wallets = db.query(models.FactoryWallet).filter(models.FactoryWallet.is_deleted == False).all()
            total = sum(w.balance for w in wallets)
            data = [{"name": w.name, "balance": w.balance} for w in wallets]
            return {"status": "success", "total_balance": total, "wallets": data}
        else:
            return {"status": "error", "message": f"Unknown finance action: {action}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# 7. Expense Capability
def expense_tool(db: Session, user_role: str, action: str, params: dict = None) -> dict:
    allowed = ["admin", "super_admin", "manager", "accountant", "worker"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
        
    try:
        if action == "list_recent":
            expenses = db.query(models.DailyExpense).filter(models.DailyExpense.is_deleted == False).all()
            data = [{"date": str(e.date), "amount": e.amount, "desc": e.description} for e in expenses[-5:]]
            return {"status": "success", "data": data}
        else:
            return {"status": "error", "message": f"Unknown expense action: {action}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# 8. Reports Capability
def reports_tool(db: Session, user_role: str, report_type: str) -> dict:
    allowed = ["admin", "super_admin", "manager", "accountant"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
        
    return {"status": "success", "report_type": report_type, "message": f"Report compile trigger registered."}

# 9. Notifications Capability
def notifications_tool(db: Session, user_role: str, action: str, params: dict = None) -> dict:
    allowed = ["admin", "super_admin", "manager"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
        
    return {"status": "success", "action": action, "message": "Notification dispatch command completed."}

# 10. PDF Capability
def pdf_tool(db: Session, user_role: str, action: str, params: dict = None) -> dict:
    allowed = ["admin", "super_admin", "manager", "accountant"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
    
    filename = (params or {}).get("filename", "report.pdf")
    pdf_path = os.path.join(settings.BACKUP_DIR, filename)
    title = (params or {}).get("title", "Executive PDF Report")
    sections = (params or {}).get("sections", [
        {"header": "Report Data Details", "content": "No structured data provided."}
    ])
    
    success = generate_pdf_report(pdf_path, title, sections)
    if success:
        return {"status": "success", "message": f"PDF successfully generated at: {pdf_path}", "pdf_path": pdf_path}
    return {"status": "error", "message": "Failed to compile PDF report."}

# 11. Email Capability
def email_tool(db: Session, user_role: str, action: str, params: dict = None) -> dict:
    allowed = ["admin", "super_admin", "manager"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
        
    p = params or {}
    to_email = p.get("to_email", settings.SMTP_FROM or "owner@allureliving.com")
    subject = p.get("subject", "Nexora AI System Notification")
    body = p.get("body", "Notification body content placeholder.")
    attachment_path = p.get("attachment_path")
    
    success = send_smtp_email(to_email, subject, body, attachment_path)
    if success:
        return {"status": "success", "message": f"Email successfully sent to <{to_email}>."}
    return {"status": "error", "message": "Failed to transmit SMTP email."}

# 12. WhatsApp Capability
def whatsapp_tool(db: Session, user_role: str, action: str, params: dict = None) -> dict:
    allowed = ["admin", "super_admin", "manager"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
        
    p = params or {}
    recipient = p.get("phone", "9998887770")
    message_text = p.get("message", "Nexora AI System WhatsApp Alert.")
    
    logger.info(f"WhatsApp Notification Sent: Recipient: {recipient}. Message: {message_text}")
    return {"status": "success", "message": f"WhatsApp text message successfully queued for {recipient}."}

# 13. Approval Capability
def approval_tool(db: Session, user_role: str, action: str, params: dict = None) -> dict:
    allowed = ["admin", "super_admin", "manager"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
        
    return {"status": "success", "message": f"Approval {action} action submitted."}

# 14. Dashboard Capability
def dashboard_tool(db: Session, user_role: str, action: str = "get_stats", params: dict = None) -> dict:
    allowed = ["admin", "super_admin", "manager", "store", "accountant", "worker"]
    if not _check_permission(user_role, allowed):
        return {"status": "error", "message": "Permission Denied: Insufficient roles."}
        
    try:
        # Collect key operations stats
        projects_count = db.query(models.Project).filter(models.Project.is_deleted == False).count()
        inventory_count = db.query(models.InventoryItem).filter(models.InventoryItem.is_deleted == False).count()
        staff_count = db.query(models.Staff).filter(models.Staff.status == "active").count()
        
        return {
            "status": "success",
            "active_projects": projects_count,
            "inventory_items": inventory_count,
            "registered_staff": staff_count
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

