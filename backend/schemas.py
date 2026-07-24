from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator, model_validator
from typing import Optional, List
from datetime import datetime, date, date as dt_date

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

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
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
    sku: Optional[str] = None
    barcode: Optional[str] = None
    brand: Optional[str] = None
    size_variant: Optional[str] = None
    quantity: float = 0.0
    unit: str
    minimum_stock_level: float = 5.0
    unit_cost: float = 0.0
    supplier_id: Optional[str] = None
    rack: Optional[str] = None
    shelf: Optional[str] = None
    bin: Optional[str] = None
    safety_stock: float = 5.0
    reorder_level: float = 10.0
    critical_stock: float = 2.0

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
    rack: Optional[str] = None
    price: Optional[float] = None
    batch: Optional[str] = None
    location: Optional[str] = None
    warehouse: Optional[str] = None
    expiry: Optional[date] = None
    mrp: Optional[float] = None
    purchase_cost: Optional[float] = None
    selling_cost: Optional[float] = None

    @field_validator('category_id', 'supplier_id', mode='before')
    @classmethod
    def sanitize_empty_strings(cls, v):
        if v == "":
            return None
        return v

    @field_validator('quantity', 'minimum_stock_level', 'unit_cost', 'price', 'mrp', 'purchase_cost', 'selling_cost')
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
    reserved_quantity: float = 0.0
    available_quantity: float = 0.0
    unit: str
    minimum_stock_level: float
    unit_cost: float
    supplier_id: Optional[str]
    rack: Optional[str] = None
    shelf: Optional[str] = None
    bin: Optional[str] = None
    safety_stock: float = 5.0
    reorder_level: float = 10.0
    critical_stock: float = 2.0
    price: float = 0.0
    batch: Optional[str] = None
    location: Optional[str] = None
    warehouse: Optional[str] = None
    expiry: Optional[date] = None
    mrp: float = 0.0
    purchase_cost: float = 0.0
    selling_cost: float = 0.0
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    category: Optional[CategoryResponse] = None
    supplier: Optional[SupplierResponse] = None

class StockAdjustment(BaseModel):
    quantity: float
    notes: Optional[str] = None
    transaction_type: str = "adjustment"  # adjustment, return, damaged, transfer
    grn_number: Optional[str] = None
    supplier_id: Optional[str] = None
    purchase_order_id: Optional[str] = None
    warehouse: Optional[str] = None
    unit_cost: Optional[float] = None
    invoice_number: Optional[str] = None
    attachment_url: Optional[str] = None

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
    progress_mode: Optional[str] = "manual"

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
    progress_mode: Optional[str] = None

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
    completion_percentage: int = 0
    progress_mode: str = "manual"
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
    date: dt_date
    status: str  # present, absent, leave
    check_in: Optional[str] = None
    check_out: Optional[str] = None

class AttendanceResponse(BaseSchema):
    id: str
    staff_id: str
    date: dt_date
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
    payment_mode: Optional[str] = "Cash"
    remarks: Optional[str] = None
    
    # Cash received reconciliation fields
    cash_received: Optional[float] = 0.0
    returned_cash: Optional[float] = 0.0
    
    # Wallet integration
    wallet_id: Optional[str] = None
    wallet_linked: Optional[bool] = False
    settlement_status: Optional[str] = "settled"

    @field_validator('amount')
    @classmethod
    def validate_positive_amount(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Amount must be greater than or equal to 0")
        return v

    @field_validator('expense_category')
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = ["Fuel", "Petrol", "Food", "Transport", "Courier", "Loading", "Labour", "Maintenance", "Electricity", "Internet", "Miscellaneous", "Material Purchase", "Office Expense", "Salary", "Misc Expense", "Cash Returned", "Daily Expenses", "Other"]
        if v not in allowed:
            # Add fallback to allow custom categories dynamically
            return v
        return v

class DailyExpenseUpdate(BaseModel):
    expense_date: Optional[date] = None
    expense_category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    vendor: Optional[str] = None
    project_id: Optional[str] = None
    attachment_url: Optional[str] = None
    payment_mode: Optional[str] = None
    remarks: Optional[str] = None
    reason: str
    
    # Cash received reconciliation fields
    cash_received: Optional[float] = None
    returned_cash: Optional[float] = None
    approval_status: Optional[str] = None
    supervisor_comment: Optional[str] = None
    
    # Wallet integration
    wallet_id: Optional[str] = None
    wallet_linked: Optional[bool] = None
    settlement_status: Optional[str] = None

    @field_validator('amount')
    @classmethod
    def validate_positive_amount(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Amount must be greater than or equal to 0")
        return v

    @field_validator('expense_category')
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = ["Fuel", "Petrol", "Food", "Transport", "Courier", "Loading", "Labour", "Maintenance", "Electricity", "Internet", "Miscellaneous", "Material Purchase", "Office Expense", "Salary", "Misc Expense", "Cash Returned", "Daily Expenses", "Other"]
        if v not in allowed:
            return v
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
    payment_mode: Optional[str]
    remarks: Optional[str]
    created_at: datetime
    is_deleted: bool
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
    
    # Cash received reconciliation fields
    cash_received: float
    returned_cash: float
    
    # Expense approval fields
    approval_status: str
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    supervisor_comment: Optional[str]
    settlement_status: str

    # Wallet integration fields
    wallet_id: Optional[str] = None
    wallet_linked: bool = False
    linked_date: Optional[dt_date] = None
    transaction_source: Optional[str] = None
    
    project: Optional[ProjectResponse] = None
    creator: Optional[UserResponse] = None
    approver: Optional[UserResponse] = None

class AuditLogResponse(BaseSchema):
    id: str
    user_id: Optional[str]
    project_id: Optional[str]
    inventory_id: Optional[str] = None
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
    reason: Optional[str] = None
    created_at: datetime
    user: Optional[UserResponse] = None
    inventory: Optional[InventoryItemResponse] = None


class ProjectMaterialHistoryResponse(BaseSchema):
    id: str
    project_id: str
    inventory_id: str
    user_id: Optional[str]
    username: Optional[str]
    action: str
    quantity: float
    notes: Optional[str]
    created_at: datetime
    status: Optional[str] = "approved"
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    inventory: Optional[InventoryItemResponse] = None


class MaterialUseRequest(BaseModel):
    inventory_id: str
    quantity: float
    action: str  # 'used' or 'returned'
    notes: Optional[str] = None

    @field_validator('quantity')
    @classmethod
    def validate_positive_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return v

    @field_validator('action')
    @classmethod
    def validate_action(cls, v: str) -> str:
        if v not in ['used', 'returned']:
            raise ValueError("Action must be 'used' or 'returned'")
        return v


class MaterialTransferRequest(BaseModel):
    from_project_id: str
    to_project_id: str
    inventory_id: str
    quantity: float
    notes: Optional[str] = None

    @field_validator('quantity')
    @classmethod
    def validate_positive_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return v


class NewMaterialAndProjectUsageRequest(BaseModel):
    name: str
    category_id: Optional[str] = None
    sku: str
    barcode: Optional[str] = None
    brand: Optional[str] = None
    size_variant: Optional[str] = None
    unit: str
    minimum_stock_level: float = 5.0
    unit_cost: float = 0.0
    quantity: float  # Quantity to allocate and use
    notes: Optional[str] = None

    @field_validator('quantity')
    @classmethod
    def validate_positive_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return v

class CategoryMergeRequest(BaseModel):
    source_id: str
    target_id: str

class CategoryMoveMaterialsRequest(BaseModel):
    material_ids: List[str]
    target_id: str

class BulkActionRequest(BaseModel):
    entity_type: str  # inventory, project, employee, client, expense, purchase, request, document
    action: str  # archive, restore, delete_permanent
    ids: List[str]
    reason: Optional[str] = None
    password: Optional[str] = None


class FactoryFundCreate(BaseModel):
    date: Optional[dt_date] = None
    amount: float
    payment_method: str
    reference_number: Optional[str] = None
    remarks: Optional[str] = None
    attachment_url: Optional[str] = None
    wallet_id: Optional[str] = None

    @field_validator('amount')
    @classmethod
    def validate_positive_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        return v

    @field_validator('payment_method')
    @classmethod
    def validate_payment_method(cls, v: str) -> str:
        allowed = ["Cash", "UPI", "Bank Transfer", "Cheque"]
        if v not in allowed:
            raise ValueError(f"Payment method must be one of {allowed}")
        return v


class FactoryFundResponse(BaseSchema):
    id: str
    fund_id: str
    date: dt_date
    amount: float
    payment_method: str
    reference_number: Optional[str]
    added_by: Optional[str]
    remarks: Optional[str]
    attachment_url: Optional[str]
    created_at: datetime
    user: Optional[UserResponse] = None


class FactoryWalletCreate(BaseModel):
    name: str
    opening_balance: float = 0.0
    activation_date: Optional[dt_date] = None
    status: Optional[str] = "active"

    @field_validator('opening_balance')
    @classmethod
    def validate_positive_balance(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Opening balance must be greater than or equal to 0")
        return v


class FactoryWalletUpdate(BaseModel):
    name: Optional[str] = None
    opening_balance: Optional[float] = None
    activation_date: Optional[dt_date] = None
    status: Optional[str] = None


class WalletTransferRequest(BaseModel):
    source_wallet_id: Optional[str] = None  # None or "cash_book" means from company cash book
    destination_wallet_id: str
    amount: float
    date: Optional[dt_date] = None
    remarks: Optional[str] = None

    @field_validator('amount')
    @classmethod
    def validate_positive_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Transfer amount must be greater than 0")
        return v


class FactoryWalletResponse(BaseSchema):
    id: str
    name: Optional[str]
    opening_balance: float
    activation_date: Optional[dt_date]
    opening_txn_id: Optional[str]
    balance: float
    status: str
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime


class FactoryWalletBalanceResponse(BaseModel):
    balance: float
    updated_at: datetime


class FactoryWalletTransactionResponse(BaseSchema):
    id: str
    transaction_id: str
    date: dt_date
    transaction_type: str
    money_added: float
    expense_deducted: float
    running_balance: float
    remarks: Optional[str]
    reference_type: Optional[str]
    reference_id: Optional[str]
    user_id: Optional[str]
    approved_by: Optional[str]
    created_at: datetime
    user: Optional[UserResponse] = None
    approver: Optional[UserResponse] = None



class ProjectPaymentCreate(BaseModel):
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_amount: Optional[float] = 0.0
    received_amount: float
    payment_method: str
    reference_number: Optional[str] = None
    bank_name: Optional[str] = None
    received_date: Optional[date] = None
    remarks: Optional[str] = None
    attachment_url: Optional[str] = None
    receipt_type: Optional[str] = "Project Payment"
    wallet_id: Optional[str] = None
    wallet_linked: Optional[bool] = False

    @field_validator('invoice_amount', 'received_amount')
    @classmethod
    def validate_positive_amount(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Amount must be greater than or equal to 0")
        return v

    @field_validator('payment_method')
    @classmethod
    def validate_payment_method(cls, v: str) -> str:
        allowed = ["Cash", "UPI", "NEFT", "RTGS", "Cheque", "Bank"]
        if v not in allowed:
            return v
        return v
        if v not in allowed:
            raise ValueError(f"Payment method must be one of {allowed}")
        return v


class ProjectPaymentResponse(BaseSchema):
    id: str
    payment_id: str
    project_id: Optional[str]
    client_id: Optional[str]
    invoice_number: Optional[str]
    invoice_amount: float
    received_amount: float
    pending_amount: float
    payment_method: str
    reference_number: Optional[str]
    bank_name: Optional[str]
    received_date: date
    received_by: Optional[str]
    attachment_url: Optional[str]
    remarks: Optional[str]
    created_at: datetime
    receipt_type: str
    is_deleted: bool = False
    wallet_id: Optional[str] = None
    wallet_linked: bool = False
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
    project: Optional[ProjectResponse] = None
    client: Optional[ClientResponse] = None
    receiver: Optional[UserResponse] = None


class ProjectPaymentVersionResponse(BaseSchema):
    id: str
    payment_id: str
    old_values: Optional[str]
    new_values: Optional[str]
    user_id: Optional[str]
    updated_at: datetime
    reason: Optional[str]
    user: Optional[UserResponse] = None


class StockTransactionResponse(BaseSchema):
    id: str
    inventory_id: str
    transaction_type: str
    quantity: float
    project_id: Optional[str]
    user_id: Optional[str]
    notes: Optional[str]
    created_at: datetime
    grn_number: Optional[str] = None
    supplier_id: Optional[str] = None
    purchase_order_id: Optional[str] = None
    warehouse: Optional[str] = None
    unit_cost: Optional[float] = None
    invoice_number: Optional[str] = None
    attachment_url: Optional[str] = None
    opening_stock: Optional[float] = None
    remaining_quantity: Optional[float] = None
    project: Optional[ProjectResponse] = None
    user: Optional[UserResponse] = None
    supplier: Optional[SupplierResponse] = None
    inventory: Optional[InventoryItemResponse] = None


class CashBookCreate(BaseModel):
    date: Optional[dt_date] = None
    transaction_type: str  # IN, OUT
    category: str
    amount: float
    payment_method: Optional[str] = "Cash"
    reference_number: Optional[str] = None
    remarks: Optional[str] = None
    attachment_url: Optional[str] = None

    @field_validator('amount')
    @classmethod
    def validate_positive_amount(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Amount must be greater than or equal to 0")
        return v


class CashBookResponse(BaseSchema):
    id: str
    transaction_id: str
    date: dt_date
    transaction_type: str
    category: str
    amount: float
    payment_method: str
    reference_number: Optional[str]
    reference_type: Optional[str]
    reference_id: Optional[str]
    added_by: Optional[str]
    remarks: Optional[str]
    attachment_url: Optional[str]
    created_at: datetime
    is_deleted: bool
    running_balance: Optional[float] = None
    user: Optional[UserResponse] = None


class BarcodeSupplierDetails(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class BarcodeLastPurchaseDetails(BaseModel):
    unit_cost: float
    date: Optional[str] = None
    quantity: float
    po_number: Optional[str] = None

class BarcodeProjectUsage(BaseModel):
    project_id: str
    project_name: str
    total_used: float
    total_consumed: float

class BarcodeLookupResponse(BaseModel):
    item: InventoryItemResponse
    supplier: Optional[BarcodeSupplierDetails] = None
    last_purchase: Optional[BarcodeLastPurchaseDetails] = None
    project_usage: List[BarcodeProjectUsage] = []

class StockMovementRequest(BaseModel):
    barcode: str
    transaction_type: str  # issue, receive, transfer, adjust
    quantity: float
    project_id: Optional[str] = None
    supplier_id: Optional[str] = None
    warehouse: Optional[str] = None
    notes: Optional[str] = None
    unit_cost: Optional[float] = None

class InventoryReceiveRequest(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    barcode: str
    supplier_id: Optional[str] = None
    invoice_number: Optional[str] = None
    purchase_order_id: Optional[str] = None
    receiving_date: Optional[date] = None
    vehicle_number: Optional[str] = None
    warehouse: Optional[str] = None
    received_quantity: float
    remarks: Optional[str] = None
    batch_number: Optional[str] = None
    unit_cost: Optional[float] = None
    category_id: Optional[str] = None
    brand: Optional[str] = None
    size_variant: Optional[str] = None
    unit: Optional[str] = "Sheets"
    mrp: Optional[float] = None
    price: Optional[float] = None
    selling_cost: Optional[float] = None
    expiry: Optional[date] = None


# WMS schemas
class WarehouseLocationCreate(BaseModel):
    warehouse: str
    rack: str
    shelf: str
    bin: str
    description: Optional[str] = None

class WarehouseLocationResponse(BaseModel):
    id: str
    warehouse: str
    rack: str
    shelf: str
    bin: str
    description: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class BatchCreate(BaseModel):
    inventory_id: str
    batch_number: str
    manufacturing_date: Optional[date] = None
    purchase_date: Optional[date] = None
    supplier_batch: Optional[str] = None
    quantity: float = 0.0

class BatchResponse(BaseModel):
    id: str
    inventory_id: str
    batch_number: str
    manufacturing_date: Optional[date]
    purchase_date: Optional[date]
    supplier_batch: Optional[str]
    quantity: float
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SerialCreate(BaseModel):
    inventory_id: str
    serial_number: str
    status: str = "available"
    project_id: Optional[str] = None
    batch_id: Optional[str] = None

class SerialResponse(BaseModel):
    id: str
    inventory_id: str
    serial_number: str
    status: str
    project_id: Optional[str]
    batch_id: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class StockAuditItemCreate(BaseModel):
    inventory_id: str
    expected_qty: float
    actual_qty: float
    notes: Optional[str] = None

class StockAuditItemResponse(BaseModel):
    id: str
    audit_id: str
    inventory_id: str
    expected_qty: float
    actual_qty: float
    difference: float
    notes: Optional[str]
    scanned_at: datetime
    model_config = ConfigDict(from_attributes=True)

class StockAuditCreate(BaseModel):
    warehouse: str
    rack: Optional[str] = None
    shelf: Optional[str] = None
    items: List[StockAuditItemCreate]

class StockAuditResponse(BaseModel):
    id: str
    audit_date: date
    warehouse: str
    rack: Optional[str]
    shelf: Optional[str]
    status: str
    audited_by: Optional[str]
    report_summary: Optional[str]
    created_at: datetime
    items: List[StockAuditItemResponse] = []
    model_config = ConfigDict(from_attributes=True)

class DispatchLogCreate(BaseModel):
    project_id: str
    recipient_name: Optional[str] = None
    vehicle_details: Optional[str] = None
    tracking_number: Optional[str] = None
    notes: Optional[str] = None

class DispatchLogResponse(BaseModel):
    id: str
    project_id: str
    dispatch_date: datetime
    dispatched_by: Optional[str]
    recipient_name: Optional[str]
    vehicle_details: Optional[str]
    tracking_number: Optional[str]
    notes: Optional[str]
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class LabelPrintRequest(BaseModel):
    inventory_id: str
    label_type: str  # 50x25, 60x40, A4
    copies: int = 1

class BarcodeScanRequest(BaseModel):
    barcode: str

class MaterialReceiveRequest(BaseModel):
    barcode: str
    quantity: float
    warehouse: Optional[str] = None
    rack: Optional[str] = None
    shelf: Optional[str] = None
    bin: Optional[str] = None
    purchase_order_id: Optional[str] = None
    batch_number: Optional[str] = None
    serial_number: Optional[str] = None
    notes: Optional[str] = None

class MaterialIssueRequest(BaseModel):
    barcode: str
    project_id: str
    quantity: float
    serial_number: Optional[str] = None
    notes: Optional[str] = None

class StockTransferRequest(BaseModel):
    barcode: str
    from_warehouse: Optional[str] = None
    to_warehouse: str
    to_rack: Optional[str] = None
    to_shelf: Optional[str] = None
    to_bin: Optional[str] = None
    quantity: float
    notes: Optional[str] = None

class ReturnMaterialRequest(BaseModel):
    barcode: str
    quantity: float
    reason: str  # Damage, Replacement, Repair, Unused
    project_id: Optional[str] = None
    notes: Optional[str] = None


class BarcodeHistoryResponse(BaseModel):
    id: str
    barcode: str
    barcode_type: str
    inventory_id: Optional[str] = None
    project_id: Optional[str] = None
    generated_date: datetime
    generated_by: Optional[str] = None
    print_count: int
    status: str
    entity_name: Optional[str] = None
    creator_name: Optional[str] = None

    class Config:
        from_attributes = True


class BarcodeGenerateRequest(BaseModel):
    entity_type: Optional[str] = None  # "inventory" or "project"
    entity_id: Optional[str] = None
    module: Optional[str] = None       # "inventory" or "project"
    inventory_id: Optional[str] = None
    project_id: Optional[str] = None

    def get_type(self) -> str:
        t = self.entity_type or self.module or "inventory"
        return t.lower()

    def get_id(self) -> Optional[str]:
        return self.entity_id or self.inventory_id or self.project_id







