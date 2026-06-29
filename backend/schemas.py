from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator, model_validator
from typing import Optional, List
from datetime import datetime, date

# Generic Config for ORM serialization (Pydantic v2 style)
class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# Authentication & Users
class UserLogin(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: str = "worker"  # admin, manager, store, accountant, worker
    employee_code: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = "active"
    permissions: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    employee_code: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    permissions: Optional[str] = None

class UserResponse(BaseSchema):
    id: str
    email: EmailStr
    role: str
    full_name: str
    phone: Optional[str] = None
    employee_code: Optional[str] = None
    department: Optional[str] = None
    status: str = "active"
    permissions: Optional[str] = None
    created_at: datetime
    is_deleted: bool

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    role: str
    full_name: str

class TokenRefreshRequest(BaseModel):
    refresh_token: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

# Category
class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryResponse(BaseSchema):
    id: str
    name: str
    description: Optional[str]
    created_at: datetime
    is_deleted: bool

# Supplier
class SupplierCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None
    material_categories: Optional[str] = None

    @field_validator('gst_number')
    @classmethod
    def validate_gst(cls, v: Optional[str]) -> Optional[str]:
        if v:
            val = v.strip()
            if len(val) != 15:
                raise ValueError("GST Number must be exactly 15 characters long")
        return v

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v:
            val = v.strip()
            if not all(c.isdigit() or c in "+- " for c in val):
                raise ValueError("Phone number must contain only digits and spacing symbols")
        return v

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None
    material_categories: Optional[str] = None

    @field_validator('gst_number')
    @classmethod
    def validate_gst(cls, v: Optional[str]) -> Optional[str]:
        if v:
            val = v.strip()
            if len(val) != 15:
                raise ValueError("GST Number must be exactly 15 characters long")
        return v

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v:
            val = v.strip()
            if not all(c.isdigit() or c in "+- " for c in val):
                raise ValueError("Phone number must contain only digits and spacing symbols")
        return v

class SupplierResponse(BaseSchema):
    id: str
    name: str
    contact_person: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    gst_number: Optional[str]
    address: Optional[str]
    material_categories: Optional[str]
    created_at: datetime
    is_deleted: bool

# Client
class ClientCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v:
            val = v.strip()
            if not all(c.isdigit() or c in "+- " for c in val):
                raise ValueError("Phone number must contain only digits and spacing symbols")
        return v

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v:
            val = v.strip()
            if not all(c.isdigit() or c in "+- " for c in val):
                raise ValueError("Phone number must contain only digits and spacing symbols")
        return v

class ClientResponse(BaseSchema):
    id: str
    name: str
    contact_person: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    address: Optional[str]
    created_at: datetime
    is_deleted: bool

# Inventory Item
class InventoryItemCreate(BaseModel):
    category_id: Optional[str] = None
    name: str
    sku: str
    barcode: str
    brand: Optional[str] = None
    size_variant: Optional[str] = None
    quantity: float = 0.0
    unit: str
    minimum_stock_level: float = 5.0
    unit_cost: float = 0.0
    supplier_id: Optional[str] = None

    @field_validator('category_id', 'supplier_id', mode='before')
    @classmethod
    def sanitize_empty_strings(cls, v):
        if v == "":
            return None
        return v

    @field_validator('quantity', 'minimum_stock_level', 'unit_cost')
    @classmethod
    def validate_non_negative(cls, v: float, info) -> float:
        if v < 0:
            raise ValueError(f"{info.field_name} must be greater than or equal to 0")
        return v

class InventoryItemUpdate(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    brand: Optional[str] = None
    size_variant: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    minimum_stock_level: Optional[float] = None
    unit_cost: Optional[float] = None
    supplier_id: Optional[str] = None

    @field_validator('category_id', 'supplier_id', mode='before')
    @classmethod
    def sanitize_empty_strings(cls, v):
        if v == "":
            return None
        return v

    @field_validator('quantity', 'minimum_stock_level', 'unit_cost')
    @classmethod
    def validate_non_negative(cls, v: Optional[float], info) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError(f"{info.field_name} must be greater than or equal to 0")
        return v

class InventoryItemResponse(BaseSchema):
    id: str
    category_id: Optional[str]
    name: str
    sku: str
    barcode: str
    brand: Optional[str]
    size_variant: Optional[str]
    quantity: float
    unit: str
    minimum_stock_level: float
    unit_cost: float
    supplier_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    category: Optional[CategoryResponse] = None
    supplier: Optional[SupplierResponse] = None

class StockAdjustment(BaseModel):
    quantity: float
    notes: Optional[str] = None
    transaction_type: str = "adjustment"  # adjustment, return, damaged, transfer

class BarcodeLookup(BaseModel):
    barcode: str

# Project BOM
class ProjectBOMCreate(BaseModel):
    inventory_id: str
    required_quantity: float

    @field_validator('required_quantity')
    @classmethod
    def validate_required_qty(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("required_quantity must be greater than 0")
        return v

class ProjectBOMResponse(BaseSchema):
    id: str
    project_id: str
    inventory_id: str
    required_quantity: float
    used_quantity: float
    consumed_quantity: float
    status: str
    created_at: datetime
    inventory: Optional[InventoryItemResponse] = None

# Project
class ProjectCreate(BaseModel):
    name: str
    client_id: Optional[str] = None
    site_location: Optional[str] = None
    status: str = "planning"  # planning, active, on_hold, delayed, completed
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: float = 0.0
    department: Optional[str] = None

    @field_validator('client_id', 'start_date', 'end_date', mode='before')
    @classmethod
    def sanitize_empty_strings(cls, v):
        if v == "":
            return None
        return v

    @field_validator('budget')
    @classmethod
    def validate_budget(cls, v: float) -> float:
        if v < 0:
            raise ValueError("budget must be greater than or equal to 0")
        return v

    @model_validator(mode='after')
    def check_dates(self) -> 'ProjectCreate':
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("start_date must be before or equal to end_date")
        return self

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_id: Optional[str] = None
    site_location: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[float] = None
    department: Optional[str] = None

    @field_validator('client_id', 'start_date', 'end_date', mode='before')
    @classmethod
    def sanitize_empty_strings(cls, v):
        if v == "":
            return None
        return v

    @field_validator('budget')
    @classmethod
    def validate_budget(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("budget must be greater than or equal to 0")
        return v

    @model_validator(mode='after')
    def check_dates(self) -> 'ProjectUpdate':
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("start_date must be before or equal to end_date")
        return self

class ProjectResponse(BaseSchema):
    id: str
    name: str
    client_id: Optional[str]
    site_location: Optional[str]
    status: str
    start_date: Optional[date]
    end_date: Optional[date]
    budget: float
    department: Optional[str] = None
    created_at: datetime
    is_deleted: bool
    client: Optional[ClientResponse] = None
    bom_items: List[ProjectBOMResponse] = []

# Stock Transaction History
class StockTransactionCreate(BaseModel):
    inventory_id: str
    transaction_type: str  # in, out, adjustment, return, damaged, transfer
    quantity: float
    project_id: Optional[str] = None
    notes: Optional[str] = None

# Material Request
class MaterialRequestCreate(BaseModel):
    project_id: Optional[str] = None
    inventory_id: str
    quantity: float
    notes: Optional[str] = None

    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("quantity must be greater than 0")
        return v

class MaterialRequestResponse(BaseSchema):
    id: str
    project_id: Optional[str] = None
    inventory_id: str
    requested_by: Optional[str]
    quantity: float
    status: str
    approved_by: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    project: Optional[ProjectResponse] = None
    inventory: Optional[InventoryItemResponse] = None
    requester: Optional[UserResponse] = None

# Purchase Order
class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    inventory_id: str
    quantity: float
    unit_cost: float
    category: str = "Raw Material"
    
    # Redesign Purchase Order Additional Fields
    po_date: Optional[date] = None
    vendor_name: Optional[str] = None
    vendor_contact: Optional[str] = None
    vendor_gst: Optional[str] = None
    vendor_address: Optional[str] = None
    material_name: Optional[str] = None
    sku: Optional[str] = None
    unit: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    received_quantity: Optional[float] = 0.0
    pending_quantity: Optional[float] = 0.0
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    payment_status: Optional[str] = "Pending"
    remarks: Optional[str] = None

    @field_validator('quantity', 'unit_cost')
    @classmethod
    def validate_positives(cls, v: float, info) -> float:
        if v <= 0:
            raise ValueError(f"{info.field_name} must be greater than 0")
        return v

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = ["Raw Material", "Food Expense", "Shipping", "Labour", "Maintenance", "Packing", "Miscellaneous", "Hettich", "Hafele", "Ebco", "Ozone", "Board", "Hardware", "Misc"]
        if v not in allowed:
            raise ValueError(f"Category must be one of {allowed}")
        return v

class PurchaseOrderResponse(BaseSchema):
    id: str
    po_number: str
    supplier_id: str
    inventory_id: str
    quantity: float
    unit_cost: float
    total_cost: float
    status: str
    category: str
    requested_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    
    # Redesign Purchase Order Additional Fields
    po_date: Optional[date] = None
    vendor_name: Optional[str] = None
    vendor_contact: Optional[str] = None
    vendor_gst: Optional[str] = None
    vendor_address: Optional[str] = None
    material_name: Optional[str] = None
    sku: Optional[str] = None
    unit: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    received_quantity: Optional[float] = 0.0
    pending_quantity: Optional[float] = 0.0
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    payment_status: Optional[str] = "Pending"
    remarks: Optional[str] = None
    
    supplier: Optional[SupplierResponse] = None
    inventory: Optional[InventoryItemResponse] = None

# Shifts & Rules
class ShiftCreate(BaseModel):
    name: str
    check_in_time: str
    check_out_time: str

class ShiftResponse(BaseSchema):
    id: str
    name: str
    check_in_time: str
    check_out_time: str
    created_at: datetime
    is_deleted: bool

class AttendanceRuleUpdate(BaseModel):
    late_grace_minutes: int
    half_day_threshold_hours: float
    min_hours_present: float

class AttendanceRuleResponse(BaseSchema):
    id: str
    late_grace_minutes: int
    half_day_threshold_hours: float
    min_hours_present: float
    created_at: datetime

# Staff
class StaffCreate(BaseModel):
    name: str
    role: str
    phone: Optional[str] = None
    email: Optional[str] = None
    salary: float = 0.0
    status: str = "active"
    shift_id: Optional[str] = None

    @field_validator('salary')
    @classmethod
    def validate_salary(cls, v: float) -> float:
        if v < 0:
            raise ValueError("salary must be greater than or equal to 0")
        return v

class StaffUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    salary: Optional[float] = None
    status: Optional[str] = None
    shift_id: Optional[str] = None

    @field_validator('salary')
    @classmethod
    def validate_salary(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("salary must be greater than or equal to 0")
        return v

class StaffResponse(BaseSchema):
    id: str
    user_id: Optional[str]
    name: str
    role: str
    phone: Optional[str]
    email: Optional[str]
    salary: float
    status: str
    shift_id: Optional[str] = None
    shift: Optional[ShiftResponse] = None
    created_at: datetime
    is_deleted: bool

# Attendance
class AttendanceCreate(BaseModel):
    staff_id: str
    date: date
    status: str  # present, absent, leave
    check_in: Optional[str] = None
    check_out: Optional[str] = None

class AttendanceResponse(BaseSchema):
    id: str
    staff_id: str
    date: date
    status: str
    check_in: Optional[str]
    check_out: Optional[str]
    device: Optional[str] = None
    ip_address: Optional[str] = None
    total_hours: float
    overtime_hours: float
    late_arrival: bool
    early_departure: bool
    check_in_selfie: Optional[str] = None
    check_out_selfie: Optional[str] = None
    
    # Anti-Proxy fields
    check_in_fingerprint: Optional[str] = None
    check_in_browser: Optional[str] = None
    check_out_device: Optional[str] = None
    check_out_ip: Optional[str] = None
    check_out_fingerprint: Optional[str] = None
    check_out_browser: Optional[str] = None
    is_suspicious: bool = False
    suspicious_reason: Optional[str] = None
    
    # Project-linked details
    project_id: Optional[str] = None
    task: Optional[str] = None
    work_photo: Optional[str] = None
    remarks: Optional[str] = None
    progress_percentage: int = 0
    project: Optional[ProjectResponse] = None

    created_at: datetime
    staff_member: Optional[StaffResponse] = None

class AttendanceCorrection(BaseModel):
    status: Optional[str] = None
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    total_hours: Optional[float] = None
    overtime_hours: Optional[float] = None

# Notification
class NotificationResponse(BaseSchema):
    id: str
    title: str
    description: str
    type: str
    is_read: bool
    created_at: datetime

# Activity Log
class ActivityLogResponse(BaseSchema):
    id: str
    user_id: Optional[str]
    action: str
    details: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    user: Optional[UserResponse] = None

# Dashboard Executive Stats
class DashboardOverview(BaseModel):
    inventory_total_value: float
    inventory_total_items: int
    low_stock_items_count: int
    out_of_stock_items_count: int
    today_received_stock: float
    today_consumed_stock: float
    active_projects_count: int
    completed_projects_count: int
    delayed_projects_count: int
    projects_shortage_count: int
    open_pos_count: int
    pending_deliveries_count: int
    present_employees_count: int
    absent_employees_count: int
    today_expense_total: float = 0.0


# --- CONFIGURATION SCHEMAS ---

class CustomFieldDefinitionCreate(BaseModel):
    entity_type: str  # Supplier, Client, Staff, Project, InventoryItem
    name: str
    label: str
    field_type: str  # text, number, date, dropdown, checkbox
    is_required: bool = False
    choices: Optional[str] = None

class CustomFieldDefinitionResponse(BaseSchema):
    id: str
    entity_type: str
    name: str
    label: str
    field_type: str
    is_required: bool
    choices: Optional[str]
    created_at: datetime

class CustomFieldValueCreate(BaseModel):
    field_definition_id: str
    entity_id: str
    value_text: Optional[str] = None

class CustomFieldValueResponse(BaseSchema):
    id: str
    field_definition_id: str
    entity_id: str
    value_text: Optional[str]
    created_at: datetime
    definition: Optional[CustomFieldDefinitionResponse] = None

class WorkflowStepCreate(BaseModel):
    step_name: str
    step_order: int
    role_allowed_to_execute: str

class WorkflowStepResponse(BaseSchema):
    id: str
    workflow_id: str
    step_name: str
    step_order: int
    role_allowed_to_execute: str

class WorkflowDefinitionCreate(BaseModel):
    entity_type: str
    name: str
    description: Optional[str] = None
    steps: List[WorkflowStepCreate] = []

class WorkflowDefinitionResponse(BaseSchema):
    id: str
    entity_type: str
    name: str
    description: Optional[str]
    created_at: datetime
    steps: List[WorkflowStepResponse] = []

class ApprovalRuleCreate(BaseModel):
    entity_type: str
    min_value: float
    max_value: float
    role_approver: str

class ApprovalRuleResponse(BaseSchema):
    id: str
    entity_type: str
    min_value: float
    max_value: float
    role_approver: str
    created_at: datetime

class DashboardWidgetCreate(BaseModel):
    title: str
    widget_type: str
    layout_x: int
    layout_y: int
    layout_w: int
    layout_h: int

class DashboardWidgetResponse(BaseSchema):
    id: str
    user_id: str
    title: str
    widget_type: str
    layout_x: int
    layout_y: int
    layout_w: int
    layout_h: int
    created_at: datetime

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    deadline: Optional[date] = None
    priority: str = "medium"
    status: str = "todo"

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    deadline: Optional[date] = None
    priority: Optional[str] = None
    status: Optional[str] = None

class TaskResponse(BaseSchema):
    id: str
    title: str
    description: Optional[str]
    assigned_to: Optional[str]
    deadline: Optional[date]
    priority: str
    status: str
    created_at: datetime
    is_deleted: bool
    assignee: Optional[StaffResponse] = None

class DocumentCreate(BaseModel):
    name: str
    file_path: str
    category: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None

class DocumentResponse(BaseSchema):
    id: str
    name: str
    file_path: str
    category: Optional[str]
    uploaded_by: Optional[str]
    entity_type: Optional[str]
    entity_id: Optional[str]
    created_at: datetime
    is_deleted: bool

class VersionHistoryResponse(BaseSchema):
    id: str
    entity_type: str
    entity_id: str
    version_num: int
    serialized_data: str
    created_at: datetime
    created_by: Optional[str]


class ProjectAssignmentCreate(BaseModel):
    project_id: str
    user_id: str

class ProjectAssignmentResponse(BaseSchema):
    id: str
    project_id: str
    user_id: str
    created_at: datetime
    project: Optional[ProjectResponse] = None
    user: Optional[UserResponse] = None


class DailyWorkLogCreate(BaseModel):
    project_id: str
    task: str
    hours_worked: float
    progress_percentage: int
    remarks: Optional[str] = None
    work_photo: Optional[str] = None

    @field_validator('hours_worked')
    @classmethod
    def validate_hours(cls, v: float) -> float:
        if v <= 0 or v > 24:
            raise ValueError("hours_worked must be between 0.1 and 24.0")
        return v

    @field_validator('progress_percentage')
    @classmethod
    def validate_progress(cls, v: int) -> int:
        if v < 0 or v > 100:
            raise ValueError("progress_percentage must be between 0 and 100")
        return v

class DailyWorkLogResponse(BaseSchema):
    id: str
    user_id: str
    project_id: str
    task: str
    hours_worked: float
    progress_percentage: int
    remarks: Optional[str]
    work_photo: Optional[str] = None
    created_at: datetime
    user: Optional[UserResponse] = None
    project: Optional[ProjectResponse] = None


class CheckInRequest(BaseModel):
    device: Optional[str] = None
    ip_address: Optional[str] = None
    device_fingerprint: Optional[str] = None
    browser_details: Optional[str] = None
    custom_time: Optional[str] = None
    custom_date: Optional[date] = None


class CheckOutRequest(BaseModel):
    device: Optional[str] = None
    ip_address: Optional[str] = None
    device_fingerprint: Optional[str] = None
    browser_details: Optional[str] = None
    custom_time: Optional[str] = None
    custom_date: Optional[date] = None
    project_id: Optional[str] = None
    task: Optional[str] = None
    work_photo: Optional[str] = None
    remarks: Optional[str] = None
    progress_percentage: Optional[int] = None


# Daily Expense
class DailyExpenseCreate(BaseModel):
    expense_date: Optional[date] = None
    expense_category: str
    description: Optional[str] = None
    amount: float
    vendor: Optional[str] = None
    project_id: Optional[str] = None
    attachment_url: Optional[str] = None

    @field_validator('amount')
    @classmethod
    def validate_positive_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        return v

    @field_validator('expense_category')
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = ["Fuel", "Food", "Transport", "Courier", "Loading", "Labour", "Maintenance", "Electricity", "Internet", "Miscellaneous"]
        if v not in allowed:
            raise ValueError(f"Category must be one of {allowed}")
        return v

class DailyExpenseResponse(BaseSchema):
    id: str
    expense_id: str
    expense_date: date
    expense_category: str
    description: Optional[str]
    amount: float
    vendor: Optional[str]
    project_id: Optional[str]
    created_by: Optional[str]
    attachment_url: Optional[str]
    created_at: datetime
    is_deleted: bool
    project: Optional[ProjectResponse] = None
    creator: Optional[UserResponse] = None

class AuditLogResponse(BaseSchema):
    id: str
    user_id: Optional[str]
    project_id: Optional[str]
    action: str
    details: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    ip_address: Optional[str]
    device: Optional[str]
    browser: Optional[str]
    device_time: Optional[str]
    images: Optional[str] = None
    documents: Optional[str] = None
    created_at: datetime
    user: Optional[UserResponse] = None
