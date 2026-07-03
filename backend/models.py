import uuid
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Date, ForeignKey, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(100), nullable=False)
    role = Column(String(20), default="worker", nullable=False)  # admin, manager, store, accountant, worker
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, nullable=True)
    employee_code = Column(String(50), unique=True, index=True, nullable=True)
    department = Column(String(100), nullable=True)
    status = Column(String(20), default="active", nullable=False)
    permissions = Column(Text, nullable=True)
    otp_code = Column(String(10), nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    refresh_token = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), nullable=True)

    # Relationships
    stock_transactions = relationship("StockTransaction", back_populates="user")
    material_requests = relationship("MaterialRequest", foreign_keys="[MaterialRequest.requested_by]", back_populates="requester")
    approved_requests = relationship("MaterialRequest", foreign_keys="[MaterialRequest.approved_by]", back_populates="approver")
    activity_logs = relationship("ActivityLog", back_populates="user")

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), nullable=True)

    inventory_items = relationship("InventoryItem", back_populates="category")

class InventoryItem(Base):
    __tablename__ = "inventory"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    category_id = Column(String(36), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(100), nullable=False)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    barcode = Column(String(50), unique=True, index=True, nullable=False)
    brand = Column(String(100), nullable=True)
    size_variant = Column(String(100), nullable=True)
    quantity = Column(Float, default=0.0, nullable=False)
    reserved_quantity = Column(Float, default=0.0, nullable=False)
    available_quantity = Column(Float, default=0.0, nullable=False)
    unit = Column(String(20), nullable=False)  # Sheets, Pairs, Meters, etc.
    minimum_stock_level = Column(Float, default=5.0, nullable=False)
    unit_cost = Column(Float, default=0.0, nullable=False)
    supplier_id = Column(String(36), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), nullable=True)

    # Relationships
    category = relationship("Category", back_populates="inventory_items")
    supplier = relationship("Supplier", back_populates="inventory_items")
    bom_items = relationship("ProjectBOM", back_populates="inventory")
    stock_transactions = relationship("StockTransaction", back_populates="inventory")
    material_requests = relationship("MaterialRequest", back_populates="inventory")
    purchase_orders = relationship("PurchaseOrder", back_populates="inventory")

class Supplier(Base):
    __tablename__ = "suppliers"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    gst_number = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    material_categories = Column(String(255), nullable=True)  # Comma-separated list of category names
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), nullable=True)

    # Relationships
    inventory_items = relationship("InventoryItem", back_populates="supplier")
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), nullable=True)

    # Relationships
    projects = relationship("Project", back_populates="client")

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    client_id = Column(String(36), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    site_location = Column(String(255), nullable=True)
    status = Column(String(20), default="planning", nullable=False)  # planning, active, on_hold, delayed, completed
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    budget = Column(Float, default=0.0, nullable=False)
    completion_percentage = Column(Integer, default=0, nullable=False)  # NEW: 0-100
    progress_mode = Column(String(20), default="manual", nullable=False)
    department = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    version_id = Column(Integer, default=1, nullable=False)
    
    __mapper_args__ = {
        "version_id_col": version_id
    }
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), nullable=True)

    # Relationships
    client = relationship("Client", back_populates="projects")
    bom_items = relationship("ProjectBOM", back_populates="project", cascade="all, delete-orphan")
    stock_transactions = relationship("StockTransaction", back_populates="project")
    material_requests = relationship("MaterialRequest", back_populates="project")

class ProjectBOM(Base):
    __tablename__ = "project_bom"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    inventory_id = Column(String(36), ForeignKey("inventory.id", ondelete="RESTRICT"), nullable=False)
    required_quantity = Column(Float, nullable=False)
    used_quantity = Column(Float, default=0.0, nullable=False)
    consumed_quantity = Column(Float, default=0.0, nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending, partial, fulfilled
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="bom_items")
    inventory = relationship("InventoryItem", back_populates="bom_items")

class StockTransaction(Base):
    __tablename__ = "stock_transactions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    inventory_id = Column(String(36), ForeignKey("inventory.id", ondelete="RESTRICT"), nullable=False)
    transaction_type = Column(String(20), nullable=False)  # in, out, adjustment, return, damaged, transfer
    quantity = Column(Float, nullable=False)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    inventory = relationship("InventoryItem", back_populates="stock_transactions")
    project = relationship("Project", back_populates="stock_transactions")
    user = relationship("User", back_populates="stock_transactions")

class MaterialRequest(Base):
    __tablename__ = "material_requests"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    inventory_id = Column(String(36), ForeignKey("inventory.id", ondelete="RESTRICT"), nullable=False)
    requested_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Float, nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending, approved, rejected, issued
    approved_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), nullable=True)

    # Relationships
    project = relationship("Project", back_populates="material_requests")
    inventory = relationship("InventoryItem", back_populates="material_requests")
    requester = relationship("User", foreign_keys=[requested_by], back_populates="material_requests")
    approver = relationship("User", foreign_keys=[approved_by], back_populates="approved_requests")

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    po_number = Column(String(50), unique=True, index=True, nullable=False)
    supplier_id = Column(String(36), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False)
    inventory_id = Column(String(36), ForeignKey("inventory.id", ondelete="RESTRICT"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending, approved, ordered, delivered, received
    requested_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    category = Column(String(50), default="Raw Material", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Redesign Purchase Order Additional Fields
    po_date = Column(Date, default=date.today, nullable=True)
    vendor_name = Column(String(100), nullable=True)
    vendor_contact = Column(String(50), nullable=True)
    vendor_gst = Column(String(20), nullable=True)
    vendor_address = Column(Text, nullable=True)
    material_name = Column(String(100), nullable=True)
    sku = Column(String(50), nullable=True)
    unit = Column(String(20), nullable=True)
    expected_delivery_date = Column(Date, nullable=True)
    received_quantity = Column(Float, default=0.0, nullable=True)
    pending_quantity = Column(Float, default=0.0, nullable=True)
    invoice_number = Column(String(50), nullable=True)
    invoice_date = Column(Date, nullable=True)
    payment_status = Column(String(20), default="Pending", nullable=False)
    remarks = Column(Text, nullable=True)

    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), nullable=True)

    # Relationships
    supplier = relationship("Supplier", back_populates="purchase_orders")
    inventory = relationship("InventoryItem", back_populates="purchase_orders")
class Staff(Base):
    __tablename__ = "staff"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)  # Carpenter, Designer, Manager, StoreKeeper, Accountant
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    salary = Column(Float, default=0.0, nullable=False)
    status = Column(String(20), default="active", nullable=False)  # active, inactive
    shift_id = Column(String(36), ForeignKey("shifts.id", ondelete="SET NULL"), nullable=True)
    category = Column(String(50), nullable=True)
    department = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), nullable=True)

    # Relationships
    attendance_records = relationship("Attendance", back_populates="staff_member", cascade="all, delete-orphan")
    shift = relationship("Shift", back_populates="staff_members")

class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("staff_id", "date", name="uq_attendance_staff_date"),
    )
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    staff_id = Column(String(36), ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False)  # present, absent, leave, half_day
    check_in = Column(String(10), nullable=True)  # HH:MM format
    check_out = Column(String(10), nullable=True)  # HH:MM format
    device = Column(String(100), nullable=True)
    ip_address = Column(String(50), nullable=True)
    total_hours = Column(Float, default=0.0)
    overtime_hours = Column(Float, default=0.0)
    late_minutes = Column(Integer, default=0)  # NEW: minutes late from shift start
    late_arrival = Column(Boolean, default=False)
    early_departure = Column(Boolean, default=False)
    check_in_selfie = Column(String(255), nullable=True)
    check_out_selfie = Column(String(255), nullable=True)
    
    # Anti-Proxy tracking
    check_in_fingerprint = Column(String(100), nullable=True)
    check_in_browser = Column(Text, nullable=True)
    check_out_device = Column(String(100), nullable=True)
    check_out_ip = Column(String(50), nullable=True)
    check_out_fingerprint = Column(String(100), nullable=True)
    check_out_browser = Column(Text, nullable=True)
    is_suspicious = Column(Boolean, default=False)
    suspicious_reason = Column(Text, nullable=True)
    
    # Project-linked updates
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    task = Column(String(200), nullable=True)
    work_photo = Column(String(255), nullable=True)
    remarks = Column(Text, nullable=True)
    progress_percentage = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    staff_member = relationship("Staff", back_populates="attendance_records")
    project = relationship("Project")

class Shift(Base):
    __tablename__ = "shifts"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(50), unique=True, nullable=False)
    check_in_time = Column(String(10), nullable=False)  # HH:MM format
    check_out_time = Column(String(10), nullable=False)  # HH:MM format
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    staff_members = relationship("Staff", back_populates="shift")

class AttendanceRule(Base):
    __tablename__ = "attendance_rules"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    late_grace_minutes = Column(Integer, default=0, nullable=False)
    half_day_threshold_hours = Column(Float, default=4.0, nullable=False)
    min_hours_present = Column(Float, default=8.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)  # low_stock, out_of_stock, request_pending, etc.
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)  # login, create_user, stock_adjustment, etc.
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    device = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="activity_logs")


# --- ENTERPRISE CONFIGURATION & DYNAMIC MASTER SCHEMAS ---

class CustomFieldDefinition(Base):
    __tablename__ = "custom_field_definitions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    entity_type = Column(String(50), index=True, nullable=False)  # Supplier, Client, Staff, Project, InventoryItem
    name = Column(String(50), nullable=False)  # e.g., credit_limit
    label = Column(String(100), nullable=False)  # e.g., Credit Limit
    field_type = Column(String(20), nullable=False)  # text, number, date, dropdown, checkbox
    is_required = Column(Boolean, default=False, nullable=False)
    choices = Column(Text, nullable=True)  # Comma-separated if dropdown
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class CustomFieldValue(Base):
    __tablename__ = "custom_field_values"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    field_definition_id = Column(String(36), ForeignKey("custom_field_definitions.id", ondelete="CASCADE"), nullable=False)
    entity_id = Column(String(36), index=True, nullable=False)  # ID of the specific Supplier / Client / Project / Staff
    value_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    definition = relationship("CustomFieldDefinition")


class WorkflowDefinition(Base):
    __tablename__ = "workflow_definitions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    entity_type = Column(String(50), unique=True, index=True, nullable=False)  # MaterialRequest, PurchaseOrder
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    steps = relationship("WorkflowStep", back_populates="workflow", cascade="all, delete-orphan")


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    workflow_id = Column(String(36), ForeignKey("workflow_definitions.id", ondelete="CASCADE"), nullable=False)
    step_name = Column(String(100), nullable=False)
    step_order = Column(Integer, nullable=False)
    role_allowed_to_execute = Column(String(50), nullable=False)  # admin, manager, store, accountant, worker

    workflow = relationship("WorkflowDefinition", back_populates="steps")


class ApprovalRule(Base):
    __tablename__ = "approval_rules"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    entity_type = Column(String(50), index=True, nullable=False)  # PurchaseOrder, MaterialRequest
    min_value = Column(Float, default=0.0, nullable=False)
    max_value = Column(Float, default=9999999.0, nullable=False)
    role_approver = Column(String(50), nullable=False)  # admin, manager, accountant, store, etc.
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class DashboardWidget(Base):
    __tablename__ = "dashboard_widgets"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    widget_type = Column(String(50), nullable=False)  # kpi_stock, kpi_projects, kpi_po, chart_movement, chart_purchases, recent_activity, tasks_list
    layout_x = Column(Integer, default=0, nullable=False)
    layout_y = Column(Integer, default=0, nullable=False)
    layout_w = Column(Integer, default=3, nullable=False)
    layout_h = Column(Integer, default=2, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    assigned_to = Column(String(36), ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    deadline = Column(Date, nullable=True)
    priority = Column(String(20), default="medium", nullable=False)  # low, medium, high, urgent
    status = Column(String(20), default="todo", nullable=False)  # todo, in_progress, review, completed
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), nullable=True)

    assignee = relationship("Staff")


class Document(Base):
    __tablename__ = "documents"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(150), nullable=False)
    file_path = Column(String(255), nullable=False)
    category = Column(String(50), nullable=True)  # design, invoice, site_photo, contract
    uploaded_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    entity_type = Column(String(50), nullable=True)  # Project, PurchaseOrder, Client
    entity_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), nullable=True)


class VersionHistory(Base):
    __tablename__ = "version_history"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    entity_type = Column(String(50), index=True, nullable=False)  # Supplier, Client, Staff, Project, InventoryItem
    entity_id = Column(String(36), index=True, nullable=False)
    version_num = Column(Integer, nullable=False)
    serialized_data = Column(Text, nullable=False)  # JSON dump of data values
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by = Column(String(36), nullable=True)


class ProjectAssignment(Base):
    __tablename__ = "project_assignments"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project")
    user = relationship("User")


class DailyWorkLog(Base):
    __tablename__ = "daily_work_logs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    task = Column(String(200), nullable=False)
    hours_worked = Column(Float, nullable=False)
    progress_percentage = Column(Integer, nullable=False)
    remarks = Column(Text, nullable=True)
    work_photo = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")
    project = relationship("Project")


class ProjectDailyLog(Base):
    """NEW: Daily progress log submitted by employees for a project.
    Multiple logs per project per day (one per staff member).
    Separate from DailyWorkLog to avoid schema conflicts.
    """
    __tablename__ = "project_daily_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    staff_id = Column(String(36), ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    log_date = Column(Date, nullable=False, default=date.today)
    task = Column(String(300), nullable=False)
    hours_worked = Column(Float, nullable=False, default=0.0)
    progress_percentage = Column(Integer, nullable=False, default=0)  # 0-100
    remarks = Column(Text, nullable=True)
    work_photos = Column(Text, nullable=True)  # JSON array of file paths
    approval_status = Column(String(20), default="pending", nullable=False) # pending, approved, rejected
    supervisor_comment = Column(Text, nullable=True)
    approved_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    inventory_id = Column(String(36), ForeignKey("inventory.id", ondelete="SET NULL"), nullable=True)
    quantity_used = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    version_id = Column(Integer, default=1, nullable=False)

    __mapper_args__ = {
        "version_id_col": version_id
    }
    project = relationship("Project")
    staff = relationship("Staff")
    user = relationship("User", foreign_keys=[user_id])
    approver_user = relationship("User", foreign_keys=[approved_by])
    inventory = relationship("InventoryItem")


class DailyExpense(Base):
    """NEW: Daily Expenses records and categories.
    """
    __tablename__ = "daily_expenses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    expense_id = Column(String(50), unique=True, index=True, nullable=False)
    expense_date = Column(Date, nullable=False, default=date.today)
    expense_category = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    amount = Column(Float, nullable=False)
    vendor = Column(String(100), nullable=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    attachment_url = Column(String(255), nullable=True)
    payment_mode = Column(String(50), nullable=True, default="Cash")
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(36), nullable=True)

    project = relationship("Project")
    creator = relationship("User")


class LoginHistory(Base):
    __tablename__ = "login_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=True)
    email = Column(String(255), nullable=True)
    login_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(Text, nullable=True)
    success = Column(Integer, default=1, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    inventory_id = Column(String(36), ForeignKey("inventory.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    device = Column(String(255), nullable=True)
    browser = Column(Text, nullable=True)
    device_time = Column(String(50), nullable=True)
    images = Column(Text, nullable=True)
    documents = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")
    project = relationship("Project")
    inventory = relationship("InventoryItem")


class ProjectMaterialHistory(Base):
    __tablename__ = "project_material_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    inventory_id = Column(String(36), ForeignKey("inventory.id", ondelete="RESTRICT"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String(100), nullable=True)
    action = Column(String(50), nullable=False)  # used, returned, transferred_in, transferred_out
    quantity = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(50), default="approved", nullable=False)
    approved_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    project = relationship("Project")
    inventory = relationship("InventoryItem")
    user = relationship("User", foreign_keys=[user_id])
    approved_by_user = relationship("User", foreign_keys=[approved_by])


class FactoryFund(Base):
    __tablename__ = "factory_funds"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    fund_id = Column(String(50), unique=True, index=True, nullable=False)
    date = Column(Date, nullable=False, default=date.today)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(50), nullable=False)
    reference_number = Column(String(100), nullable=True)
    added_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    remarks = Column(Text, nullable=True)
    attachment_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")


class ProjectPayment(Base):
    __tablename__ = "project_payments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    payment_id = Column(String(50), unique=True, index=True, nullable=False)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    client_id = Column(String(36), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    invoice_number = Column(String(100), nullable=True)
    invoice_amount = Column(Float, nullable=False)
    received_amount = Column(Float, nullable=False)
    pending_amount = Column(Float, nullable=False)
    payment_method = Column(String(50), nullable=False)
    reference_number = Column(String(100), nullable=True)
    bank_name = Column(String(100), nullable=True)
    received_date = Column(Date, nullable=False, default=date.today)
    received_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    attachment_url = Column(String(255), nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project")
    client = relationship("Client")
    receiver = relationship("User")


