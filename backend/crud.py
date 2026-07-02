import json
from datetime import datetime, date
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional

from models import (
    User, Category, InventoryItem, Supplier, Client, Project, ProjectBOM,
    StockTransaction, MaterialRequest, PurchaseOrder, Staff, Attendance,
    Notification, ActivityLog, CustomFieldDefinition, CustomFieldValue, DailyExpense,
    WorkflowDefinition, WorkflowStep, ApprovalRule, DashboardWidget, Task,
    Document, VersionHistory, ProjectAssignment, DailyWorkLog, Shift, AttendanceRule,
    ProjectDailyLog, ProjectMaterialHistory
)
from schemas import (
    UserCreate, UserUpdate, CategoryCreate, CategoryUpdate, InventoryItemCreate, InventoryItemUpdate,
    SupplierCreate, SupplierUpdate, ClientCreate, ClientUpdate, ProjectCreate,
    ProjectUpdate, ProjectBOMCreate, MaterialRequestCreate, PurchaseOrderCreate, DailyExpenseCreate,
    StaffCreate, StaffUpdate, AttendanceCreate, CustomFieldDefinitionCreate, CustomFieldValueCreate,
    WorkflowDefinitionCreate, ApprovalRuleCreate, DashboardWidgetCreate, TaskCreate,
    TaskUpdate, DocumentCreate, ShiftCreate, AttendanceRuleUpdate, NewMaterialAndProjectUsageRequest
)

# Activity Logger Helper
def log_activity(db: Session, user_id: Optional[str], action: str, details: Optional[str] = None, ip_address: Optional[str] = None, device: Optional[str] = None):
    # Truncate device (User-Agent) to 100 characters to match activity_logs.device database column constraint
    safe_device = device[:100] if device else None
    log = ActivityLog(user_id=user_id, action=action, details=details, ip_address=ip_address, device=safe_device)
    db.add(log)
    db.commit()

def log_detailed_activity(db: Session, user_id: Optional[str], module: str, action: str, record_id: Optional[str], message: str, ip_address: Optional[str] = None, device: Optional[str] = None):
    role = "system"
    user_name = "System"
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            role = user.role
            user_name = user.full_name or user.email
            
    details_dict = {
        "timestamp": datetime.utcnow().isoformat(),
        "user": user_name,
        "role": role,
        "module": module,
        "action": action,
        "record_id": record_id,
        "message": message
    }
    
    details_json = json.dumps(details_dict)
    # Truncate device (User-Agent) to 100 characters to match activity_logs.device database column constraint
    safe_device = device[:100] if device else None
    log = ActivityLog(user_id=user_id, action=action, details=details_json, ip_address=ip_address, device=safe_device)
    db.add(log)
    db.commit()


# Notification Helper
_notification_callback = None

def register_notification_callback(cb):
    global _notification_callback
    _notification_callback = cb

def create_system_notification(db: Session, title: str, description: str, notif_type: str):
    notification = Notification(title=title, description=description, type=notif_type)
    db.add(notification)
    db.commit()
    db.refresh(notification)
    if _notification_callback:
        try:
            _notification_callback({
                "event": "notification",
                "data": {
                    "id": notification.id,
                    "title": notification.title,
                    "description": notification.description,
                    "type": notification.type,
                    "created_at": notification.created_at.isoformat()
                }
            })
        except Exception:
            pass

# Versioning Helper
def save_version_snapshot(db: Session, entity_type: str, entity_id: str, data_dict: dict, user_id: Optional[str]):
    # Get current max version
    max_ver = db.query(func.max(VersionHistory.version_num)).filter(
        VersionHistory.entity_type == entity_type,
        VersionHistory.entity_id == entity_id
    ).scalar() or 0
    
    # Serialize date/datetime fields
    clean_dict = {}
    for k, v in data_dict.items():
        if isinstance(v, (datetime, date)):
            clean_dict[k] = v.isoformat()
        else:
            clean_dict[k] = v
            
    history = VersionHistory(
        entity_type=entity_type,
        entity_id=entity_id,
        version_num=max_ver + 1,
        serialized_data=json.dumps(clean_dict),
        created_by=user_id
    )
    db.add(history)
    db.commit()

def recalculate_project_progress(db: Session, project_id: str):
    from models import Project, ProjectBOM, ProjectDailyLog
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return
    
    if project.progress_mode != "auto":
        return
        
    # 1. Materials Progress
    bom_items = db.query(ProjectBOM).filter(ProjectBOM.project_id == project_id).all()
    has_materials = len(bom_items) > 0
    mat_progress = 0.0
    if has_materials:
        total_req = sum(b.required_quantity for b in bom_items)
        if total_req > 0:
            total_used = sum(min(b.used_quantity, b.required_quantity) for b in bom_items)
            mat_progress = (total_used / total_req) * 100.0
        else:
            mat_progress = 100.0
            
    # 2. Tasks Progress (from approved daily logs)
    latest_log = db.query(ProjectDailyLog).filter(
        ProjectDailyLog.project_id == project_id,
        ProjectDailyLog.approval_status == "approved"
    ).order_by(ProjectDailyLog.log_date.desc(), ProjectDailyLog.created_at.desc()).first()
    
    has_tasks = latest_log is not None
    task_progress = latest_log.progress_percentage if latest_log else 0.0
    
    if has_materials and has_tasks:
        pct = (mat_progress + task_progress) / 2
    elif has_materials:
        pct = mat_progress
    elif has_tasks:
        pct = task_progress
    else:
        pct = 0.0
        
    new_pct = int(min(100.0, max(0.0, pct)))
    
    if project.completion_percentage != new_pct:
        project.completion_percentage = new_pct
        if new_pct == 100 and project.status != "completed":
            project.status = "completed"
        db.commit()

def update_inventory_reserved_and_available(db: Session, inventory_id: str):
    from models import InventoryItem, ProjectBOM, Project
    item = db.query(InventoryItem).filter(InventoryItem.id == inventory_id).first()
    if not item:
        return
        
    reserved = 0.0
    bom_items = db.query(ProjectBOM).join(Project).filter(
        ProjectBOM.inventory_id == inventory_id,
        Project.is_deleted == False
    ).all()
    for bom in bom_items:
        pending = bom.required_quantity - bom.used_quantity
        if pending > 0:
            reserved += pending
            
    item.reserved_quantity = reserved
    item.available_quantity = item.quantity - reserved
    db.commit()

# --- AUTH & USERS ---
def sync_user_to_staff(db: Session, db_user: User):
    staff_member = db.query(Staff).filter(
        (Staff.user_id == db_user.id) | 
        (Staff.email == db_user.email) | 
        (Staff.phone == db_user.phone)
    ).first()
    
    role_str = db_user.role.replace("_", " ").title()
    
    if staff_member:
        staff_member.user_id = db_user.id
        staff_member.name = db_user.full_name
        staff_member.role = role_str
        staff_member.phone = db_user.phone
        staff_member.email = db_user.email
        staff_member.status = "active" if db_user.status == "active" else "inactive"
    else:
        staff_member = Staff(
            user_id=db_user.id,
            name=db_user.full_name,
            role=role_str,
            phone=db_user.phone,
            email=db_user.email,
            salary=0.0,
            status="active" if db_user.status == "active" else "inactive"
        )
        db.add(staff_member)
    db.commit()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(func.lower(User.email) == func.lower(email), User.is_deleted == False).first()

def get_user_by_username_or_phone_or_email(db: Session, login_id: str) -> Optional[User]:
    return db.query(User).filter(
        ((func.lower(User.email) == func.lower(login_id)) | 
         (User.phone == login_id) | 
         (User.employee_code == login_id)),
        User.is_deleted == False
    ).first()

def get_users(db: Session) -> List[User]:
    return db.query(User).filter(User.is_deleted == False).all()

def create_user(db: Session, user_in: UserCreate, password_hash: str) -> User:
    # Auto-generate unique EMP-XXXX employee code if not provided
    if not user_in.employee_code:
        existing_codes = db.query(User.employee_code).filter(
            User.employee_code.like("EMP-%"),
            User.is_deleted == False
        ).all()
        max_num = 0
        for (code,) in existing_codes:
            if code:
                try:
                    num = int(code.split("-")[1])
                    if num > max_num:
                        max_num = num
                except (IndexError, ValueError):
                    pass
        new_code = f"EMP-{max_num + 1:04d}"
        # Ensure it is unique in case of parallel transactions
        while db.query(User).filter(User.employee_code == new_code).first():
            max_num += 1
            new_code = f"EMP-{max_num + 1:04d}"
        user_in.employee_code = new_code
    else:
        existing = db.query(User).filter(User.employee_code == user_in.employee_code, User.is_deleted == False).first()
        if existing:
            raise ValueError("Employee Code already exists")

    db_user = User(
        email=user_in.email,
        password_hash=password_hash,
        role=user_in.role,
        full_name=user_in.full_name,
        phone=user_in.phone,
        employee_code=user_in.employee_code,
        department=user_in.department,
        status=user_in.status or "active",
        permissions=user_in.permissions
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    sync_user_to_staff(db, db_user)
    
    log_activity(db, db_user.id, "register", f"User registered: {db_user.email}")
    return db_user

def update_user(db: Session, user_id: str, user_in: UserUpdate, password_hash: Optional[str] = None) -> Optional[User]:
    db_user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not db_user:
        return None
    
    update_data = user_in.model_dump(exclude_unset=True)
    if password_hash:
        db_user.password_hash = password_hash
        
    for field, value in update_data.items():
        if field != "password" and field != "employee_code":  # employee_code is non-editable / immutable
            setattr(db_user, field, value)
            
    db.commit()
    db.refresh(db_user)
    
    sync_user_to_staff(db, db_user)
    
    log_activity(db, db_user.id, "update_user", f"User details updated: {db_user.email}")
    return db_user

def delete_user(db: Session, user_id: str, actor_id: Optional[str] = None) -> bool:
    db_user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not db_user:
        return False
    db_user.is_deleted = True
    db_user.deleted_at = datetime.utcnow()
    db_user.deleted_by = actor_id
    
    # Also soft delete linked staff member
    staff_member = db.query(Staff).filter(Staff.user_id == db_user.id).first()
    if staff_member:
        staff_member.is_deleted = True
        staff_member.deleted_at = datetime.utcnow()
        staff_member.deleted_by = actor_id
        
    db.commit()
    log_activity(db, db_user.id, "delete_user", f"User deleted: {db_user.email}")
    return True

# --- CATEGORIES ---
def get_categories(db: Session) -> List[Category]:
    return db.query(Category).filter(Category.is_deleted == False).all()

def create_category(db: Session, category: CategoryCreate) -> Category:
    existing = db.query(Category).filter(Category.name == category.name, Category.is_deleted == False).first()
    if existing:
        raise ValueError(f"Category with name '{category.name}' already exists.")
    db_cat = Category(name=category.name, description=category.description)
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat

def update_category(db: Session, category_id: str, category_in: CategoryUpdate) -> Optional[Category]:
    db_cat = db.query(Category).filter(Category.id == category_id, Category.is_deleted == False).first()
    if not db_cat:
        return None
    if category_in.name is not None and category_in.name != db_cat.name:
        existing = db.query(Category).filter(Category.name == category_in.name, Category.is_deleted == False).first()
        if existing:
            raise ValueError(f"Category with name '{category_in.name}' already exists.")
        db_cat.name = category_in.name
    if category_in.description is not None:
        db_cat.description = category_in.description
    db.commit()
    db.refresh(db_cat)
    return db_cat

def delete_category(db: Session, category_id: str, actor_id: Optional[str] = None) -> bool:
    db_cat = db.query(Category).filter(Category.id == category_id, Category.is_deleted == False).first()
    if not db_cat:
        return False
    
    # Check if category has active inventory items
    has_items = db.query(InventoryItem).filter(InventoryItem.category_id == category_id, InventoryItem.is_deleted == False).first()
    if has_items:
        raise ValueError("Cannot delete category: it is not empty. Please move materials to another category first.")
        
    # Soft delete the category
    db_cat.is_deleted = True
    db_cat.deleted_at = datetime.utcnow()
    db_cat.deleted_by = actor_id
    
    db.commit()
    return True

def merge_categories(db: Session, source_id: str, target_id: str, actor_id: Optional[str] = None) -> bool:
    if source_id == target_id:
        raise ValueError("Cannot merge a category into itself.")
        
    source_cat = db.query(Category).filter(Category.id == source_id, Category.is_deleted == False).first()
    target_cat = db.query(Category).filter(Category.id == target_id, Category.is_deleted == False).first()
    if not source_cat or not target_cat:
        return False
        
    # Reassign materials in source category to target category
    db.query(InventoryItem).filter(InventoryItem.category_id == source_id).update(
        {InventoryItem.category_id: target_id},
        synchronize_session=False
    )
    
    # Soft delete source category
    source_cat.is_deleted = True
    source_cat.deleted_at = datetime.utcnow()
    source_cat.deleted_by = actor_id
    
    db.commit()
    return True

def move_materials_category(db: Session, material_ids: List[str], target_id: str) -> bool:
    target_cat = db.query(Category).filter(Category.id == target_id, Category.is_deleted == False).first()
    if not target_cat:
        return False
        
    # Bulk update category_id
    db.query(InventoryItem).filter(InventoryItem.id.in_(material_ids)).update(
        {InventoryItem.category_id: target_id},
        synchronize_session=False
    )
    
    db.commit()
    return True

# --- SUPPLIERS ---
def get_suppliers(db: Session, include_deleted: bool = False) -> List[Supplier]:
    query = db.query(Supplier)
    if not include_deleted:
        query = query.filter(Supplier.is_deleted == False)
    return query.all()

def get_supplier(db: Session, supplier_id: str) -> Optional[Supplier]:
    return db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.is_deleted == False).first()

def create_supplier(db: Session, supplier: SupplierCreate, user_id: Optional[str] = None) -> Supplier:
    db_sup = Supplier(
        name=supplier.name,
        contact_person=supplier.contact_person,
        phone=supplier.phone,
        email=supplier.email,
        gst_number=supplier.gst_number,
        address=supplier.address,
        material_categories=supplier.material_categories
    )
    db.add(db_sup)
    db.commit()
    db.refresh(db_sup)
    
    # Save version snapshot
    save_version_snapshot(db, "Supplier", db_sup.id, supplier.model_dump(), user_id)
    log_detailed_activity(db, user_id, "Supplier", "create", db_sup.id, f"Created supplier: {db_sup.name}")
    return db_sup

def update_supplier(db: Session, supplier_id: str, supplier_in: SupplierUpdate, user_id: str) -> Optional[Supplier]:
    db_sup = get_supplier(db, supplier_id)
    if not db_sup:
        return None
    update_data = supplier_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_sup, field, value)
    db.commit()
    db.refresh(db_sup)
    
    save_version_snapshot(db, "Supplier", db_sup.id, supplier_in.model_dump(), user_id)
    log_activity(db, user_id, "edit_supplier", f"Updated supplier: {db_sup.name}")
    return db_sup

def delete_supplier(db: Session, supplier_id: str, user_id: str) -> bool:
    db_sup = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not db_sup or db_sup.is_deleted:
        return False
    open_pos = db.query(PurchaseOrder).filter(
        PurchaseOrder.supplier_id == supplier_id,
        PurchaseOrder.status != "received",
        PurchaseOrder.is_deleted == False
    ).all()
    if open_pos:
        po_list_str = "\n".join([po.po_number for po in open_pos])
        raise ValueError(
            f"Cannot archive supplier.\n\n"
            f"Linked Purchase Orders:\n\n"
            f"{po_list_str}\n\n"
            f"[Open Purchase Orders]"
        )
        
    db_sup.is_deleted = True
    db_sup.deleted_at = datetime.utcnow()
    db_sup.deleted_by = user_id
    db.commit()
    log_activity(db, user_id, "delete_supplier", f"Soft deleted supplier: ID {supplier_id}")
    return True

def restore_supplier(db: Session, supplier_id: str, user_id: str) -> bool:
    db_sup = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not db_sup or not db_sup.is_deleted:
        return False
    # Check for active supplier with duplicate name
    conflict = db.query(Supplier).filter(Supplier.name == db_sup.name, Supplier.is_deleted == False, Supplier.id != supplier_id).first()
    if conflict:
        raise ValueError(f"Cannot restore supplier: an active supplier with name '{db_sup.name}' already exists.")
    db_sup.is_deleted = False
    db_sup.deleted_at = None
    db_sup.deleted_by = None
    db.commit()
    log_activity(db, user_id, "restore_supplier", f"Restored supplier: ID {supplier_id}")
    return True

# --- CLIENTS ---
def get_clients(db: Session, include_deleted: bool = False) -> List[Client]:
    query = db.query(Client)
    if not include_deleted:
        query = query.filter(Client.is_deleted == False)
    return query.all()

def get_client(db: Session, client_id: str) -> Optional[Client]:
    return db.query(Client).filter(Client.id == client_id, Client.is_deleted == False).first()

def create_client(db: Session, client: ClientCreate, user_id: Optional[str] = None) -> Client:
    db_client = Client(
        name=client.name,
        contact_person=client.contact_person,
        phone=client.phone,
        email=client.email,
        address=client.address
    )
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    
    save_version_snapshot(db, "Client", db_client.id, client.model_dump(), user_id)
    log_detailed_activity(db, user_id, "Client", "create", db_client.id, f"Created client: {db_client.name}")
    return db_client

def update_client(db: Session, client_id: str, client_in: ClientUpdate, user_id: str) -> Optional[Client]:
    db_client = get_client(db, client_id)
    if not db_client:
        return None
    update_data = client_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_client, field, value)
    db.commit()
    db.refresh(db_client)
    
    save_version_snapshot(db, "Client", db_client.id, client_in.model_dump(), user_id)
    log_activity(db, user_id, "edit_client", f"Updated client: {db_client.name}")
    return db_client

def delete_client(db: Session, client_id: str, user_id: str) -> bool:
    db_client = db.query(Client).filter(Client.id == client_id).first()
    if not db_client or db_client.is_deleted:
        return False
    # Check for active linked projects
    active_projects = db.query(Project).filter(
        Project.client_id == client_id,
        Project.is_deleted == False
    ).count()
    if active_projects > 0:
        raise ValueError("Cannot delete client: active projects are associated with this client. Archive or delete those projects first.")
        
    db_client.is_deleted = True
    db_client.deleted_at = datetime.utcnow()
    db_client.deleted_by = user_id
    db.commit()
    log_activity(db, user_id, "delete_client", f"Soft deleted client: ID {client_id}")
    return True

def restore_client(db: Session, client_id: str, user_id: str) -> bool:
    db_client = db.query(Client).filter(Client.id == client_id).first()
    if not db_client or not db_client.is_deleted:
        return False
    # Check for active client with duplicate name
    conflict = db.query(Client).filter(Client.name == db_client.name, Client.is_deleted == False, Client.id != client_id).first()
    if conflict:
        raise ValueError(f"Cannot restore client: an active client with name '{db_client.name}' already exists.")
    db_client.is_deleted = False
    db_client.deleted_at = None
    db_client.deleted_by = None
    db.commit()
    log_activity(db, user_id, "restore_client", f"Restored client: ID {client_id}")
    return True

# --- INVENTORY ---
def get_inventory_items(db: Session, include_deleted: bool = False) -> List[InventoryItem]:
    query = db.query(InventoryItem).options(
        joinedload(InventoryItem.category),
        joinedload(InventoryItem.supplier)
    )
    if not include_deleted:
        query = query.filter(InventoryItem.is_deleted == False)
    return query.all()

def get_inventory_item(db: Session, item_id: str) -> Optional[InventoryItem]:
    return db.query(InventoryItem).filter(InventoryItem.id == item_id, InventoryItem.is_deleted == False).first()

def get_inventory_item_by_sku(db: Session, sku: str) -> Optional[InventoryItem]:
    return db.query(InventoryItem).filter(InventoryItem.sku == sku, InventoryItem.is_deleted == False).first()

def get_inventory_item_by_barcode(db: Session, barcode: str) -> Optional[InventoryItem]:
    return db.query(InventoryItem).filter(InventoryItem.barcode == barcode, InventoryItem.is_deleted == False).first()

def create_inventory_item(db: Session, item: InventoryItemCreate, user_id: Optional[str] = None) -> InventoryItem:
    db_item = InventoryItem(
        category_id=item.category_id,
        name=item.name,
        sku=item.sku,
        barcode=item.barcode,
        brand=item.brand,
        size_variant=item.size_variant,
        quantity=item.quantity,
        unit=item.unit,
        minimum_stock_level=item.minimum_stock_level,
        unit_cost=item.unit_cost,
        supplier_id=item.supplier_id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    update_inventory_reserved_and_available(db, db_item.id)
    
    check_item_stock_level(db, db_item)
    save_version_snapshot(db, "InventoryItem", db_item.id, item.model_dump(), user_id)
    log_detailed_activity(db, user_id, "Inventory", "create", db_item.id, f"Created inventory item: {db_item.name} ({db_item.sku})")
    return db_item

def update_inventory_item(db: Session, item_id: str, item_in: InventoryItemUpdate, user_id: str) -> Optional[InventoryItem]:
    db_item = get_inventory_item(db, item_id)
    if not db_item:
        return None
        
    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_item, field, value)
        
    db.commit()
    db.refresh(db_item)
    update_inventory_reserved_and_available(db, db_item.id)
    
    check_item_stock_level(db, db_item)
    save_version_snapshot(db, "InventoryItem", db_item.id, item_in.model_dump(), user_id)
    log_activity(db, user_id, "update_inventory", f"Updated inventory item: {db_item.sku}")
    return db_item

def delete_inventory_item(db: Session, item_id: str, user_id: str) -> bool:
    db_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not db_item or db_item.is_deleted:
        return False
    db_item.is_deleted = True
    db_item.deleted_at = datetime.utcnow()
    db_item.deleted_by = user_id
    db.commit()
    update_inventory_reserved_and_available(db, item_id)
    log_activity(db, user_id, "delete_inventory", f"Soft deleted inventory item: ID {item_id}")
    return True

def restore_inventory_item(db: Session, item_id: str, user_id: str) -> bool:
    db_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not db_item or not db_item.is_deleted:
        return False
        
    # Check if the associated supplier is deleted/archived
    if db_item.supplier_id:
        supplier = db.query(Supplier).filter(Supplier.id == db_item.supplier_id).first()
        if supplier and supplier.is_deleted:
            raise ValueError("Cannot restore material: the associated supplier is archived. Restore the supplier first.")
            
    # Check if the associated category is deleted/archived
    if db_item.category_id:
        category = db.query(Category).filter(Category.id == db_item.category_id).first()
        if category and category.is_deleted:
            raise ValueError("Cannot restore material: the associated category is archived. Restore the category first.")

    # Check for active SKU or Barcode conflicts
    conflict_sku = db.query(InventoryItem).filter(
        InventoryItem.sku == db_item.sku,
        InventoryItem.is_deleted == False,
        InventoryItem.id != item_id
    ).first()
    if conflict_sku:
        raise ValueError(f"Cannot restore item: an active item with SKU '{db_item.sku}' already exists.")
        
    conflict_barcode = db.query(InventoryItem).filter(
        InventoryItem.barcode == db_item.barcode,
        InventoryItem.is_deleted == False,
        InventoryItem.id != item_id
    ).first()
    if conflict_barcode:
        raise ValueError(f"Cannot restore item: an active item with barcode '{db_item.barcode}' already exists.")

    db_item.is_deleted = False
    db_item.deleted_at = None
    db_item.deleted_by = None
    db.commit()
    update_inventory_reserved_and_available(db, item_id)
    log_activity(db, user_id, "restore_inventory", f"Restored inventory item: ID {item_id}")
    return True

# Stock Adjustment helper with triggers & logs
def adjust_stock(
    db: Session, 
    inventory_id: str, 
    quantity: float, 
    transaction_type: str, 
    user_id: str, 
    project_id: Optional[str] = None, 
    notes: Optional[str] = None
) -> InventoryItem:
    db_item = db.query(InventoryItem).filter(InventoryItem.id == inventory_id, InventoryItem.is_deleted == False).with_for_update().first()
    if not db_item:
        raise ValueError("Inventory item not found")
        
    if transaction_type in ["out", "damaged", "transfer"] or (transaction_type == "adjustment" and quantity < 0):
        # We are reducing stock
        abs_qty = abs(quantity)
        if db_item.quantity < abs_qty:
            raise ValueError(f"Insufficient stock for {db_item.name}. Available: {db_item.quantity} {db_item.unit}, requested: {abs_qty} {db_item.unit}")
        db_item.quantity -= abs_qty
        actual_qty = -abs_qty
    else:
        # We are increasing stock
        abs_qty = abs(quantity)
        db_item.quantity += abs_qty
        actual_qty = abs_qty
        
    db_item.updated_at = datetime.utcnow()
    
    # Record transaction
    transaction = StockTransaction(
        inventory_id=inventory_id,
        transaction_type=transaction_type,
        quantity=abs_qty,  # Store positive quantity in transaction log
        project_id=project_id,
        user_id=user_id,
        notes=notes
    )
    db.add(transaction)
    db.commit()
    db.refresh(db_item)
    update_inventory_reserved_and_available(db, inventory_id)
    
    # Audit log
    log_activity(db, user_id, "stock_adjustment", f"Stock adjusted for {db_item.sku}: {actual_qty} {db_item.unit} ({transaction_type})")
    
    # Check if stock has fallen below minimum
    check_item_stock_level(db, db_item)
    
    return db_item

def check_item_stock_level(db: Session, item: InventoryItem):
    if item.quantity == 0:
        create_system_notification(
            db,
            title=f"OUT OF STOCK: {item.name}",
            description=f"Material {item.name} ({item.sku}) is completely out of stock!",
            notif_type="out_of_stock"
        )
    elif item.quantity <= item.minimum_stock_level:
        create_system_notification(
            db,
            title=f"LOW STOCK: {item.name}",
            description=f"Material {item.name} ({item.sku}) is below minimum level. Current: {item.quantity} {item.unit} (Min: {item.minimum_stock_level})",
            notif_type="low_stock"
        )

# --- PROJECTS ---
def get_projects(db: Session, include_deleted: bool = False) -> List[Project]:
    query = db.query(Project)
    if not include_deleted:
        query = query.filter(Project.is_deleted == False)
    return query.all()

def get_project(db: Session, project_id: str) -> Optional[Project]:
    return db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()

def create_project(db: Session, project: ProjectCreate, user_id: Optional[str] = None) -> Project:
    db_project = Project(
        name=project.name,
        client_id=project.client_id,
        site_location=project.site_location,
        status=project.status,
        start_date=project.start_date,
        end_date=project.end_date,
        budget=project.budget,
        department=project.department
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    save_version_snapshot(db, "Project", db_project.id, project.model_dump(), user_id)
    log_detailed_activity(db, user_id, "Project", "create", db_project.id, f"Created project: {db_project.name}")
    return db_project
 
def update_project(db: Session, project_id: str, project_in: ProjectUpdate, user_id: Optional[str] = None, ip_address: Optional[str] = None, device: Optional[str] = None) -> Optional[Project]:
    db_project = get_project(db, project_id)
    if not db_project:
        return None
     
    update_data = project_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_project, field, value)
         
    db.commit()
    db.refresh(db_project)
     
    save_version_snapshot(db, "Project", db_project.id, project_in.model_dump(), user_id)
    log_detailed_activity(db, user_id, "Project", "update", db_project.id, f"Updated project: {db_project.name}", ip_address=ip_address, device=device)
    if db_project.status == "delayed":
        create_system_notification(
            db,
            title=f"PROJECT DELAYED: {db_project.name}",
            description=f"Project '{db_project.name}' has been marked as DELAYED.",
            notif_type="project_delay"
        )
         
    return db_project

def delete_project(db: Session, project_id: str, user_id: str, ip_address: Optional[str] = None, device: Optional[str] = None) -> bool:
    # Dependency Check: Check if active BOM elements have already been issued/used, or requests exist
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project or db_project.is_deleted:
        return False
        
    active_mrs = db.query(MaterialRequest).filter(
        MaterialRequest.project_id == project_id,
        MaterialRequest.status.in_(["pending", "approved"]),
        MaterialRequest.is_deleted == False
    ).order_by(MaterialRequest.created_at.asc()).all()
    if active_mrs:
        all_mrs = db.query(MaterialRequest).order_by(MaterialRequest.created_at.asc()).all()
        mr_ids = [mr.id for mr in all_mrs]
        mr_codes = []
        for mr in active_mrs:
            try:
                idx = mr_ids.index(mr.id) + 1
                mr_codes.append(f"MR-{idx:03d}")
            except ValueError:
                mr_codes.append(f"MR-{mr.id[:8]}")
        
        mr_list_str = "\n".join(mr_codes)
        raise ValueError(
            f"Project cannot be archived.\n\n"
            f"Linked Material Requests:\n\n"
            f"{mr_list_str}\n\n"
            f"[Open Requests]"
        )

    db_project.is_deleted = True
    db_project.deleted_at = datetime.utcnow()
    db_project.deleted_by = user_id
    db.commit()
    log_activity(db, user_id, "delete_project", f"Soft deleted project: ID {project_id}", ip_address=ip_address, device=device)
    return True

def restore_project(db: Session, project_id: str, user_id: str, ip_address: Optional[str] = None, device: Optional[str] = None) -> bool:
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project or not db_project.is_deleted:
        return False
        
    # Check if the associated client is deleted/archived
    if db_project.client_id:
        client = db.query(Client).filter(Client.id == db_project.client_id).first()
        if client and client.is_deleted:
            raise ValueError("Cannot restore project: the associated client is deleted/archived. Please restore the client first.")
            
    # Check for active project with duplicate name
    conflict = db.query(Project).filter(Project.name == db_project.name, Project.is_deleted == False, Project.id != project_id).first()
    if conflict:
        raise ValueError(f"Cannot restore project: an active project with name '{db_project.name}' already exists.")

    db_project.is_deleted = False
    db_project.deleted_at = None
    db_project.deleted_by = None
    db.commit()
    log_activity(db, user_id, "restore_project", f"Restored project: ID {project_id}", ip_address=ip_address, device=device)
    return True

# BOM Management
def add_bom_item(db: Session, project_id: str, bom_in: ProjectBOMCreate) -> ProjectBOM:
    db_bom = ProjectBOM(
        project_id=project_id,
        inventory_id=bom_in.inventory_id,
        required_quantity=bom_in.required_quantity,
        used_quantity=0.0,
        status="pending"
    )
    db.add(db_bom)
    db.commit()
    db.refresh(db_bom)
    update_inventory_reserved_and_available(db, db_bom.inventory_id)
    recalculate_project_progress(db, project_id)
    return db_bom

# --- MATERIAL REQUESTS (Approval Pipeline) ---
def get_material_requests(db: Session) -> List[MaterialRequest]:
    return db.query(MaterialRequest).filter(MaterialRequest.is_deleted == False).all()

def create_material_request(db: Session, req: MaterialRequestCreate, user_id: str, ip_address: Optional[str] = None, device: Optional[str] = None) -> MaterialRequest:
    db_req = MaterialRequest(
        project_id=req.project_id,
        inventory_id=req.inventory_id,
        requested_by=user_id,
        quantity=req.quantity,
        notes=req.notes,
        status="pending"
    )
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    
    # Notify managers
    inventory_item = db.query(InventoryItem).filter(InventoryItem.id == req.inventory_id).first()
    project = db.query(Project).filter(Project.id == req.project_id).first()
    proj_name = project.name if project else "Project"
    item_name = inventory_item.name if inventory_item else "Material"
    
    create_system_notification(
        db,
        title="Pending Material Request",
        description=f"{item_name} ({req.quantity}) requested for Project '{proj_name}'.",
        notif_type="request_pending"
    )
    log_detailed_activity(db, user_id, "MaterialRequest", "create", db_req.id, f"Created material request for project: ID {db_req.project_id}", ip_address=ip_address, device=device)
    return db_req

def update_material_request_status(
    db: Session, 
    request_id: str, 
    status: str, 
    user_id: str
) -> Optional[MaterialRequest]:
    db_req = db.query(MaterialRequest).filter(MaterialRequest.id == request_id, MaterialRequest.is_deleted == False).first()
    if not db_req:
        return None
        
    if db_req.status == status:
        return db_req
        
    if db_req.status == "issued":
        raise ValueError("Cannot modify a material request that has already been issued.")
        
    db_req.status = status
    db_req.updated_at = datetime.utcnow()
    
    if status == "approved":
        db_req.approved_by = user_id
    elif status == "issued":
        # Deduct inventory stock
        adjust_stock(
            db=db,
            inventory_id=db_req.inventory_id,
            quantity=db_req.quantity,
            transaction_type="out",
            user_id=user_id,
            project_id=db_req.project_id,
            notes=f"Issued for material request: {db_req.notes or ''}"
        )
        
        # Increment Project BOM usage
        if db_req.project_id:
            bom_item = db.query(ProjectBOM).filter(
                ProjectBOM.project_id == db_req.project_id,
                ProjectBOM.inventory_id == db_req.inventory_id
            ).first()
            
            if bom_item:
                bom_item.used_quantity += db_req.quantity
                bom_item.consumed_quantity += db_req.quantity
                if bom_item.used_quantity >= bom_item.required_quantity:
                    bom_item.status = "fulfilled"
                else:
                    bom_item.status = "partial"
            else:
                # Create a BOM entry if not pre-planned
                bom_item = ProjectBOM(
                    project_id=db_req.project_id,
                    inventory_id=db_req.inventory_id,
                    required_quantity=db_req.quantity,
                    used_quantity=db_req.quantity,
                    consumed_quantity=db_req.quantity,
                    status="fulfilled"
                )
                db.add(bom_item)
                db.flush()
                
            # Create ProjectMaterialHistory entry for issued action
            user = db.query(User).filter(User.id == user_id).first()
            username = user.full_name if user else "Employee"
            history = ProjectMaterialHistory(
                project_id=db_req.project_id,
                inventory_id=db_req.inventory_id,
                user_id=user_id,
                username=username,
                action="issued",
                quantity=db_req.quantity,
                notes=f"Issued from material request ID: {request_id}"
            )
            db.add(history)
            
    db.commit()
    db.refresh(db_req)
    
    log_activity(db, user_id, "material_request_update", f"Material request ID {request_id} updated to {status}")
    return db_req

# --- PURCHASE ORDERS (Purchasing Pipeline) ---
def get_purchase_orders(db: Session) -> List[PurchaseOrder]:
    return db.query(PurchaseOrder).filter(PurchaseOrder.is_deleted == False).all()

def create_purchase_order(db: Session, po: PurchaseOrderCreate, user_id: str) -> PurchaseOrder:
    # Generate unique PO number (e.g. PO-YYYYMMDD-XXXX)
    date_str = datetime.utcnow().strftime("%Y%m%d")
    po_count = db.query(func.count(PurchaseOrder.id)).scalar()
    po_number = f"PO-{date_str}-{po_count + 1:04d}"
    
    total_cost = po.quantity * po.unit_cost
    pending_qty = po.quantity - (po.received_quantity or 0.0)
    
    db_po = PurchaseOrder(
        po_number=po_number,
        supplier_id=po.supplier_id,
        inventory_id=po.inventory_id,
        quantity=po.quantity,
        unit_cost=po.unit_cost,
        total_cost=total_cost,
        status="pending",
        category=po.category,
        requested_by=user_id,
        # Additional fields
        po_date=po.po_date or date.today(),
        vendor_name=po.vendor_name,
        vendor_contact=po.vendor_contact,
        vendor_gst=po.vendor_gst,
        vendor_address=po.vendor_address,
        material_name=po.material_name,
        sku=po.sku,
        unit=po.unit,
        expected_delivery_date=po.expected_delivery_date,
        received_quantity=po.received_quantity or 0.0,
        pending_quantity=pending_qty,
        invoice_number=po.invoice_number,
        invoice_date=po.invoice_date,
        payment_status=po.payment_status or "Pending",
        remarks=po.remarks
    )
    db.add(db_po)
    db.commit()
    db.refresh(db_po)
    log_detailed_activity(db, user_id, "PurchaseOrder", "create", db_po.id, f"Created PO {db_po.po_number}")
    return db_po

def update_purchase_order(
    db: Session,
    po_id: str,
    user_id: str,
    status: Optional[str] = None,
    received_quantity: Optional[float] = None,
    invoice_number: Optional[str] = None,
    invoice_date: Optional[date] = None,
    payment_status: Optional[str] = None,
    remarks: Optional[str] = None,
    expected_delivery_date: Optional[date] = None,
    po_date: Optional[date] = None,
    vendor_name: Optional[str] = None,
    vendor_contact: Optional[str] = None,
    vendor_gst: Optional[str] = None,
    vendor_address: Optional[str] = None,
    quantity: Optional[float] = None,
    unit_cost: Optional[float] = None
) -> Optional[PurchaseOrder]:
    db_po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id, PurchaseOrder.is_deleted == False).first()
    if not db_po:
        return None
        
    stock_adj = 0.0
    
    if received_quantity is not None and received_quantity != db_po.received_quantity:
        stock_adj = received_quantity - (db_po.received_quantity or 0.0)
        db_po.received_quantity = received_quantity
        qty = quantity if quantity is not None else db_po.quantity
        db_po.pending_quantity = max(0.0, qty - received_quantity)
        
    if quantity is not None:
        db_po.quantity = quantity
        rec_qty = received_quantity if received_quantity is not None else (db_po.received_quantity or 0.0)
        db_po.pending_quantity = max(0.0, quantity - rec_qty)
        if unit_cost is not None:
            db_po.unit_cost = unit_cost
            db_po.total_cost = quantity * unit_cost
        else:
            db_po.total_cost = quantity * db_po.unit_cost
    elif unit_cost is not None:
        db_po.unit_cost = unit_cost
        db_po.total_cost = db_po.quantity * unit_cost

    if status is not None:
        old_status = db_po.status
        db_po.status = status
        
        # Adjust stock if status changes to received/fully_received
        if status in ["received", "fully_received"] and old_status not in ["received", "fully_received", "partially_received"]:
            if stock_adj == 0.0:
                if not db_po.received_quantity:
                    db_po.received_quantity = db_po.quantity
                    db_po.pending_quantity = 0.0
                    stock_adj = db_po.quantity
                else:
                    stock_adj = db_po.pending_quantity
                    db_po.received_quantity = db_po.quantity
                    db_po.pending_quantity = 0.0

    if po_date is not None:
        db_po.po_date = po_date
    if vendor_name is not None:
        db_po.vendor_name = vendor_name
    if vendor_contact is not None:
        db_po.vendor_contact = vendor_contact
    if vendor_gst is not None:
        db_po.vendor_gst = vendor_gst
    if vendor_address is not None:
        db_po.vendor_address = vendor_address
    if expected_delivery_date is not None:
        db_po.expected_delivery_date = expected_delivery_date
    if invoice_number is not None:
        db_po.invoice_number = invoice_number
    if invoice_date is not None:
        db_po.invoice_date = invoice_date
    if payment_status is not None:
        db_po.payment_status = payment_status
    if remarks is not None:
        db_po.remarks = remarks
        
    db_po.updated_at = datetime.utcnow()
    
    if stock_adj > 0.0:
        adjust_stock(
            db=db,
            inventory_id=db_po.inventory_id,
            quantity=stock_adj,
            transaction_type="in",
            user_id=user_id,
            notes=f"Goods received from Purchase Order {db_po.po_number}"
        )
    elif stock_adj < 0.0:
        adjust_stock(
            db=db,
            inventory_id=db_po.inventory_id,
            quantity=abs(stock_adj),
            transaction_type="out",
            user_id=user_id,
            notes=f"Goods returned/adjusted from Purchase Order {db_po.po_number}"
        )
        
    db.commit()
    db.refresh(db_po)
    log_detailed_activity(db, user_id, "PurchaseOrder", "update", db_po.id, f"Updated PO {db_po.po_number}")
    return db_po

def update_purchase_order_status(
    db: Session, 
    po_id: str, 
    status: str, 
    user_id: str
) -> Optional[PurchaseOrder]:
    return update_purchase_order(db=db, po_id=po_id, status=status, user_id=user_id)

# --- SHIFTS & RULES ---
def get_shifts(db: Session) -> List[Shift]:
    return db.query(Shift).filter(Shift.is_deleted == False).all()

def get_shift(db: Session, shift_id: str) -> Optional[Shift]:
    return db.query(Shift).filter(Shift.id == shift_id, Shift.is_deleted == False).first()

def create_shift(db: Session, shift: ShiftCreate) -> Shift:
    db_shift = Shift(
        name=shift.name,
        check_in_time=shift.check_in_time,
        check_out_time=shift.check_out_time
    )
    db.add(db_shift)
    db.commit()
    db.refresh(db_shift)
    return db_shift

def update_shift(db: Session, shift_id: str, shift_in: ShiftCreate) -> Optional[Shift]:
    db_shift = get_shift(db, shift_id)
    if not db_shift:
        return None
    db_shift.name = shift_in.name
    db_shift.check_in_time = shift_in.check_in_time
    db_shift.check_out_time = shift_in.check_out_time
    db.commit()
    db.refresh(db_shift)
    return db_shift

def delete_shift(db: Session, shift_id: str) -> bool:
    db_shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not db_shift or db_shift.is_deleted:
        return False
    db_shift.is_deleted = True
    # Unassign staff members having this shift
    db.query(Staff).filter(Staff.shift_id == shift_id).update({Staff.shift_id: None})
    db.commit()
    return True

def get_attendance_rules(db: Session) -> AttendanceRule:
    rule = db.query(AttendanceRule).first()
    if not rule:
        rule = AttendanceRule(
            late_grace_minutes=0,
            half_day_threshold_hours=4.0,
            min_hours_present=8.0
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)
    return rule

def update_attendance_rule(db: Session, rule_in: AttendanceRuleUpdate) -> AttendanceRule:
    rule = db.query(AttendanceRule).first()
    if not rule:
        rule = AttendanceRule(
            late_grace_minutes=rule_in.late_grace_minutes,
            half_day_threshold_hours=rule_in.half_day_threshold_hours,
            min_hours_present=rule_in.min_hours_present
        )
        db.add(rule)
    else:
        rule.late_grace_minutes = rule_in.late_grace_minutes
        rule.half_day_threshold_hours = rule_in.half_day_threshold_hours
        rule.min_hours_present = rule_in.min_hours_present
    db.commit()
    db.refresh(rule)
    return rule

# --- STAFF & ATTENDANCE ---
def get_staff(db: Session, include_deleted: bool = False) -> List[Staff]:
    query = db.query(Staff)
    if not include_deleted:
        query = query.filter(Staff.is_deleted == False)
    return query.all()

def get_staff_member(db: Session, staff_id: str) -> Optional[Staff]:
    return db.query(Staff).filter(Staff.id == staff_id, Staff.is_deleted == False).first()

def create_staff(db: Session, staff: StaffCreate, user_id: Optional[str] = None) -> Staff:
    db_staff = Staff(
        name=staff.name,
        role=staff.role,
        phone=staff.phone,
        email=staff.email,
        salary=staff.salary,
        status=staff.status,
        shift_id=staff.shift_id
    )
    if staff.email:
        user = db.query(User).filter(func.lower(User.email) == func.lower(staff.email), User.is_deleted == False).first()
        if user:
            db_staff.user_id = user.id
 
    db.add(db_staff)
    db.commit()
    db.refresh(db_staff)
     
    save_version_snapshot(db, "Staff", db_staff.id, staff.model_dump(), user_id)
    log_detailed_activity(db, user_id, "Staff", "create", db_staff.id, f"Created staff employee: {db_staff.name}")
    return db_staff

def update_staff(db: Session, staff_id: str, staff_in: StaffUpdate, user_id: str) -> Optional[Staff]:
    db_staff = get_staff_member(db, staff_id)
    if not db_staff:
        return None
    update_data = staff_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_staff, field, value)
        
    if "email" in update_data:
        if db_staff.email:
            user = db.query(User).filter(func.lower(User.email) == func.lower(db_staff.email), User.is_deleted == False).first()
            db_staff.user_id = user.id if user else None
        else:
            db_staff.user_id = None

    db.commit()
    db.refresh(db_staff)
    
    save_version_snapshot(db, "Staff", db_staff.id, staff_in.model_dump(), user_id)
    log_activity(db, user_id, "edit_staff", f"Updated staff employee: {db_staff.name}")
    return db_staff

def delete_staff(db: Session, staff_id: str, user_id: str) -> bool:
    db_staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not db_staff or db_staff.is_deleted:
        return False
    db_staff.is_deleted = True
    db_staff.deleted_at = datetime.utcnow()
    db_staff.deleted_by = user_id
    db.commit()
    log_activity(db, user_id, "delete_staff", f"Soft deleted staff employee: ID {staff_id}")
    return True

def restore_staff(db: Session, staff_id: str, user_id: str) -> bool:
    db_staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not db_staff or not db_staff.is_deleted:
        return False
    if db_staff.email:
        conflict = db.query(Staff).filter(
            func.lower(Staff.email) == func.lower(db_staff.email),
            Staff.is_deleted == False,
            Staff.id != staff_id
        ).first()
        if conflict:
            raise ValueError(f"Cannot restore employee: an active employee with email '{db_staff.email}' already exists.")
    db_staff.is_deleted = False
    db_staff.deleted_at = None
    db_staff.deleted_by = None
    db_staff.status = "active"  # Re-activate staff on restore

    # Also restore the associated User record so they can login again
    if db_staff.user_id:
        db_user = db.query(User).filter(User.id == db_staff.user_id).first()
        if db_user:
            db_user.is_deleted = False
            db_user.deleted_at = None
            db_user.deleted_by = None
            db_user.status = "active"  # Re-activate user account on restore

    db.commit()
    log_activity(db, user_id, "restore_staff", f"Restored staff employee: ID {staff_id}")
    return True


def get_attendance(db: Session, target_date: Optional[date] = None) -> List[Attendance]:
    query = db.query(Attendance).join(Staff).filter(Staff.is_deleted == False)
    if target_date:
        query = query.filter(Attendance.date == target_date)
    return query.all()


def log_attendance(db: Session, att: AttendanceCreate) -> Attendance:
    existing = db.query(Attendance).filter(
        Attendance.staff_id == att.staff_id,
        Attendance.date == att.date
    ).first()
    
    if existing:
        existing.status = att.status
        existing.check_in = att.check_in
        existing.check_out = att.check_out
        db.commit()
        db.refresh(existing)
        return existing
    else:
        db_att = Attendance(
            staff_id=att.staff_id,
            date=att.date,
            status=att.status,
            check_in=att.check_in,
            check_out=att.check_out
        )
        db.add(db_att)
        db.commit()
        db.refresh(db_att)
        return db_att


def time_to_minutes(time_str: str) -> int:
    try:
        h, m = map(int, time_str.split(":"))
        return h * 60 + m
    except Exception:
        return 0

def attendance_check_in(
    db: Session,
    staff_id: str,
    date_val: date,
    time_str: str,
    device: Optional[str] = None,
    ip_address: Optional[str] = None,
    device_fingerprint: Optional[str] = None,
    browser_details: Optional[str] = None
) -> Attendance:
    existing = db.query(Attendance).filter(
        Attendance.staff_id == staff_id,
        Attendance.date == date_val
    ).first()
    
    if existing:
        raise ValueError("Already checked in today")
        
    staff_member = db.query(Staff).filter(Staff.id == staff_id).first()
    rules = get_attendance_rules(db)
    grace = rules.late_grace_minutes if rules else 0
    
    shift_check_in = staff_member.shift.check_in_time if (staff_member and staff_member.shift) else "09:30"
    
    check_in_mins = time_to_minutes(time_str)
    shift_in_mins = time_to_minutes(shift_check_in)
    
    late_arrival = check_in_mins > (shift_in_mins + grace)
    
    # Anti-proxy duplicate device fingerprint check
    is_suspicious = False
    suspicious_reason = None
    if device_fingerprint:
        duplicates = db.query(Attendance).filter(
            Attendance.date == date_val,
            Attendance.check_in_fingerprint == device_fingerprint,
            Attendance.staff_id != staff_id
        ).all()
        if duplicates:
            is_suspicious = True
            suspicious_reason = f"Proxy Alert: Same device fingerprint '{device_fingerprint}' used by multiple employees for checkin."
            for dup in duplicates:
                dup.is_suspicious = True
                dup.suspicious_reason = (dup.suspicious_reason + "; " + suspicious_reason) if dup.suspicious_reason else suspicious_reason
            create_system_notification(
                db,
                title="Proxy Attempt Detected",
                description=f"Multiple employees checked in using the same device fingerprint today.",
                notif_type="proxy_alert"
            )
            
    # Look up last attendance record for the employee
    last_att = db.query(Attendance).filter(
        Attendance.staff_id == staff_id
    ).order_by(Attendance.date.desc()).first()
    
    if last_att:
        patterns = []
        if device_fingerprint and last_att.check_in_fingerprint and device_fingerprint != last_att.check_in_fingerprint:
            patterns.append("device fingerprint changed from yesterday")
        if ip_address and last_att.ip_address and ip_address != last_att.ip_address:
            patterns.append("IP address changed from yesterday")
        if browser_details and last_att.check_in_browser and browser_details != last_att.check_in_browser:
            patterns.append("browser details changed from yesterday")
            
        if patterns:
            is_suspicious = True
            change_reason = "Suspicious Pattern: Attendance " + " and ".join(patterns) + "."
            suspicious_reason = (suspicious_reason + "; " + change_reason) if suspicious_reason else change_reason
            create_system_notification(
                db,
                title="Proxy Attempt Detected",
                description=f"Employee check-in details changed from their last attendance record.",
                notif_type="proxy_alert"
            )
            
    db_att = Attendance(
        staff_id=staff_id,
        date=date_val,
        status="present",
        check_in=time_str,
        check_out=None,
        device=device,
        ip_address=ip_address,
        total_hours=0.0,
        overtime_hours=0.0,
        late_arrival=late_arrival,
        early_departure=False,
        check_in_fingerprint=device_fingerprint,
        check_in_browser=browser_details,
        is_suspicious=is_suspicious,
        suspicious_reason=suspicious_reason
    )
    db.add(db_att)
    db.commit()
    db.refresh(db_att)
    return db_att


def attendance_check_out(
    db: Session,
    staff_id: str,
    date_val: date,
    time_str: str,
    device: Optional[str] = None,
    ip_address: Optional[str] = None,
    device_fingerprint: Optional[str] = None,
    browser_details: Optional[str] = None,
    project_id: Optional[str] = None,
    task: Optional[str] = None,
    work_photo: Optional[str] = None,
    remarks: Optional[str] = None,
    progress_percentage: Optional[int] = None
) -> Attendance:
    db_att = db.query(Attendance).filter(
        Attendance.staff_id == staff_id,
        Attendance.date == date_val
    ).first()
    
    if not db_att or not db_att.check_in:
        raise ValueError("Must check in first")
        
    if db_att.check_out:
        raise ValueError("Already checked out today")
        
    staff_member = db.query(Staff).filter(Staff.id == staff_id).first()
    if staff_member and staff_member.shift:
        role_lower = staff_member.role.lower()
        if "admin" not in role_lower and "manager" not in role_lower:
            if time_to_minutes(time_str) < time_to_minutes(staff_member.shift.check_out_time):
                raise ValueError("You cannot check out before shift completion.")
                
    db_att.check_out = time_str
    db_att.check_out_device = device
    db_att.check_out_ip = ip_address
    db_att.check_out_fingerprint = device_fingerprint
    db_att.check_out_browser = browser_details
    
    # Project-linked details
    if project_id:
        db_att.project_id = project_id
    if task:
        db_att.task = task
    if work_photo:
        db_att.work_photo = work_photo
    if remarks:
        db_att.remarks = remarks
    if progress_percentage is not None:
        db_att.progress_percentage = progress_percentage
        
    # Anti-Proxy Verification
    reasons = []
    if db_att.check_in_fingerprint and device_fingerprint and db_att.check_in_fingerprint != device_fingerprint:
        reasons.append("Device fingerprint mismatch")
    if db_att.ip_address and ip_address and db_att.ip_address != ip_address:
        reasons.append("IP address mismatch")
    if db_att.check_in_browser and browser_details and db_att.check_in_browser != browser_details:
        reasons.append("Browser details mismatch")
        
    if device_fingerprint:
        duplicates = db.query(Attendance).filter(
            Attendance.date == date_val,
            Attendance.check_out_fingerprint == device_fingerprint,
            Attendance.staff_id != staff_id
        ).all()
        if duplicates:
            reasons.append(f"Proxy Alert: Same device fingerprint '{device_fingerprint}' used by multiple employees for checkout.")
            for dup in duplicates:
                dup.is_suspicious = True
                dup_reason = f"Proxy Alert: Same device fingerprint '{device_fingerprint}' used by multiple employees."
                dup.suspicious_reason = (dup.suspicious_reason + "; " + dup_reason) if dup.suspicious_reason else dup_reason
            create_system_notification(
                db,
                title="Proxy Attempt Detected",
                description=f"Multiple employees checked out using the same device fingerprint today.",
                notif_type="proxy_alert"
            )
            
    if reasons:
        db_att.is_suspicious = True
        added_reasons = "; ".join(reasons)
        db_att.suspicious_reason = (db_att.suspicious_reason + "; " + added_reasons) if db_att.suspicious_reason else added_reasons
        log_detailed_activity(
            db, None, "Attendance", "flag_suspicious", db_att.id,
            f"Suspicious attendance flagged for staff ID {staff_id}: {db_att.suspicious_reason}"
        )
    
    # Calculate hours
    try:
        in_total = time_to_minutes(db_att.check_in)
        out_total = time_to_minutes(time_str)
        diff = out_total - in_total
        total_hours = max(0.0, round(diff / 60.0, 2))
    except Exception:
        total_hours = 8.0  # Default fallback if parsing fails
        
    # Calculate overtime
    overtime_hours = 0.0
    shift_end = staff_member.shift.check_out_time if (staff_member and staff_member.shift) else "18:00"
    try:
        if time_str > shift_end:
            limit_total = time_to_minutes(shift_end)
            ot_diff = out_total - limit_total
            overtime_hours = max(0.0, round(ot_diff / 60.0, 2))
    except Exception:
        pass
        
    early_departure = False
    if staff_member and staff_member.shift:
        early_departure = time_to_minutes(time_str) < time_to_minutes(staff_member.shift.check_out_time)
    else:
        early_departure = time_str < "18:00"
        
    db_att.total_hours = total_hours
    db_att.overtime_hours = overtime_hours
    db_att.early_departure = early_departure
    
    # Update status based on threshold rules
    rules = get_attendance_rules(db)
    half_day_threshold = rules.half_day_threshold_hours if rules else 4.0
    if total_hours < half_day_threshold:
        db_att.status = "half_day"
    else:
        db_att.status = "present"
        
    db.commit()
    db.refresh(db_att)
    return db_att


# --- NOTIFICATIONS ---
def get_notifications(db: Session, unread_only: bool = False) -> List[Notification]:
    query = db.query(Notification)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    return query.order_by(Notification.created_at.desc()).all()

def mark_notification_as_read(db: Session, notification_id: str) -> Optional[Notification]:
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        notif.is_read = True
        db.commit()
        db.refresh(notif)
    return notif

# --- ACTIVITY LOGS ---
def get_activity_logs(db: Session) -> List[ActivityLog]:
    return db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).all()


# --- CUSTOM FIELD CONFIGURATION DYNAMIC ENGINE ---

def get_custom_field_definitions(db: Session, entity_type: str) -> List[CustomFieldDefinition]:
    return db.query(CustomFieldDefinition).filter(CustomFieldDefinition.entity_type == entity_type).all()

def create_custom_field_definition(db: Session, definition: CustomFieldDefinitionCreate) -> CustomFieldDefinition:
    db_def = CustomFieldDefinition(
        entity_type=definition.entity_type,
        name=definition.name,
        label=definition.label,
        field_type=definition.field_type,
        is_required=definition.is_required,
        choices=definition.choices
    )
    db.add(db_def)
    db.commit()
    db.refresh(db_def)
    return db_def

def delete_custom_field_definition(db: Session, field_id: str) -> bool:
    db_def = db.query(CustomFieldDefinition).filter(CustomFieldDefinition.id == field_id).first()
    if not db_def:
        return False
    db.delete(db_def)
    db.commit()
    return True

def get_custom_field_values(db: Session, entity_id: str) -> List[CustomFieldValue]:
    return db.query(CustomFieldValue).filter(CustomFieldValue.entity_id == entity_id).all()

def save_custom_field_value(db: Session, value_in: CustomFieldValueCreate) -> CustomFieldValue:
    # Check if value already exists
    existing = db.query(CustomFieldValue).filter(
        CustomFieldValue.field_definition_id == value_in.field_definition_id,
        CustomFieldValue.entity_id == value_in.entity_id
    ).first()
    
    if existing:
        existing.value_text = value_in.value_text
        db.commit()
        db.refresh(existing)
        return existing
    else:
        db_val = CustomFieldValue(
            field_definition_id=value_in.field_definition_id,
            entity_id=value_in.entity_id,
            value_text=value_in.value_text
        )
        db.add(db_val)
        db.commit()
        db.refresh(db_val)
        return db_val


# --- WORKFLOWS ENGINE ---

def get_workflow_definitions(db: Session) -> List[WorkflowDefinition]:
    return db.query(WorkflowDefinition).all()

def create_workflow_definition(db: Session, wf_in: WorkflowDefinitionCreate) -> WorkflowDefinition:
    db_wf = WorkflowDefinition(
        entity_type=wf_in.entity_type,
        name=wf_in.name,
        description=wf_in.description
    )
    db.add(db_wf)
    db.commit()
    db.refresh(db_wf)
    
    # Add steps
    for step in wf_in.steps:
        db_step = WorkflowStep(
            workflow_id=db_wf.id,
            step_name=step.step_name,
            step_order=step.step_order,
            role_allowed_to_execute=step.role_allowed_to_execute
        )
        db.add(db_step)
    db.commit()
    db.refresh(db_wf)
    return db_wf


# --- APPROVAL MATRIX RULES ---

def get_approval_rules(db: Session) -> List[ApprovalRule]:
    return db.query(ApprovalRule).all()

def create_approval_rule(db: Session, rule_in: ApprovalRuleCreate) -> ApprovalRule:
    rule = ApprovalRule(
        entity_type=rule_in.entity_type,
        min_value=rule_in.min_value,
        max_value=rule_in.max_value,
        role_approver=rule_in.role_approver
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


# --- DASHBOARD WIDGETS LAYOUTS ---

def get_dashboard_widgets(db: Session, user_id: str) -> List[DashboardWidget]:
    return db.query(DashboardWidget).filter(DashboardWidget.user_id == user_id).all()

def save_dashboard_widget(db: Session, user_id: str, widget_in: DashboardWidgetCreate) -> DashboardWidget:
    # Overwrite if widget type already present for that user to prevent duplicate stacks
    existing = db.query(DashboardWidget).filter(
        DashboardWidget.user_id == user_id,
        DashboardWidget.widget_type == widget_in.widget_type
    ).first()
    
    if existing:
        existing.title = widget_in.title
        existing.layout_x = widget_in.layout_x
        existing.layout_y = widget_in.layout_y
        existing.layout_w = widget_in.layout_w
        existing.layout_h = widget_in.layout_h
        db.commit()
        db.refresh(existing)
        return existing
    else:
        db_widget = DashboardWidget(
            user_id=user_id,
            title=widget_in.title,
            widget_type=widget_in.widget_type,
            layout_x=widget_in.layout_x,
            layout_y=widget_in.layout_y,
            layout_w=widget_in.layout_w,
            layout_h=widget_in.layout_h
        )
        db.add(db_widget)
        db.commit()
        db.refresh(db_widget)
        return db_widget

def delete_dashboard_widget(db: Session, widget_id: str, user_id: str) -> bool:
    widget = db.query(DashboardWidget).filter(DashboardWidget.id == widget_id, DashboardWidget.user_id == user_id).first()
    if not widget:
        return False
    db.delete(widget)
    db.commit()
    return True


# --- TASKS MODULE ---

def get_tasks(db: Session, include_deleted: bool = False) -> List[Task]:
    query = db.query(Task)
    if not include_deleted:
        query = query.filter(Task.is_deleted == False)
    return query.all()

def create_task(db: Session, task: TaskCreate) -> Task:
    db_task = Task(
        title=task.title,
        description=task.description,
        assigned_to=task.assigned_to,
        deadline=task.deadline,
        priority=task.priority,
        status=task.status
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def update_task(db: Session, task_id: str, task_in: TaskUpdate) -> Optional[Task]:
    db_task = db.query(Task).filter(Task.id == task_id, Task.is_deleted == False).first()
    if not db_task:
        return None
    update_data = task_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_task, field, value)
    db.commit()
    db.refresh(db_task)
    return db_task

def delete_task(db: Session, task_id: str, user_id: str) -> bool:
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task or db_task.is_deleted:
        return False
    db_task.is_deleted = True
    db_task.deleted_at = datetime.utcnow()
    db_task.deleted_by = user_id
    db.commit()
    return True


# --- DOCUMENT MANAGEMENT ---

def get_documents(db: Session, entity_type: Optional[str] = None, entity_id: Optional[str] = None) -> List[Document]:
    query = db.query(Document).filter(Document.is_deleted == False)
    if entity_type:
        query = query.filter(Document.entity_type == entity_type)
    if entity_id:
        query = query.filter(Document.entity_id == entity_id)
    return query.all()

def create_document(db: Session, doc_in: DocumentCreate, user_id: str) -> Document:
    db_doc = Document(
        name=doc_in.name,
        file_path=doc_in.file_path,
        category=doc_in.category,
        uploaded_by=user_id,
        entity_type=doc_in.entity_type,
        entity_id=doc_in.entity_id
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    return db_doc

def delete_document(db: Session, doc_id: str, user_id: str) -> bool:
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc or doc.is_deleted:
        return False
    doc.is_deleted = True
    doc.deleted_at = datetime.utcnow()
    doc.deleted_by = user_id
    db.commit()
    return True


# --- HISTORICAL VERSION HISTORY ---

def get_version_histories(db: Session, entity_type: str, entity_id: str) -> List[VersionHistory]:
    return db.query(VersionHistory).filter(
        VersionHistory.entity_type == entity_type,
        VersionHistory.entity_id == entity_id
    ).order_by(VersionHistory.version_num.desc()).all()


# --- PROJECT ASSIGNMENTS ---

def get_project_assignments(db: Session, project_id: str) -> List[ProjectAssignment]:
    return db.query(ProjectAssignment).filter(ProjectAssignment.project_id == project_id).all()

def create_project_assignment(db: Session, project_id: str, user_id: str) -> ProjectAssignment:
    existing = db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == project_id,
        ProjectAssignment.user_id == user_id
    ).first()
    if existing:
        return existing
    assignment = ProjectAssignment(project_id=project_id, user_id=user_id)
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment

def auto_assign_project_resources(db: Session, project: Project):
    # 1. Automatically assign Project Manager (users with role 'manager' or 'project_manager')
    pms = db.query(User).filter(User.role.in_(["manager", "project_manager"]), User.is_deleted == False).all()
    for pm in pms:
        create_project_assignment(db, project.id, pm.id)
        
    # 2. Automatically assign Store Manager (users with role 'store', 'store_manager')
    sms = db.query(User).filter(User.role.in_(["store", "store_manager"]), User.is_deleted == False).all()
    for sm in sms:
        create_project_assignment(db, project.id, sm.id)
        
    # 3. Automatically assign Purchase Team (users with role 'accountant', 'purchase_manager')
    pts = db.query(User).filter(User.role.in_(["accountant", "purchase_manager"]), User.is_deleted == False).all()
    for pt in pts:
        create_project_assignment(db, project.id, pt.id)
        
    # 4. Automatically assign Employees (workers, carpenters, operators, quality_inspectors, machine_operators, employees)
    # matching the project department (if specified)
    if project.department:
        worker_roles = [
            "worker", "carpenter", "operator", "machine_operator", 
            "quality_inspector", "store_assistant", "employee"
        ]
        emps = db.query(User).filter(
            User.role.in_(worker_roles),
            User.department == project.department,
            User.is_deleted == False
        ).all()
        for emp in emps:
            create_project_assignment(db, project.id, emp.id)


def delete_project_assignment(db: Session, project_id: str, user_id: str) -> bool:
    assignment = db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == project_id,
        ProjectAssignment.user_id == user_id
    ).first()
    if not assignment:
        return False
    db.delete(assignment)
    db.commit()
    return True

def get_user_project_ids(db: Session, user_id: str) -> List[str]:
    return [a.project_id for a in db.query(ProjectAssignment.project_id).filter(ProjectAssignment.user_id == user_id).all()]


# --- DAILY WORK LOGS ---

def create_daily_work_log(
    db: Session,
    user_id: str,
    project_id: str,
    task: str,
    hours_worked: float,
    progress_percentage: int,
    remarks: Optional[str] = None,
    work_photo: Optional[str] = None
) -> DailyWorkLog:
    log = DailyWorkLog(
        user_id=user_id,
        project_id=project_id,
        task=task,
        hours_worked=hours_worked,
        progress_percentage=progress_percentage,
        remarks=remarks,
        work_photo=work_photo
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

def get_daily_work_logs(db: Session, user_id: Optional[str] = None) -> List[DailyWorkLog]:
    query = db.query(DailyWorkLog)
    if user_id:
        query = query.filter(DailyWorkLog.user_id == user_id)
    return query.order_by(DailyWorkLog.created_at.desc()).all()


# Daily Expense CRUD
def create_daily_expense(db: Session, exp: DailyExpenseCreate, user_id: str) -> DailyExpense:
    target_date = exp.expense_date or date.today()
    date_str = target_date.strftime("%Y%m%d")
    exp_count = db.query(func.count(DailyExpense.id)).filter(DailyExpense.expense_date == target_date).scalar()
    expense_id = f"EXP-{date_str}-{exp_count + 1:04d}"
    
    db_exp = DailyExpense(
        expense_id=expense_id,
        expense_date=target_date,
        expense_category=exp.expense_category,
        description=exp.description,
        amount=exp.amount,
        vendor=exp.vendor,
        project_id=exp.project_id,
        created_by=user_id,
        attachment_url=exp.attachment_url
    )
    db.add(db_exp)
    db.commit()
    db.refresh(db_exp)
    log_detailed_activity(db, user_id, "DailyExpense", "create", db_exp.id, f"Created expense {db_exp.expense_id} of amount {db_exp.amount}")
    return db_exp

def get_daily_expenses(
    db: Session,
    project_id: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> List[DailyExpense]:
    query = db.query(DailyExpense).filter(DailyExpense.is_deleted == False)
    if project_id:
        query = query.filter(DailyExpense.project_id == project_id)
    if category:
        query = query.filter(DailyExpense.expense_category == category)
    if start_date:
        query = query.filter(DailyExpense.expense_date >= start_date)
    if end_date:
        query = query.filter(DailyExpense.expense_date <= end_date)
    return query.order_by(DailyExpense.expense_date.desc()).all()

def delete_daily_expense(db: Session, expense_id: str, user_id: str) -> Optional[DailyExpense]:
    db_exp = db.query(DailyExpense).filter(DailyExpense.id == expense_id, DailyExpense.is_deleted == False).first()
    if not db_exp:
        return None
    db_exp.is_deleted = True
    db.commit()
    log_detailed_activity(db, user_id, "DailyExpense", "delete", expense_id, f"Soft-deleted expense {db_exp.expense_id}")
    return db_exp


# --- PROJECT MATERIALS & TRANSFERS CRUD (NEW) ---

from models import ProjectMaterialHistory, AuditLog, ProjectBOM, StockTransaction

def log_audit(
    db: Session,
    user_id: Optional[str],
    project_id: Optional[str],
    inventory_id: Optional[str],
    action: str,
    details: Optional[str],
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
    device: Optional[str] = None,
    browser: Optional[str] = None,
    device_time: Optional[str] = None
) -> AuditLog:
    db_log = AuditLog(
        user_id=user_id,
        project_id=project_id,
        inventory_id=inventory_id,
        action=action,
        details=details,
        old_value=old_value,
        new_value=new_value,
        reason=reason,
        ip_address=ip_address,
        device=device,
        browser=browser,
        device_time=device_time
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def get_project_material_history(db: Session, project_id: str) -> List[ProjectMaterialHistory]:
    return db.query(ProjectMaterialHistory).filter(ProjectMaterialHistory.project_id == project_id).order_by(ProjectMaterialHistory.created_at.desc()).all()

def record_material_usage(
    db: Session,
    project_id: str,
    inventory_id: str,
    user_id: str,
    action: str,
    quantity: float,
    notes: Optional[str] = None,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
    device: Optional[str] = None,
    browser: Optional[str] = None
) -> ProjectMaterialHistory:
    inventory = db.query(InventoryItem).filter(InventoryItem.id == inventory_id, InventoryItem.is_deleted == False).first()
    if not inventory:
        raise ValueError("Inventory item not found")

    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise ValueError("Project not found")

    bom = db.query(ProjectBOM).filter(ProjectBOM.project_id == project_id, ProjectBOM.inventory_id == inventory_id).first()
    if not bom:
        bom = ProjectBOM(
            project_id=project_id,
            inventory_id=inventory_id,
            required_quantity=0.0,
            used_quantity=0.0,
            consumed_quantity=0.0,
            status="pending"
        )
        db.add(bom)
        db.flush()

    old_inv_qty = inventory.quantity
    old_bom_qty = bom.used_quantity

    user = db.query(User).filter(User.id == user_id).first()
    username = user.full_name if user else "Employee"

    if action == "used":
        if inventory.quantity < quantity:
            raise ValueError(f"Insufficient inventory stock. Available: {inventory.quantity} {inventory.unit}")
        
        inventory.quantity -= quantity
        bom.used_quantity += quantity
        bom.consumed_quantity += quantity # Keep consumed in sync for standard cost engine compatibility
        
        # Log stock transaction
        tx = StockTransaction(
            inventory_id=inventory_id,
            transaction_type="out",
            quantity=-quantity,
            project_id=project_id,
            user_id=user_id,
            notes=f"Used in Project: {project.name}. Notes: {notes or ''}"
        )
        db.add(tx)
        
    elif action == "returned":
        if bom.used_quantity < quantity:
            raise ValueError(f"Cannot return more than used quantity. Assigned used: {bom.used_quantity} {inventory.unit}")
        
        inventory.quantity += quantity
        bom.used_quantity -= quantity
        bom.consumed_quantity = max(0.0, bom.consumed_quantity - quantity)
        
        # Log stock transaction
        tx = StockTransaction(
            inventory_id=inventory_id,
            transaction_type="return",
            quantity=quantity,
            project_id=project_id,
            user_id=user_id,
            notes=f"Returned from Project: {project.name}. Notes: {notes or ''}"
        )
        db.add(tx)
        
    else:
        raise ValueError("Invalid action. Must be 'used' or 'returned'")

    # Update BOM status
    if bom.required_quantity > 0:
        if bom.used_quantity >= bom.required_quantity:
            bom.status = "fulfilled"
        elif bom.used_quantity > 0:
            bom.status = "partial"
        else:
            bom.status = "pending"
    else:
        bom.status = "fulfilled" if bom.used_quantity > 0 else "pending"

    # Create Material History Log
    history = ProjectMaterialHistory(
        project_id=project_id,
        inventory_id=inventory_id,
        user_id=user_id,
        username=username,
        action=action,
        quantity=quantity,
        notes=notes
    )
    db.add(history)
    db.flush()

    # Log in Audit Log
    log_audit(
        db=db,
        user_id=user_id,
        project_id=project_id,
        inventory_id=inventory_id,
        action=f"material_{action}",
        details=f"Project: {project.name} | Material: {inventory.name} | Quantity: {quantity} {inventory.unit}",
        old_value=f"Inventory Qty: {old_inv_qty} | BOM Used: {old_bom_qty}",
        new_value=f"Inventory Qty: {inventory.quantity} | BOM Used: {bom.used_quantity}",
        reason=reason or notes,
        ip_address=ip_address,
        device=device,
        browser=browser
    )

    update_inventory_reserved_and_available(db, inventory_id)
    recalculate_project_progress(db, project_id)
    db.commit()
    db.refresh(history)
    return history

def update_project_material_history(
    db: Session,
    project_id: str,
    history_id: str,
    quantity: float,
    action: str,
    notes: Optional[str] = None,
    reason: Optional[str] = None,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    device: Optional[str] = None,
    browser: Optional[str] = None
) -> Optional[ProjectMaterialHistory]:
    history = db.query(ProjectMaterialHistory).filter(ProjectMaterialHistory.id == history_id, ProjectMaterialHistory.project_id == project_id).first()
    if not history:
        return None

    inventory = db.query(InventoryItem).filter(InventoryItem.id == history.inventory_id).first()
    bom = db.query(ProjectBOM).filter(ProjectBOM.project_id == project_id, ProjectBOM.inventory_id == history.inventory_id).first()
    if not inventory or not bom:
        raise ValueError("Linked material or BOM not found")

    old_hist_qty = history.quantity
    old_hist_action = history.action

    # 1. Revert the old action
    if old_hist_action == "used":
        inventory.quantity += old_hist_qty
        bom.used_quantity -= old_hist_qty
        bom.consumed_quantity = max(0.0, bom.consumed_quantity - old_hist_qty)
    elif old_hist_action == "returned":
        inventory.quantity -= old_hist_qty
        bom.used_quantity += old_hist_qty
        bom.consumed_quantity += old_hist_qty

    # 2. Apply the new action
    if action == "used":
        if inventory.quantity < quantity:
            # Revert the rollback to prevent database drift
            if old_hist_action == "used":
                inventory.quantity -= old_hist_qty
                bom.used_quantity += old_hist_qty
                bom.consumed_quantity += old_hist_qty
            elif old_hist_action == "returned":
                inventory.quantity += old_hist_qty
                bom.used_quantity -= old_hist_qty
                bom.consumed_quantity = max(0.0, bom.consumed_quantity - old_hist_qty)
            raise ValueError(f"Insufficient inventory stock to update. Available: {inventory.quantity} {inventory.unit}")
        
        inventory.quantity -= quantity
        bom.used_quantity += quantity
        bom.consumed_quantity += quantity
    elif action == "returned":
        if bom.used_quantity < quantity:
            # Revert the rollback
            if old_hist_action == "used":
                inventory.quantity -= old_hist_qty
                bom.used_quantity += old_hist_qty
                bom.consumed_quantity += old_hist_qty
            elif old_hist_action == "returned":
                inventory.quantity += old_hist_qty
                bom.used_quantity -= old_hist_qty
                bom.consumed_quantity = max(0.0, bom.consumed_quantity - old_hist_qty)
            raise ValueError(f"Cannot update return. Project used quantity is only: {bom.used_quantity} {inventory.unit}")
        
        inventory.quantity += quantity
        bom.used_quantity -= quantity
        bom.consumed_quantity = max(0.0, bom.consumed_quantity - quantity)
    else:
        raise ValueError("Action must be 'used' or 'returned'")

    # Update BOM status
    if bom.required_quantity > 0:
        if bom.used_quantity >= bom.required_quantity:
            bom.status = "fulfilled"
        elif bom.used_quantity > 0:
            bom.status = "partial"
        else:
            bom.status = "pending"
    else:
        bom.status = "fulfilled" if bom.used_quantity > 0 else "pending"

    # Update log details
    history.quantity = quantity
    history.action = action
    history.notes = notes

    # Log in Audit Log
    log_audit(
        db=db,
        user_id=user_id,
        project_id=project_id,
        inventory_id=history.inventory_id,
        action="update_material_history",
        details=f"Admin updated history log. Action: {old_hist_action}->{action} | Qty: {old_hist_qty}->{quantity}",
        old_value=f"Action: {old_hist_action} | Qty: {old_hist_qty}",
        new_value=f"Action: {action} | Qty: {quantity}",
        reason=reason or notes,
        ip_address=ip_address,
        device=device,
        browser=browser
    )

    update_inventory_reserved_and_available(db, history.inventory_id)
    recalculate_project_progress(db, project_id)
    db.commit()
    db.refresh(history)
    return history

def delete_project_material_history(
    db: Session,
    project_id: str,
    history_id: str,
    reason: Optional[str] = None,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    device: Optional[str] = None,
    browser: Optional[str] = None
) -> bool:
    history = db.query(ProjectMaterialHistory).filter(ProjectMaterialHistory.id == history_id, ProjectMaterialHistory.project_id == project_id).first()
    if not history:
        return False

    inventory = db.query(InventoryItem).filter(InventoryItem.id == history.inventory_id).first()
    bom = db.query(ProjectBOM).filter(ProjectBOM.project_id == project_id, ProjectBOM.inventory_id == history.inventory_id).first()
    if not inventory or not bom:
        raise ValueError("Linked material or BOM not found")

    old_hist_qty = history.quantity
    old_hist_action = history.action

    # Revert the old action
    if old_hist_action == "used":
        inventory.quantity += old_hist_qty
        bom.used_quantity -= old_hist_qty
        bom.consumed_quantity = max(0.0, bom.consumed_quantity - old_hist_qty)
    elif old_hist_action == "returned":
        if inventory.quantity < old_hist_qty:
            raise ValueError(f"Cannot delete return. Deleting this return would deduct {old_hist_qty} from inventory, but current stock is only {inventory.quantity}.")
        inventory.quantity -= old_hist_qty
        bom.used_quantity += old_hist_qty
        bom.consumed_quantity += old_hist_qty

    # Update BOM status
    if bom.required_quantity > 0:
        if bom.used_quantity >= bom.required_quantity:
            bom.status = "fulfilled"
        elif bom.used_quantity > 0:
            bom.status = "partial"
        else:
            bom.status = "pending"
    else:
        bom.status = "fulfilled" if bom.used_quantity > 0 else "pending"

    inv_id = history.inventory_id
    # Delete history record
    db.delete(history)

    # Log in Audit Log
    log_audit(
        db=db,
        user_id=user_id,
        project_id=project_id,
        inventory_id=inv_id,
        action="delete_material_history",
        details=f"Admin deleted history log. Action: {old_hist_action} | Qty: {old_hist_qty}",
        old_value=f"Action: {old_hist_action} | Qty: {old_hist_qty}",
        new_value="Deleted",
        reason=reason,
        ip_address=ip_address,
        device=device,
        browser=browser
    )

    update_inventory_reserved_and_available(db, inv_id)
    recalculate_project_progress(db, project_id)
    db.commit()
    return True

def transfer_project_material(
    db: Session,
    from_project_id: str,
    to_project_id: str,
    inventory_id: str,
    quantity: float,
    user_id: str,
    notes: Optional[str] = None,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
    device: Optional[str] = None,
    browser: Optional[str] = None
) -> bool:
    if from_project_id == to_project_id:
        raise ValueError("Cannot transfer within the same project")

    from_project = db.query(Project).filter(Project.id == from_project_id, Project.is_deleted == False).first()
    to_project = db.query(Project).filter(Project.id == to_project_id, Project.is_deleted == False).first()
    if not from_project or not to_project:
        raise ValueError("Source or destination project not found")

    inventory = db.query(InventoryItem).filter(InventoryItem.id == inventory_id, InventoryItem.is_deleted == False).first()
    if not inventory:
        raise ValueError("Inventory item not found")

    bom_from = db.query(ProjectBOM).filter(ProjectBOM.project_id == from_project_id, ProjectBOM.inventory_id == inventory_id).first()
    if not bom_from or bom_from.used_quantity < quantity:
        raise ValueError(f"Insufficient allocated quantity in source project. Available: {bom_from.used_quantity if bom_from else 0} {inventory.unit}")

    bom_to = db.query(ProjectBOM).filter(ProjectBOM.project_id == to_project_id, ProjectBOM.inventory_id == inventory_id).first()
    if not bom_to:
        bom_to = ProjectBOM(
            project_id=to_project_id,
            inventory_id=inventory_id,
            required_quantity=0.0,
            used_quantity=0.0,
            consumed_quantity=0.0,
            status="pending"
        )
        db.add(bom_to)
        db.flush()

    old_from_qty = bom_from.used_quantity
    old_to_qty = bom_to.used_quantity

    # Perform transfer
    bom_from.used_quantity -= quantity
    bom_from.consumed_quantity = max(0.0, bom_from.consumed_quantity - quantity)
    
    # Also update allocation (required_quantity)
    deduct_required = min(bom_from.required_quantity, quantity)
    bom_from.required_quantity -= deduct_required
    
    bom_to.used_quantity += quantity
    bom_to.consumed_quantity += quantity
    bom_to.required_quantity += deduct_required

    # Update status for source project BOM
    if bom_from.required_quantity > 0:
        if bom_from.used_quantity >= bom_from.required_quantity:
            bom_from.status = "fulfilled"
        elif bom_from.used_quantity > 0:
            bom_from.status = "partial"
        else:
            bom_from.status = "pending"
    else:
        bom_from.status = "fulfilled" if bom_from.used_quantity > 0 else "pending"

    # Update status for destination project BOM
    if bom_to.required_quantity > 0:
        if bom_to.used_quantity >= bom_to.required_quantity:
            bom_to.status = "fulfilled"
        elif bom_to.used_quantity > 0:
            bom_to.status = "partial"
        else:
            bom_to.status = "pending"
    else:
        bom_to.status = "fulfilled" if bom_to.used_quantity > 0 else "pending"

    user = db.query(User).filter(User.id == user_id).first()
    username = user.full_name if user else "Employee"

    # Add material history log in source project
    history_from = ProjectMaterialHistory(
        project_id=from_project_id,
        inventory_id=inventory_id,
        user_id=user_id,
        username=username,
        action="transferred_out",
        quantity=quantity,
        notes=f"Transferred to Project: {to_project.name}. Notes: {notes or ''}"
    )
    db.add(history_from)

    # Add material history log in destination project
    history_to = ProjectMaterialHistory(
        project_id=to_project_id,
        inventory_id=inventory_id,
        user_id=user_id,
        username=username,
        action="transferred_in",
        quantity=quantity,
        notes=f"Transferred from Project: {from_project.name}. Notes: {notes or ''}"
    )
    db.add(history_to)

    # Log in Audit Log
    log_audit(
        db=db,
        user_id=user_id,
        project_id=from_project_id,
        inventory_id=inventory_id,
        action="material_transfer",
        details=f"Transferred {quantity} {inventory.unit} of {inventory.name} from Project {from_project.name} to {to_project.name}",
        old_value=f"From BOM: {old_from_qty} | To BOM: {old_to_qty}",
        new_value=f"From BOM: {bom_from.used_quantity} | To BOM: {bom_to.used_quantity}",
        reason=reason or notes,
        ip_address=ip_address,
        device=device,
        browser=browser
    )

    db.commit()
    return True

def initiate_project_material_transfer(
    db: Session,
    from_project_id: str,
    to_project_id: str,
    inventory_id: str,
    quantity: float,
    user_id: str,
    notes: Optional[str] = None,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
    device: Optional[str] = None,
    browser: Optional[str] = None
) -> ProjectMaterialHistory:
    if from_project_id == to_project_id:
        raise ValueError("Cannot transfer within the same project")

    from_project = db.query(Project).filter(Project.id == from_project_id, Project.is_deleted == False).first()
    to_project = db.query(Project).filter(Project.id == to_project_id, Project.is_deleted == False).first()
    if not from_project or not to_project:
        raise ValueError("Source or destination project not found")

    inventory = db.query(InventoryItem).filter(InventoryItem.id == inventory_id, InventoryItem.is_deleted == False).first()
    if not inventory:
        raise ValueError("Inventory item not found")

    bom_from = db.query(ProjectBOM).filter(ProjectBOM.project_id == from_project_id, ProjectBOM.inventory_id == inventory_id).first()
    if not bom_from or bom_from.used_quantity < quantity:
        raise ValueError(f"Insufficient allocated quantity in source project. Available: {bom_from.used_quantity if bom_from else 0} {inventory.unit}")

    user = db.query(User).filter(User.id == user_id).first()
    username = user.full_name if user else "Employee"

    # Encode the destination project ID inside the notes field
    encoded_notes = f"to_project_id:{to_project_id} | {notes or ''}"

    # Add a pending material history log in source project
    history_from = ProjectMaterialHistory(
        project_id=from_project_id,
        inventory_id=inventory_id,
        user_id=user_id,
        username=username,
        action="transferred_out",
        quantity=quantity,
        notes=encoded_notes,
        status="pending"
    )
    db.add(history_from)
    db.commit()
    db.refresh(history_from)
    return history_from

def get_pending_transfers(db: Session) -> List[ProjectMaterialHistory]:
    return db.query(ProjectMaterialHistory).filter(
        ProjectMaterialHistory.action == "transferred_out",
        ProjectMaterialHistory.status == "pending"
    ).order_by(ProjectMaterialHistory.created_at.desc()).all()

def approve_project_material_transfer(
    db: Session,
    history_id: str,
    approver_id: str,
    ip_address: Optional[str] = None,
    device: Optional[str] = None,
    browser: Optional[str] = None
) -> bool:
    # 1. Get the pending history record
    history_from = db.query(ProjectMaterialHistory).filter(
        ProjectMaterialHistory.id == history_id,
        ProjectMaterialHistory.action == "transferred_out",
        ProjectMaterialHistory.status == "pending"
    ).first()
    if not history_from:
        raise ValueError("Pending transfer request not found")

    # 2. Parse destination project ID from notes
    notes_str = history_from.notes or ""
    to_project_id = None
    original_notes = ""
    if "to_project_id:" in notes_str:
        try:
            parts = notes_str.split(" | ", 1)
            to_project_id = parts[0].replace("to_project_id:", "").strip()
            if len(parts) > 1:
                original_notes = parts[1]
        except Exception:
            raise ValueError("Invalid format in transfer notes. Cannot parse target project ID.")
    else:
        raise ValueError("Destination project ID missing in transfer record.")

    from_project_id = history_from.project_id
    inventory_id = history_from.inventory_id
    quantity = history_from.quantity

    from_project = db.query(Project).filter(Project.id == from_project_id, Project.is_deleted == False).first()
    to_project = db.query(Project).filter(Project.id == to_project_id, Project.is_deleted == False).first()
    if not from_project or not to_project:
        raise ValueError("Source or destination project not found")

    inventory = db.query(InventoryItem).filter(InventoryItem.id == inventory_id, InventoryItem.is_deleted == False).first()
    if not inventory:
        raise ValueError("Inventory item not found")

    bom_from = db.query(ProjectBOM).filter(ProjectBOM.project_id == from_project_id, ProjectBOM.inventory_id == inventory_id).first()
    if not bom_from or bom_from.used_quantity < quantity:
        raise ValueError(f"Insufficient allocated quantity in source project. Available: {bom_from.used_quantity if bom_from else 0} {inventory.unit}")

    bom_to = db.query(ProjectBOM).filter(ProjectBOM.project_id == to_project_id, ProjectBOM.inventory_id == inventory_id).first()
    if not bom_to:
        bom_to = ProjectBOM(
            project_id=to_project_id,
            inventory_id=inventory_id,
            required_quantity=0.0,
            used_quantity=0.0,
            consumed_quantity=0.0,
            status="pending"
        )
        db.add(bom_to)
        db.flush()

    old_from_qty = bom_from.used_quantity
    old_to_qty = bom_to.used_quantity

    # Perform actual transfer
    bom_from.used_quantity -= quantity
    bom_from.consumed_quantity = max(0.0, bom_from.consumed_quantity - quantity)
    
    bom_to.used_quantity += quantity
    bom_to.consumed_quantity += quantity

    # Update BOM status
    for bom in [bom_from, bom_to]:
        if bom.required_quantity > 0:
            if bom.used_quantity >= bom.required_quantity:
                bom.status = "fulfilled"
            elif bom.used_quantity > 0:
                bom.status = "partial"
            else:
                bom.status = "pending"
        else:
            bom.status = "fulfilled" if bom.used_quantity > 0 else "pending"

    # Log stock transactions (transfer out and in)
    tx_out = StockTransaction(
        inventory_id=inventory_id,
        transaction_type="transfer",
        quantity=-quantity,
        project_id=from_project_id,
        user_id=approver_id,
        notes=f"Transferred to Project: {to_project.name}. Approved by admin/manager."
    )
    tx_in = StockTransaction(
        inventory_id=inventory_id,
        transaction_type="transfer",
        quantity=quantity,
        project_id=to_project_id,
        user_id=approver_id,
        notes=f"Transferred from Project: {from_project.name}. Approved by admin/manager."
    )
    db.add_all([tx_out, tx_in])

    # Update source history record status
    history_from.status = "approved"
    history_from.approved_by = approver_id
    history_from.approved_at = datetime.utcnow()
    # clean up the to_project_id encoding from notes for display readability
    history_from.notes = f"Transferred to Project: {to_project.name}. Notes: {original_notes}"

    # Create target history record with approved status
    history_to = ProjectMaterialHistory(
        project_id=to_project_id,
        inventory_id=inventory_id,
        user_id=history_from.user_id,
        username=history_from.username,
        action="transferred_in",
        quantity=quantity,
        notes=f"Transferred from Project: {from_project.name}. Notes: {original_notes}",
        status="approved",
        approved_by=approver_id,
        approved_at=datetime.utcnow()
    )
    db.add(history_to)

    # Audit Log
    log_audit(
        db=db,
        user_id=approver_id,
        project_id=from_project_id,
        inventory_id=inventory_id,
        action="material_transfer_approved",
        details=f"Approved transfer of {quantity} {inventory.unit} of {inventory.name} from {from_project.name} to {to_project.name}",
        old_value=f"From BOM: {old_from_qty} | To BOM: {old_to_qty}",
        new_value=f"From BOM: {bom_from.used_quantity} | To BOM: {bom_to.used_quantity}",
        reason=original_notes,
        ip_address=ip_address,
        device=device,
        browser=browser
    )

    update_inventory_reserved_and_available(db, inventory_id)
    recalculate_project_progress(db, from_project_id)
    recalculate_project_progress(db, to_project_id)
    db.commit()
    return True

def reject_project_material_transfer(
    db: Session,
    history_id: str,
    approver_id: str,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
    device: Optional[str] = None,
    browser: Optional[str] = None
) -> bool:
    history_from = db.query(ProjectMaterialHistory).filter(
        ProjectMaterialHistory.id == history_id,
        ProjectMaterialHistory.action == "transferred_out",
        ProjectMaterialHistory.status == "pending"
    ).first()
    if not history_from:
        raise ValueError("Pending transfer request not found")

    # Update status to rejected
    history_from.status = "rejected"
    history_from.approved_by = approver_id
    history_from.approved_at = datetime.utcnow()
    
    notes_str = history_from.notes or ""
    original_notes = notes_str.split(" | ", 1)[-1] if " | " in notes_str else notes_str
    history_from.notes = f"{original_notes} (Rejected: {reason or 'No reason provided'})"

    # Audit Log
    log_audit(
        db=db,
        user_id=approver_id,
        project_id=history_from.project_id,
        inventory_id=history_from.inventory_id,
        action="material_transfer_rejected",
        details=f"Rejected transfer of {history_from.quantity} units. Reason: {reason or 'none'}",
        old_value="pending",
        new_value="rejected",
        reason=reason,
        ip_address=ip_address,
        device=device,
        browser=browser
    )

    db.commit()
    return True

def add_new_material_to_project(
    db: Session,
    project_id: str,
    item_in: NewMaterialAndProjectUsageRequest,
    user_id: str,
    ip_address: Optional[str] = None,
    device: Optional[str] = None,
    browser: Optional[str] = None
) -> InventoryItem:
    # 1. Create a new Inventory Item
    # Ensure SKU and Barcode are unique
    existing_sku = db.query(InventoryItem).filter(InventoryItem.sku == item_in.sku).first()
    if existing_sku:
        raise ValueError(f"Material with SKU '{item_in.sku}' already exists.")

    barcode_val = item_in.barcode
    if not barcode_val:
        # Generate sequence barcode
        import random
        barcode_val = f"BC{random.randint(100000, 999999)}"

    existing_barcode = db.query(InventoryItem).filter(InventoryItem.barcode == barcode_val).first()
    if existing_barcode:
        barcode_val = f"BC{random.randint(100000, 999999)}"

    # We set initial quantity to 0 because we will record restock then deduct
    db_item = InventoryItem(
        name=item_in.name,
        category_id=item_in.category_id,
        sku=item_in.sku,
        barcode=barcode_val,
        brand=item_in.brand,
        size_variant=item_in.size_variant,
        quantity=item_in.quantity,  # set initial quantity
        unit=item_in.unit,
        minimum_stock_level=item_in.minimum_stock_level,
        unit_cost=item_in.unit_cost
    )
    db.add(db_item)
    db.flush()

    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise ValueError("Project not found")

    # Add Stock Restock transaction
    tx_in = StockTransaction(
        inventory_id=db_item.id,
        transaction_type="in",
        quantity=item_in.quantity,
        user_id=user_id,
        notes=f"Initial stock creation for manual project assignment."
    )
    db.add(tx_in)

    # Deduced for project BOM
    bom = ProjectBOM(
        project_id=project_id,
        inventory_id=db_item.id,
        required_quantity=0.0,
        used_quantity=item_in.quantity,
        consumed_quantity=item_in.quantity,
        status="fulfilled"
    )
    db.add(bom)

    # Deduct stock
    db_item.quantity = 0.0

    # Add stock out transaction
    tx_out = StockTransaction(
        inventory_id=db_item.id,
        transaction_type="out",
        quantity=-item_in.quantity,
        project_id=project_id,
        user_id=user_id,
        notes=f"Allocated to Project: {project.name}"
    )
    db.add(tx_out)

    user = db.query(User).filter(User.id == user_id).first()
    username = user.full_name if user else "Employee"

    # Add material history log
    history = ProjectMaterialHistory(
        project_id=project_id,
        inventory_id=db_item.id,
        user_id=user_id,
        username=username,
        action="used",
        quantity=item_in.quantity,
        notes=f"Created new material and assigned to project. Notes: {item_in.notes or ''}"
    )
    db.add(history)

    # Log in Audit Log
    log_audit(
        db=db,
        user_id=user_id,
        project_id=project_id,
        inventory_id=db_item.id,
        action="create_and_use_material",
        details=f"Created new inventory item {db_item.name} ({db_item.sku}) and assigned {item_in.quantity} {db_item.unit} to project {project.name}",
        old_value="None",
        new_value=f"Inventory Qty: 0.0 | Project BOM Used: {item_in.quantity}",
        reason=item_in.notes,
        ip_address=ip_address,
        device=device,
        browser=browser
    )

    update_inventory_reserved_and_available(db, db_item.id)
    recalculate_project_progress(db, project_id)
    db.commit()
    db.refresh(db_item)
    return db_item

def get_archived_items(db: Session) -> dict:
    archived_users = db.query(User).filter(User.is_deleted == True).all()
    archived_categories = db.query(Category).filter(Category.is_deleted == True).all()
    archived_inventory = db.query(InventoryItem).filter(InventoryItem.is_deleted == True).all()
    archived_suppliers = db.query(Supplier).filter(Supplier.is_deleted == True).all()
    archived_clients = db.query(Client).filter(Client.is_deleted == True).all()
    archived_projects = db.query(Project).filter(Project.is_deleted == True).all()
    archived_staff = db.query(Staff).filter(Staff.is_deleted == True).all()

    # Convert to dictionaries for cleaner JSON transmission
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "deleted_at": u.deleted_at.isoformat() if u.deleted_at else None,
                "deleted_by": u.deleted_by
            } for u in archived_users
        ],
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "deleted_at": c.deleted_at.isoformat() if c.deleted_at else None,
                "deleted_by": c.deleted_by
            } for c in archived_categories
        ],
        "inventory": [
            {
                "id": i.id,
                "name": i.name,
                "sku": i.sku,
                "barcode": i.barcode,
                "quantity": i.quantity,
                "unit": i.unit,
                "deleted_at": i.deleted_at.isoformat() if i.deleted_at else None,
                "deleted_by": i.deleted_by
            } for i in archived_inventory
        ],
        "suppliers": [
            {
                "id": s.id,
                "name": s.name,
                "contact_person": s.contact_person,
                "phone": s.phone,
                "deleted_at": s.deleted_at.isoformat() if s.deleted_at else None,
                "deleted_by": s.deleted_by
            } for s in archived_suppliers
        ],
        "clients": [
            {
                "id": c.id,
                "name": c.name,
                "contact_person": c.contact_person,
                "phone": c.phone,
                "deleted_at": c.deleted_at.isoformat() if c.deleted_at else None,
                "deleted_by": c.deleted_by
            } for c in archived_clients
        ],
        "projects": [
            {
                "id": p.id,
                "name": p.name,
                "status": p.status,
                "deleted_at": p.deleted_at.isoformat() if p.deleted_at else None,
                "deleted_by": p.deleted_by
            } for p in archived_projects
        ],
        "staff": [
            {
                "id": s.id,
                "name": s.name,
                "role": s.role,
                "phone": s.phone,
                "deleted_at": s.deleted_at.isoformat() if s.deleted_at else None,
                "deleted_by": s.deleted_by
            } for s in archived_staff
        ]
    }

def permanently_delete_record(
    db: Session,
    entity_type: str,
    entity_id: str,
    actor_id: str,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
    device: Optional[str] = None,
    browser: Optional[str] = None
) -> bool:
    entity_type = entity_type.lower()
    
    # 1. Retrieve the soft-deleted record and check dependency constraints
    if entity_type == "user":
        record = db.query(User).filter(User.id == entity_id, User.is_deleted == True).first()
        if not record:
            raise ValueError("User not found or is not archived.")
        # Check dependencies
        dep_count = db.query(StockTransaction).filter(StockTransaction.user_id == entity_id).count()
        dep_count += db.query(MaterialRequest).filter((MaterialRequest.requested_by == entity_id) | (MaterialRequest.approved_by == entity_id)).count()
        dep_count += db.query(DailyWorkLog).filter(DailyWorkLog.user_id == entity_id).count()
        if dep_count > 0:
            raise ValueError(f"Cannot permanently delete user: they have {dep_count} linked transaction/log records. Keep them archived instead.")
            
    elif entity_type == "category":
        record = db.query(Category).filter(Category.id == entity_id, Category.is_deleted == True).first()
        if not record:
            raise ValueError("Category not found or is not archived.")
        # Reassignment is already done on soft delete, but just in case:
        dep_count = db.query(InventoryItem).filter(InventoryItem.category_id == entity_id).count()
        if dep_count > 0:
            raise ValueError(f"Cannot permanently delete category: {dep_count} inventory items are still linked.")
            
    elif entity_type == "inventory":
        record = db.query(InventoryItem).filter(InventoryItem.id == entity_id, InventoryItem.is_deleted == True).first()
        if not record:
            raise ValueError("Inventory item not found or is not archived.")
        dep_count = db.query(StockTransaction).filter(StockTransaction.inventory_id == entity_id).count()
        dep_count += db.query(ProjectBOM).filter(ProjectBOM.inventory_id == entity_id).count()
        dep_count += db.query(MaterialRequest).filter(MaterialRequest.inventory_id == entity_id).count()
        dep_count += db.query(PurchaseOrder).filter(PurchaseOrder.inventory_id == entity_id).count()
        if dep_count > 0:
            raise ValueError(f"Cannot permanently delete material: it is linked to {dep_count} stock transactions, BOM items, requests, or POs.")
            
    elif entity_type == "supplier":
        record = db.query(Supplier).filter(Supplier.id == entity_id, Supplier.is_deleted == True).first()
        if not record:
            raise ValueError("Supplier not found or is not archived.")
        dep_count = db.query(InventoryItem).filter(InventoryItem.supplier_id == entity_id).count()
        dep_count += db.query(PurchaseOrder).filter(PurchaseOrder.supplier_id == entity_id).count()
        if dep_count > 0:
            raise ValueError(f"Cannot permanently delete supplier: it has {dep_count} linked materials or POs.")
            
    elif entity_type == "client":
        record = db.query(Client).filter(Client.id == entity_id, Client.is_deleted == True).first()
        if not record:
            raise ValueError("Client not found or is not archived.")
        dep_count = db.query(Project).filter(Project.client_id == entity_id).count()
        if dep_count > 0:
            raise ValueError(f"Cannot permanently delete client: it has {dep_count} projects linked.")
            
    elif entity_type == "project":
        record = db.query(Project).filter(Project.id == entity_id, Project.is_deleted == True).first()
        if not record:
            raise ValueError("Project not found or is not archived.")
        dep_count = db.query(ProjectBOM).filter(ProjectBOM.project_id == entity_id).count()
        dep_count += db.query(StockTransaction).filter(StockTransaction.project_id == entity_id).count()
        dep_count += db.query(MaterialRequest).filter(MaterialRequest.project_id == entity_id).count()
        dep_count += db.query(ProjectAssignment).filter(ProjectAssignment.project_id == entity_id).count()
        dep_count += db.query(ProjectDailyLog).filter(ProjectDailyLog.project_id == entity_id).count()
        if dep_count > 0:
            raise ValueError(f"Cannot permanently delete project: it has {dep_count} linked BOM items, stock logs, requests, or assignments.")
            
    elif entity_type == "staff":
        record = db.query(Staff).filter(Staff.id == entity_id, Staff.is_deleted == True).first()
        if not record:
            raise ValueError("Staff member not found or is not archived.")
        dep_count = db.query(Attendance).filter(Attendance.staff_id == entity_id).count()
        dep_count += db.query(Task).filter(Task.assigned_to == entity_id).count()
        dep_count += db.query(ProjectDailyLog).filter(ProjectDailyLog.staff_id == entity_id).count()
        if dep_count > 0:
            raise ValueError(f"Cannot permanently delete staff: they have {dep_count} linked attendance, task, or log records.")
            
    elif entity_type == "expense":
        record = db.query(DailyExpense).filter(DailyExpense.id == entity_id, DailyExpense.is_deleted == True).first()
        if not record:
            raise ValueError("Expense not found or is not archived.")
            
    elif entity_type == "purchase":
        record = db.query(PurchaseOrder).filter(PurchaseOrder.id == entity_id, PurchaseOrder.is_deleted == True).first()
        if not record:
            raise ValueError("Purchase order not found or is not archived.")
        dep_count = db.query(StockTransaction).filter(StockTransaction.notes.like(f"%{entity_id}%")).count()
        if dep_count > 0:
            raise ValueError(f"Cannot permanently delete purchase order: it has {dep_count} linked stock transactions.")
            
    elif entity_type == "request":
        record = db.query(MaterialRequest).filter(MaterialRequest.id == entity_id, MaterialRequest.is_deleted == True).first()
        if not record:
            raise ValueError("Material request not found or is not archived.")
        dep_count = db.query(StockTransaction).filter(StockTransaction.notes.like(f"%{entity_id}%")).count()
        if dep_count > 0:
            raise ValueError(f"Cannot permanently delete material request: it has {dep_count} linked stock transactions.")
            
    elif entity_type == "document":
        record = db.query(Document).filter(Document.id == entity_id, Document.is_deleted == True).first()
        if not record:
            raise ValueError("Document not found or is not archived.")
            
    else:
        raise ValueError("Invalid entity type for permanent deletion.")

    # 2. Log in Audit Log
    log_audit(
        db=db,
        user_id=actor_id,
        action=f"permanent_delete_{entity_type}",
        details=f"Permanently deleted {entity_type} ID: {entity_id}. Reason: {reason or 'none'}",
        old_value="archived",
        new_value="permanently_deleted",
        reason=reason,
        ip_address=ip_address,
        device=device,
        browser=browser
    )

    # 3. Hard delete
    db.delete(record)
    db.commit()
    return True

def restore_category(db: Session, category_id: str) -> bool:
    db_cat = db.query(Category).filter(Category.id == category_id, Category.is_deleted == True).first()
    if not db_cat:
        return False
    db_cat.is_deleted = False
    db_cat.deleted_at = None
    db_cat.deleted_by = None
    db.commit()
    return True

def restore_user(db: Session, user_id_to_restore: str) -> bool:
    db_user = db.query(User).filter(User.id == user_id_to_restore, User.is_deleted == True).first()
    if not db_user:
        return False
    db_user.is_deleted = False
    db_user.deleted_at = None
    db_user.deleted_by = None
    db.commit()
    return True

