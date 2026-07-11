import logging
from datetime import datetime, date, UTC
from sqlalchemy.orm import Session

import models
from ai_orchestration.daily_report_scheduler import generate_daily_report

logger = logging.getLogger("nexora_action_engine")

def log_audit_event(db: Session, user_id: str, action: str, details: str) -> models.AuditLog:
    """
    Creates a record of system data modification in the ledger database.
    """
    audit = models.AuditLog(
        user_id=user_id,
        action=action,
        details=details,
        created_at=datetime.now(UTC)
    )
    db.add(audit)
    db.commit()
    return audit

class AIActionEngine:
    """
    Executes controlled operational actions, enforces permissions, and records changes in the audit ledger.
    """
    def __init__(self, db: Session, user_role: str, user_id: str):
        self.db = db
        self.user_role = user_role.lower()
        self.user_id = user_id

    def _check_permission(self, allowed_roles: list) -> bool:
        return self.user_role in allowed_roles

    def create_purchase_order_draft(self, supplier_id: str, inventory_id: str, quantity: float, unit_cost: float) -> dict:
        """
        Creates a draft Purchase Order in pending status.
        """
        allowed = ["admin", "super_admin", "manager", "store", "accountant"]
        if not self._check_permission(allowed):
            return {"status": "error", "message": f"Permission Denied: User role '{self.user_role}' cannot create purchase orders."}
            
        try:
            # Verify inventory item exists
            item = self.db.query(models.InventoryItem).filter(
                models.InventoryItem.id == inventory_id,
                models.InventoryItem.is_deleted == False
            ).first()
            if not item:
                return {"status": "error", "message": "Inventory item not found."}
                
            # Verify supplier exists
            supplier = self.db.query(models.Supplier).filter(
                models.Supplier.id == supplier_id,
                models.Supplier.is_deleted == False
            ).first()
            if not supplier:
                return {"status": "error", "message": "Supplier not found."}

            po_num = f"PO-{int(datetime.now(UTC).timestamp())}"
            total_cost = quantity * unit_cost
            
            po = models.PurchaseOrder(
                po_number=po_num,
                supplier_id=supplier_id,
                inventory_id=inventory_id,
                quantity=quantity,
                unit_cost=unit_cost,
                total_cost=total_cost,
                status="pending",
                requested_by=self.user_id,
                category="Raw Material",
                po_date=date.today(),
                vendor_name=supplier.name,
                material_name=item.name,
                sku=item.sku,
                unit=item.unit,
                pending_quantity=quantity
            )
            self.db.add(po)
            self.db.commit()
            
            log_audit_event(
                self.db, 
                self.user_id, 
                "CREATE_PO_DRAFT", 
                f"Generated draft purchase order {po_num} for {quantity} {item.unit} of {item.name}."
            )
            
            return {
                "status": "success",
                "action": "CREATE_PO_DRAFT",
                "approval_required": True,
                "data": {
                    "po_id": po.id,
                    "po_number": po_num,
                    "supplier": supplier.name,
                    "material": item.name,
                    "quantity": quantity,
                    "total_cost": total_cost,
                    "status": "pending"
                }
            }
        except Exception as e:
            self.db.rollback()
            return {"status": "error", "message": str(e)}

    def create_material_request_draft(self, project_id: str, inventory_id: str, quantity: float, notes: str = None) -> dict:
        """
        Creates a pending material request.
        """
        allowed = ["admin", "super_admin", "manager", "store", "worker"]
        if not self._check_permission(allowed):
            return {"status": "error", "message": f"Permission Denied: User role '{self.user_role}' cannot create material requests."}
            
        try:
            item = self.db.query(models.InventoryItem).filter(
                models.InventoryItem.id == inventory_id,
                models.InventoryItem.is_deleted == False
            ).first()
            if not item:
                return {"status": "error", "message": "Inventory item not found."}
                
            project = self.db.query(models.Project).filter(
                models.Project.id == project_id,
                models.Project.is_deleted == False
            ).first()
            if not project:
                return {"status": "error", "message": "Project not found."}

            req = models.MaterialRequest(
                project_id=project_id,
                inventory_id=inventory_id,
                requested_by=self.user_id,
                quantity=quantity,
                status="pending",
                notes=notes
            )
            self.db.add(req)
            self.db.commit()
            
            log_audit_event(
                self.db, 
                self.user_id, 
                "CREATE_MR_DRAFT", 
                f"Generated draft material request for {quantity} {item.unit} of {item.name} for project {project.name}."
            )
            
            return {
                "status": "success",
                "action": "CREATE_MR_DRAFT",
                "approval_required": True,
                "data": {
                    "request_id": req.id,
                    "project": project.name,
                    "material": item.name,
                    "quantity": quantity,
                    "status": "pending"
                }
            }
        except Exception as e:
            self.db.rollback()
            return {"status": "error", "message": str(e)}

    def generate_supplier_email_draft(self, supplier_id: str, subject: str, body_template: str = None) -> dict:
        """
        Generates email details to draft communications for a supplier.
        """
        allowed = ["admin", "super_admin", "manager"]
        if not self._check_permission(allowed):
            return {"status": "error", "message": "Permission Denied."}
            
        supplier = self.db.query(models.Supplier).filter(
            models.Supplier.id == supplier_id,
            models.Supplier.is_deleted == False
        ).first()
        if not supplier:
            return {"status": "error", "message": "Supplier not found."}

        email_to = supplier.email or f"contact@{supplier.name.lower().replace(' ', '')}.com"
        body = body_template or f"Dear {supplier.name},\n\nWe would like to query the delivery timeline for our order.\n\nBest regards,\nNexora AI ERP Manager"
        
        return {
            "status": "success",
            "action": "GENERATE_EMAIL_DRAFT",
            "email_to": email_to,
            "subject": subject,
            "body": body
        }

    def generate_daily_executive_report(self) -> dict:
        """
        Triggers daily report generation sequence.
        """
        allowed = ["admin", "super_admin", "manager", "accountant"]
        if not self._check_permission(allowed):
            return {"status": "error", "message": "Permission Denied."}
            
        return generate_daily_report(self.db)

    def generate_pdf_report(self, report_type: str, report_data: dict) -> dict:
        """
        Compiles structural coordinates to compile a mock PDF summary report.
        """
        allowed = ["admin", "super_admin", "manager", "accountant"]
        if not self._check_permission(allowed):
            return {"status": "error", "message": "Permission Denied."}
            
        return {
            "status": "success",
            "action": "GENERATE_PDF",
            "pdf_name": f"{report_type}_report_{int(datetime.now(UTC).timestamp())}.pdf",
            "data": report_data
        }

    def create_reminder(self, title: str, description: str, remind_at: datetime = None) -> dict:
        """
        Creates a system reminder alert.
        """
        allowed = ["admin", "super_admin", "manager", "store", "accountant", "worker"]
        if not self._check_permission(allowed):
            return {"status": "error", "message": "Permission Denied."}
            
        remind_time = remind_at or datetime.now(UTC)
        notification = models.Notification(
            title=title,
            description=f"[REMINDER at {remind_time.strftime('%Y-%m-%d %H:%M')}] {description}",
            type="reminder",
            is_read=False,
            created_at=datetime.now(UTC)
        )
        self.db.add(notification)
        self.db.commit()
        
        return {
            "status": "success",
            "action": "CREATE_REMINDER",
            "notification_id": notification.id,
            "title": title
        }

    def assign_project_task(self, title: str, description: str, assigned_to_staff_id: str, deadline: date = None) -> dict:
        """
        Assigns a new project task to a staff member.
        """
        allowed = ["admin", "super_admin", "manager"]
        if not self._check_permission(allowed):
            return {"status": "error", "message": "Permission Denied."}
            
        staff = self.db.query(models.Staff).filter(models.Staff.id == assigned_to_staff_id).first()
        if not staff:
            return {"status": "error", "message": "Staff member not found."}
            
        task = models.Task(
            title=title,
            description=description,
            assigned_to=assigned_to_staff_id,
            deadline=deadline or date.today(),
            priority="medium",
            status="todo"
        )
        self.db.add(task)
        self.db.commit()
        
        log_audit_event(
            self.db, 
            self.user_id, 
            "ASSIGN_TASK", 
            f"Assigned project task '{title}' to staff {staff.name}."
        )
        
        return {
            "status": "success",
            "action": "ASSIGN_TASK",
            "task_id": task.id,
            "title": title,
            "assigned_to": staff.name
        }

    def create_attendance_alert(self, title: str, description: str) -> dict:
        """
        Generates an alert for attendance discrepancies.
        """
        allowed = ["admin", "super_admin", "manager"]
        if not self._check_permission(allowed):
            return {"status": "error", "message": "Permission Denied."}
            
        notification = models.Notification(
            title=title,
            description=description,
            type="attendance_alert",
            is_read=False,
            created_at=datetime.now(UTC)
        )
        self.db.add(notification)
        self.db.commit()
        
        return {
            "status": "success",
            "action": "CREATE_ATTENDANCE_ALERT",
            "notification_id": notification.id
        }

    def create_low_stock_alert(self, title: str, description: str) -> dict:
        """
        Generates an alert for low material stock levels.
        """
        allowed = ["admin", "super_admin", "manager", "store"]
        if not self._check_permission(allowed):
            return {"status": "error", "message": "Permission Denied."}
            
        notification = models.Notification(
            title=title,
            description=description,
            type="low_stock_alert",
            is_read=False,
            created_at=datetime.now(UTC)
        )
        self.db.add(notification)
        self.db.commit()
        
        return {
            "status": "success",
            "action": "CREATE_LOW_STOCK_ALERT",
            "notification_id": notification.id
        }

    def schedule_follow_up(self, title: str, description: str) -> dict:
        """
        Schedules a follow-up action event log.
        """
        allowed = ["admin", "super_admin", "manager", "worker"]
        if not self._check_permission(allowed):
            return {"status": "error", "message": "Permission Denied."}
            
        notification = models.Notification(
            title=f"[FOLLOW-UP] {title}",
            description=description,
            type="follow_up",
            is_read=False,
            created_at=datetime.now(UTC)
        )
        self.db.add(notification)
        self.db.commit()
        
        return {
            "status": "success",
            "action": "SCHEDULE_FOLLOW_UP",
            "notification_id": notification.id
        }

    def confirm_and_execute_draft(self, action_type: str, draft_id: str) -> dict:
        """
        Executes and updates draft statuses (e.g. approving a Purchase Order or Material Request).
        """
        allowed = ["admin", "super_admin", "manager"]
        if not self._check_permission(allowed):
            return {"status": "error", "message": "Permission Denied: User role is not authorized to execute transactions."}
            
        try:
            if action_type == "CREATE_PO_DRAFT":
                po = self.db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == draft_id).first()
                if not po:
                    return {"status": "error", "message": "Purchase Order draft not found."}
                po.status = "approved"
                self.db.commit()
                
                log_audit_event(
                    self.db, 
                    self.user_id, 
                    "EXECUTE_PO_DRAFT", 
                    f"Approved and executed purchase order draft {po.po_number}."
                )
                
                return {
                    "status": "success",
                    "action_executed": "CREATE_PO_DRAFT",
                    "draft_id": draft_id,
                    "final_status": "approved",
                    "message": f"Purchase Order {po.po_number} successfully approved and executed."
                }
                
            elif action_type == "CREATE_MR_DRAFT":
                mr = self.db.query(models.MaterialRequest).filter(models.MaterialRequest.id == draft_id).first()
                if not mr:
                    return {"status": "error", "message": "Material Request draft not found."}
                mr.status = "approved"
                self.db.commit()
                
                log_audit_event(
                    self.db, 
                    self.user_id, 
                    "EXECUTE_MR_DRAFT", 
                    f"Approved and executed material request draft."
                )
                
                return {
                    "status": "success",
                    "action_executed": "CREATE_MR_DRAFT",
                    "draft_id": draft_id,
                    "final_status": "approved",
                    "message": "Material Request successfully approved and executed."
                }
                
            return {"status": "error", "message": "Invalid draft action type."}
        except Exception as e:
            self.db.rollback()
            return {"status": "error", "message": str(e)}
