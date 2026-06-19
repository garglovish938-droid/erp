import os
import shutil
import csv
import io
import json
import uuid
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Query, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

# Excel and PDF libraries
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.graphics.barcode.code128 import Code128

from config import settings
from database import get_db, engine, Base
from models import (
    User, Category, InventoryItem, Supplier, Client, Project, ProjectBOM,
    StockTransaction, MaterialRequest, PurchaseOrder, Staff, Attendance,
    Notification, ActivityLog, CustomFieldDefinition, CustomFieldValue
)
import crud, schemas, auth

# Initialize FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise ERP for Allure Living Furniture Manufacturing"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure database tables exist
Base.metadata.create_all(bind=engine)

# Backup and upload directory setups — paths come from config (env vars in production)
BACKUP_DIR = settings.BACKUP_DIR
os.makedirs(BACKUP_DIR, exist_ok=True)
UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"message": "Welcome to Allure Living ERP API System", "status": "running"}

# --- AUTH & USER MANAGEMENT ---
@app.post("/api/auth/register", response_model=schemas.UserResponse)
def register_user(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user_in.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    password_hash = auth.get_password_hash(user_in.password)
    return crud.create_user(db=db, user_in=user_in, password_hash=password_hash)

@app.post("/api/auth/login", response_model=schemas.Token)
def login_user(user_in: schemas.UserLogin, db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=user_in.email)
    if not user or not auth.verify_password(user_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    crud.log_activity(db, user.id, "login", f"Successful login for {user.email}")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.full_name
    }

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_user_me(current_user: User = Depends(auth.get_current_user)):
    return current_user

@app.post("/api/auth/logout")
def logout_user(current_user: User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    crud.log_detailed_activity(
        db, 
        user_id=current_user.id, 
        module="Auth", 
        action="logout", 
        record_id=current_user.id, 
        message=f"Successful logout for {current_user.email}"
    )
    return {"status": "success", "message": "Logged out successfully"}


@app.get("/api/auth/users", response_model=List[schemas.UserResponse])
def read_users(db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    return crud.get_users(db)


# --- INVENTORY MODULE ---
@app.get("/api/inventory", response_model=List[schemas.InventoryItemResponse])
def read_inventory(include_deleted: bool = False, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_inventory_items(db, include_deleted)

@app.post("/api/inventory", response_model=schemas.InventoryItemResponse)
def create_inventory_item(item_in: schemas.InventoryItemCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_store_or_higher)):
    db_item = crud.get_inventory_item_by_sku(db, item_in.sku)
    if db_item:
        raise HTTPException(status_code=400, detail="SKU already exists")
    db_item_bar = crud.get_inventory_item_by_barcode(db, item_in.barcode)
    if db_item_bar:
        raise HTTPException(status_code=400, detail="Barcode already exists")
    return crud.create_inventory_item(db=db, item=item_in, user_id=current_user.id)

@app.get("/api/inventory/{item_id}", response_model=schemas.InventoryItemResponse)
def read_inventory_item(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    db_item = crud.get_inventory_item(db, item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    return db_item

@app.put("/api/inventory/{item_id}", response_model=schemas.InventoryItemResponse)
def update_inventory_item(item_id: str, item_in: schemas.InventoryItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_store_or_higher)):
    db_item = crud.update_inventory_item(db=db, item_id=item_id, item_in=item_in, user_id=current_user.id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    return db_item

@app.delete("/api/inventory/{item_id}")
def delete_inventory_item(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    success = crud.delete_inventory_item(db=db, item_id=item_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"status": "success", "message": "Item deleted"}

@app.post("/api/inventory/{item_id}/restore")
def restore_inventory_item(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    try:
        success = crud.restore_inventory_item(db=db, item_id=item_id, user_id=current_user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Item not found or already active")
        return {"status": "success", "message": "Item restored"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/inventory/{item_id}/adjust", response_model=schemas.InventoryItemResponse)
def adjust_inventory_stock(item_id: str, adj: schemas.StockAdjustment, db: Session = Depends(get_db), current_user: User = Depends(auth.require_store_or_higher)):
    try:
        return crud.adjust_stock(
            db=db,
            inventory_id=item_id,
            quantity=adj.quantity,
            transaction_type=adj.transaction_type,
            user_id=current_user.id,
            notes=adj.notes
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/inventory/lookup/{barcode}", response_model=schemas.InventoryItemResponse)
def lookup_barcode(barcode: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    db_item = crud.get_inventory_item_by_barcode(db, barcode)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found for this barcode")
    return db_item

@app.post("/api/inventory/import")
async def import_inventory_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.require_store_or_higher)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    contents = await file.read()
    buffer = io.StringIO(contents.decode("utf-8-sig"))
    reader = csv.reader(buffer)
    try:
        headers = next(reader)
    except StopIteration:
        raise HTTPException(status_code=400, detail="CSV file is empty.")
    headers = [h.strip() for h in headers]
    header_mapping = {
        "sku": ["sku", "material code/sku", "code", "material code", "item sku"],
        "name": ["name", "material name", "item name", "description"],
        "category": ["category", "material category", "group"],
        "brand": ["brand", "make", "manufacturer"],
        "unit": ["unit", "unit of measure", "uom"],
        "quantity": ["quantity", "qty", "stock quantity", "stock", "in stock"],
        "minimum_stock_level": ["minimum_stock_level", "min stock", "minimum level", "min stock level", "alert level"],
        "unit_cost": ["unit_cost", "cost", "unit cost", "unit cost ($)", "price"],
        "barcode": ["barcode", "barcode value"]
    }
    col_indices = {}
    for field, synonyms in header_mapping.items():
        found = False
        for syn in synonyms:
            for idx, h in enumerate(headers):
                if h.lower() == syn:
                    col_indices[field] = idx
                    found = True
                    break
            if found:
                break
    if "sku" not in col_indices or "name" not in col_indices:
        raise HTTPException(status_code=400, detail=f"Required columns 'SKU' or 'Name' not found for Inventory import. Columns: {headers}")
    success_count = 0
    updated_count = 0
    category_cache = {}
    for row in reader:
        if not row or all(cell.strip() == "" for cell in row):
            continue
        try:
            def get_val(field, default=""):
                idx = col_indices.get(field)
                if idx is not None and idx < len(row):
                    return row[idx].strip()
                return default
            sku = get_val("sku")
            name = get_val("name")
            if not sku or not name:
                continue
            cat_name = get_val("category", "Uncategorized")
            brand = get_val("brand")
            unit = get_val("unit", "Sheets")
            try:
                quantity = float(get_val("quantity", "0"))
            except ValueError:
                quantity = 0.0
            try:
                min_stock = float(get_val("minimum_stock_level", "5"))
            except ValueError:
                min_stock = 5.0
            try:
                unit_cost = float(get_val("unit_cost", "0"))
            except ValueError:
                unit_cost = 0.0
            barcode = get_val("barcode")

            cat_key = cat_name.lower()
            if cat_key in category_cache:
                db_cat = category_cache[cat_key]
            else:
                db_cat = db.query(Category).filter(Category.name.ilike(cat_name)).first()
                if not db_cat:
                    db_cat = Category(name=cat_name, description=f"Auto created from CSV import")
                    db.add(db_cat)
                    db.commit()
                    db.refresh(db_cat)
                elif db_cat.is_deleted:
                    db_cat.is_deleted = False
                    db_cat.deleted_at = None
                    db_cat.deleted_by = None
                    db.commit()
                    db.refresh(db_cat)
                category_cache[cat_key] = db_cat

            # Query regardless of deletion status to prevent IntegrityError on re-insert
            db_item = db.query(InventoryItem).filter(InventoryItem.sku == sku).first()
            if db_item:
                db_item.name = name
                db_item.category_id = db_cat.id
                if brand:
                    db_item.brand = brand
                db_item.unit = unit
                db_item.quantity = quantity
                db_item.minimum_stock_level = min_stock
                db_item.unit_cost = unit_cost
                db_item.updated_at = datetime.utcnow()

                # Restore if it was soft-deleted
                if db_item.is_deleted:
                    db_item.is_deleted = False
                    db_item.deleted_at = None
                    db_item.deleted_by = None

                if barcode and db_item.barcode != barcode:
                    other = db.query(InventoryItem).filter(InventoryItem.barcode == barcode, InventoryItem.id != db_item.id).first()
                    if not other:
                        db_item.barcode = barcode
                    else:
                        db_item.barcode = f"GEN{100000 + db.query(InventoryItem).count() + 1}"
                updated_count += 1
            else:
                if not barcode:
                    barcode = f"GEN{100000 + db.query(InventoryItem).count() + 1}"
                else:
                    other = db.query(InventoryItem).filter(InventoryItem.barcode == barcode).first()
                    if other:
                        barcode = f"GEN{100000 + db.query(InventoryItem).count() + 1}"
                new_item = InventoryItem(
                    sku=sku,
                    name=name,
                    category_id=db_cat.id,
                    brand=brand,
                    unit=unit,
                    quantity=quantity,
                    minimum_stock_level=min_stock,
                    unit_cost=unit_cost,
                    barcode=barcode
                )
                db.add(new_item)
                success_count += 1
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Row import error: {str(e)}")
    db.commit()
    crud.log_activity(db, current_user.id, "bulk_import", f"Created {success_count}, updated {updated_count} items")
    return {"status": "success", "message": f"Created {success_count}, updated {updated_count} records."}


@app.post("/api/suppliers/import")
async def import_suppliers_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.require_store_or_higher)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    contents = await file.read()
    buffer = io.StringIO(contents.decode("utf-8-sig"))
    reader = csv.reader(buffer)
    try:
        headers = next(reader)
    except StopIteration:
        raise HTTPException(status_code=400, detail="CSV file is empty.")
    
    headers = [h.strip() for h in headers]
    required_cols = ["Name"]
    for req in required_cols:
        if req.lower() not in [h.lower() for h in headers]:
            raise HTTPException(status_code=400, detail=f"Required column '{req}' not found for Supplier import. Columns: {headers}")
            
    header_lower = [h.lower() for h in headers]
    
    def get_idx(name):
        try:
            return header_lower.index(name)
        except ValueError:
            return None
            
    idx_name = get_idx("name") or get_idx("supplier name")
    idx_contact = get_idx("contact person") or get_idx("contact")
    idx_phone = get_idx("phone") or get_idx("phone number")
    idx_email = get_idx("email") or get_idx("email address")
    idx_gst = get_idx("gst number") or get_idx("gst") or get_idx("gstin")
    idx_address = get_idx("address")
    idx_cats = get_idx("material categories") or get_idx("categories")
    
    if idx_name is None:
        raise HTTPException(status_code=400, detail="Required column 'Name' or 'Supplier Name' not found for Supplier import.")
        
    success_count = 0
    updated_count = 0
    
    for row in reader:
        if not row or all(cell.strip() == "" for cell in row):
            continue
        try:
            def get_val(idx, default=""):
                if idx is not None and idx < len(row):
                    return row[idx].strip()
                return default
                
            name = get_val(idx_name)
            if not name:
                continue
                
            contact = get_val(idx_contact)
            phone = get_val(idx_phone)
            email = get_val(idx_email)
            gst = get_val(idx_gst)
            address = get_val(idx_address)
            cats = get_val(idx_cats)
            
            db_sup = db.query(Supplier).filter(Supplier.name.ilike(name)).first()
            if db_sup:
                db_sup.contact_person = contact or db_sup.contact_person
                db_sup.phone = phone or db_sup.phone
                db_sup.email = email or db_sup.email
                db_sup.gst_number = gst or db_sup.gst_number
                db_sup.address = address or db_sup.address
                db_sup.material_categories = cats or db_sup.material_categories
                if db_sup.is_deleted:
                    db_sup.is_deleted = False
                    db_sup.deleted_at = None
                    db_sup.deleted_by = None
                updated_count += 1
            else:
                db_sup = Supplier(
                    name=name,
                    contact_person=contact,
                    phone=phone,
                    email=email,
                    gst_number=gst,
                    address=address,
                    material_categories=cats
                )
                db.add(db_sup)
                success_count += 1
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Row import error: {str(e)}")
            
    crud.log_activity(db, current_user.id, "bulk_import", f"Imported Suppliers: created {success_count}, updated {updated_count}")
    return {"status": "success", "message": f"Created {success_count}, updated {updated_count} suppliers successfully."}

@app.post("/api/clients/import")
async def import_clients_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.require_manager_or_higher)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    contents = await file.read()
    buffer = io.StringIO(contents.decode("utf-8-sig"))
    reader = csv.reader(buffer)
    try:
        headers = next(reader)
    except StopIteration:
        raise HTTPException(status_code=400, detail="CSV file is empty.")
    
    headers = [h.strip() for h in headers]
    required_cols = ["Name"]
    for req in required_cols:
        if req.lower() not in [h.lower() for h in headers]:
            raise HTTPException(status_code=400, detail=f"Required column '{req}' not found for Client import. Columns: {headers}")
            
    header_lower = [h.lower() for h in headers]
    
    def get_idx(name):
        try:
            return header_lower.index(name)
        except ValueError:
            return None
            
    idx_name = get_idx("name") or get_idx("company name") or get_idx("client name")
    idx_contact = get_idx("contact person") or get_idx("contact")
    idx_phone = get_idx("phone") or get_idx("phone number")
    idx_email = get_idx("email") or get_idx("email address")
    idx_address = get_idx("address") or get_idx("billing address")
    
    if idx_name is None:
        raise HTTPException(status_code=400, detail="Required column 'Name' or 'Client Name' not found for Client import.")
        
    success_count = 0
    updated_count = 0
    
    for row in reader:
        if not row or all(cell.strip() == "" for cell in row):
            continue
        try:
            def get_val(idx, default=""):
                if idx is not None and idx < len(row):
                    return row[idx].strip()
                return default
                
            name = get_val(idx_name)
            if not name:
                continue
                
            contact = get_val(idx_contact)
            phone = get_val(idx_phone)
            email = get_val(idx_email)
            address = get_val(idx_address)
            
            db_client = db.query(Client).filter(Client.name.ilike(name)).first()
            if db_client:
                db_client.contact_person = contact or db_client.contact_person
                db_client.phone = phone or db_client.phone
                db_client.email = email or db_client.email
                db_client.address = address or db_client.address
                if db_client.is_deleted:
                    db_client.is_deleted = False
                    db_client.deleted_at = None
                    db_client.deleted_by = None
                updated_count += 1
            else:
                db_client = Client(
                    name=name,
                    contact_person=contact,
                    phone=phone,
                    email=email,
                    address=address
                )
                db.add(db_client)
                success_count += 1
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Row import error: {str(e)}")
            
    crud.log_activity(db, current_user.id, "bulk_import", f"Imported Clients: created {success_count}, updated {updated_count}")
    return {"status": "success", "message": f"Created {success_count}, updated {updated_count} clients successfully."}

@app.post("/api/staff/import")
async def import_staff_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.require_admin)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    contents = await file.read()
    buffer = io.StringIO(contents.decode("utf-8-sig"))
    reader = csv.reader(buffer)
    try:
        headers = next(reader)
    except StopIteration:
        raise HTTPException(status_code=400, detail="CSV file is empty.")
    
    headers = [h.strip() for h in headers]
    required_cols = ["Name", "Role"]
    for req in required_cols:
        if req.lower() not in [h.lower() for h in headers]:
            raise HTTPException(status_code=400, detail=f"Required column '{req}' not found for Employee import. Columns: {headers}")
            
    header_lower = [h.lower() for h in headers]
    
    def get_idx(name):
        try:
            return header_lower.index(name)
        except ValueError:
            return None
            
    idx_name = get_idx("name") or get_idx("employee name")
    idx_role = get_idx("role") or get_idx("designation")
    idx_phone = get_idx("phone") or get_idx("phone number")
    idx_email = get_idx("email") or get_idx("email address")
    idx_salary = get_idx("salary") or get_idx("salary ($)") or get_idx("monthly salary")
    idx_status = get_idx("status")
    
    success_count = 0
    updated_count = 0
    
    for row in reader:
        if not row or all(cell.strip() == "" for cell in row):
            continue
        try:
            def get_val(idx, default=""):
                if idx is not None and idx < len(row):
                    return row[idx].strip()
                return default
                
            name = get_val(idx_name)
            role = get_val(idx_role)
            if not name or not role:
                continue
                
            phone = get_val(idx_phone)
            email = get_val(idx_email)
            salary_str = get_val(idx_salary, "0")
            status = get_val(idx_status, "active").lower()
            
            try:
                salary = float(salary_str)
            except ValueError:
                salary = 0.0
                
            if status not in ["active", "inactive"]:
                status = "active"
                
            db_staff = None
            if email:
                db_staff = db.query(Staff).filter(Staff.email == email).first()
            if not db_staff:
                db_staff = db.query(Staff).filter(Staff.name.ilike(name)).first()
                
            if db_staff:
                db_staff.name = name
                db_staff.role = role
                db_staff.phone = phone or db_staff.phone
                db_staff.email = email or db_staff.email
                db_staff.salary = salary
                db_staff.status = status
                if db_staff.is_deleted:
                    db_staff.is_deleted = False
                    db_staff.deleted_at = None
                    db_staff.deleted_by = None
                updated_count += 1
            else:
                db_staff = Staff(
                    name=name,
                    role=role,
                    phone=phone,
                    email=email,
                    salary=salary,
                    status=status
                )
                db.add(db_staff)
                success_count += 1
                
            if email:
                user = db.query(User).filter(func.lower(User.email) == func.lower(email), User.is_deleted == False).first()
                if user:
                    db_staff.user_id = user.id
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Row import error: {str(e)}")
            
    crud.log_activity(db, current_user.id, "bulk_import", f"Imported Employees: created {success_count}, updated {updated_count}")
    return {"status": "success", "message": f"Created {success_count}, updated {updated_count} employees successfully."}


@app.get("/api/categories", response_model=List[schemas.CategoryResponse])
def read_categories(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_categories(db)

@app.post("/api/categories", response_model=schemas.CategoryResponse)
def create_category(cat_in: schemas.CategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_store_or_higher)):
    return crud.create_category(db=db, category=cat_in)


# --- SUPPLIERS ---
@app.get("/api/suppliers", response_model=List[schemas.SupplierResponse])
def read_suppliers(include_deleted: bool = False, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_suppliers(db, include_deleted)

@app.post("/api/suppliers", response_model=schemas.SupplierResponse)
def create_supplier(sup_in: schemas.SupplierCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_store_or_higher)):
    return crud.create_supplier(db=db, supplier=sup_in, user_id=current_user.id)

@app.put("/api/suppliers/{supplier_id}", response_model=schemas.SupplierResponse)
def update_supplier(supplier_id: str, sup_in: schemas.SupplierUpdate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_store_or_higher)):
    db_sup = crud.update_supplier(db=db, supplier_id=supplier_id, supplier_in=sup_in, user_id=current_user.id)
    if not db_sup:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return db_sup

@app.delete("/api/suppliers/{supplier_id}")
def delete_supplier(supplier_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    try:
        success = crud.delete_supplier(db=db, supplier_id=supplier_id, user_id=current_user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Supplier not found")
        return {"status": "success", "message": "Supplier archived"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/suppliers/{supplier_id}/restore")
def restore_supplier(supplier_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    try:
        success = crud.restore_supplier(db=db, supplier_id=supplier_id, user_id=current_user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Supplier not found or active")
        return {"status": "success", "message": "Supplier restored"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- CLIENTS ---
@app.get("/api/clients", response_model=List[schemas.ClientResponse])
def read_clients(include_deleted: bool = False, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_clients(db, include_deleted)

@app.post("/api/clients", response_model=schemas.ClientResponse)
def create_client(client_in: schemas.ClientCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_manager_or_higher)):
    return crud.create_client(db=db, client=client_in, user_id=current_user.id)

@app.put("/api/clients/{client_id}", response_model=schemas.ClientResponse)
def update_client(client_id: str, client_in: schemas.ClientUpdate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_manager_or_higher)):
    db_client = crud.update_client(db=db, client_id=client_id, client_in=client_in, user_id=current_user.id)
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")
    return db_client

@app.delete("/api/clients/{client_id}")
def delete_client(client_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    try:
        success = crud.delete_client(db=db, client_id=client_id, user_id=current_user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Client not found")
        return {"status": "success", "message": "Client archived"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/clients/{client_id}/restore")
def restore_client(client_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    try:
        success = crud.restore_client(db=db, client_id=client_id, user_id=current_user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Client not found or active")
        return {"status": "success", "message": "Client restored"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- PROJECTS MODULE ---
@app.get("/api/projects", response_model=List[schemas.ProjectResponse])
def read_projects(include_deleted: bool = False, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_projects(db, include_deleted)

@app.post("/api/projects", response_model=schemas.ProjectResponse)
def create_project(project_in: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_manager_or_higher)):
    return crud.create_project(db=db, project=project_in, user_id=current_user.id)

@app.post("/api/projects/import")
async def import_projects_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.require_manager_or_higher)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    contents = await file.read()
    buffer = io.StringIO(contents.decode("utf-8-sig"))
    reader = csv.reader(buffer)
    try:
        headers = next(reader)
    except StopIteration:
        raise HTTPException(status_code=400, detail="CSV file is empty.")
    
    headers = [h.strip() for h in headers]
    required_cols = ["Project ID", "Project Name", "Client Name", "Start Date", "Expected End Date", "Status", "Remarks"]
    for req in required_cols:
        if req.lower() not in [h.lower() for h in headers]:
            raise HTTPException(status_code=400, detail=f"Required column '{req}' not found for Project import. Columns: {headers}")
    
    header_lower = [h.lower() for h in headers]
    idx_proj_id = header_lower.index("project id")
    idx_proj_name = header_lower.index("project name")
    idx_client_name = header_lower.index("client name")
    idx_start_date = header_lower.index("start date")
    idx_end_date = header_lower.index("expected end date")
    idx_status = header_lower.index("status")
    
    success_count = 0
    updated_count = 0
    
    for row in reader:
        if not row or all(cell.strip() == "" for cell in row):
            continue
        try:
            proj_id = row[idx_proj_id].strip()
            proj_name = row[idx_proj_name].strip()
            client_name = row[idx_client_name].strip()
            start_date_str = row[idx_start_date].strip()
            end_date_str = row[idx_end_date].strip()
            status_str = row[idx_status].strip().lower()
            
            if not proj_name:
                continue
            
            db_client = None
            if client_name:
                db_client = db.query(Client).filter(Client.name.ilike(client_name)).first()
                if not db_client:
                    db_client = Client(name=client_name)
                    db.add(db_client)
                    db.commit()
                    db.refresh(db_client)
            
            start_date = None
            if start_date_str:
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                    try:
                        start_date = datetime.strptime(start_date_str, fmt).date()
                        break
                    except ValueError:
                        continue
            
            end_date = None
            if end_date_str:
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                    try:
                        end_date = datetime.strptime(end_date_str, fmt).date()
                        break
                    except ValueError:
                        continue
            
            valid_statuses = ["planning", "active", "on_hold", "delayed", "completed"]
            if status_str not in valid_statuses:
                status_str = "planning"
                
            db_project = None
            if proj_id:
                db_project = db.query(Project).filter(Project.id == proj_id).first()
            if not db_project:
                db_project = db.query(Project).filter(Project.name.ilike(proj_name)).first()
                
            if db_project:
                db_project.name = proj_name
                db_project.client_id = db_client.id if db_client else None
                db_project.start_date = start_date
                db_project.end_date = end_date
                db_project.status = status_str
                if db_project.is_deleted:
                    db_project.is_deleted = False
                    db_project.deleted_at = None
                    db_project.deleted_by = None
                updated_count += 1
            else:
                new_proj_kwargs = {
                    "name": proj_name,
                    "client_id": db_client.id if db_client else None,
                    "start_date": start_date,
                    "end_date": end_date,
                    "status": status_str,
                }
                if proj_id and len(proj_id) == 36:
                    new_proj_kwargs["id"] = proj_id
                
                db_project = Project(**new_proj_kwargs)
                db.add(db_project)
                success_count += 1
                
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Row import error: {str(e)}")
            
    crud.log_activity(db, current_user.id, "bulk_import", f"Imported Projects: created {success_count}, updated {updated_count} projects")
    return {"status": "success", "message": f"Created {success_count}, updated {updated_count} projects successfully."}

@app.get("/api/projects/{project_id}", response_model=schemas.ProjectResponse)
def read_project(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    db_project = crud.get_project(db, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project

@app.put("/api/projects/{project_id}", response_model=schemas.ProjectResponse)
def update_project(project_id: str, project_in: schemas.ProjectUpdate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_manager_or_higher)):
    db_project = crud.update_project(db=db, project_id=project_id, project_in=project_in, user_id=current_user.id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    try:
        success = crud.delete_project(db=db, project_id=project_id, user_id=current_user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"status": "success", "message": "Project archived"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/projects/{project_id}/restore")
def restore_project(project_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    try:
        success = crud.restore_project(db=db, project_id=project_id, user_id=current_user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Project not found or active")
        return {"status": "success", "message": "Project restored"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/projects/{project_id}/bom", response_model=schemas.ProjectBOMResponse)
def add_bom_to_project(project_id: str, bom_in: schemas.ProjectBOMCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_manager_or_higher)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    item = crud.get_inventory_item(db, bom_in.inventory_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return crud.add_bom_item(db=db, project_id=project_id, bom_in=bom_in)


# --- MATERIAL REQUESTS ---
@app.get("/api/requests", response_model=List[schemas.MaterialRequestResponse])
def read_requests(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_material_requests(db)

@app.post("/api/requests", response_model=schemas.MaterialRequestResponse)
def create_request(req_in: schemas.MaterialRequestCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_manager_or_higher)):
    item = crud.get_inventory_item(db, req_in.inventory_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return crud.create_material_request(db=db, req=req_in, user_id=current_user.id)

@app.put("/api/requests/{request_id}/status", response_model=schemas.MaterialRequestResponse)
def update_request_status(
    request_id: str, 
    status: str = Query(..., description="approved, rejected, or issued"),
    db: Session = Depends(get_db), 
    current_user: User = Depends(auth.require_any_authenticated)
):
    if status in ["approved", "rejected"]:
        if current_user.role not in ["admin", "manager"]:
            raise HTTPException(status_code=403, detail="Only managers can approve/reject requests")
    elif status == "issued":
        if current_user.role not in ["admin", "store"]:
            raise HTTPException(status_code=403, detail="Only store keepers can issue materials")
    else:
        raise HTTPException(status_code=400, detail="Invalid status transition")
        
    try:
        updated_req = crud.update_material_request_status(db=db, request_id=request_id, status=status, user_id=current_user.id)
        if not updated_req:
            raise HTTPException(status_code=404, detail="Request not found")
        return updated_req
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- PURCHASING MODULE ---
@app.get("/api/purchasing", response_model=List[schemas.PurchaseOrderResponse])
def read_purchase_orders(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_purchase_orders(db)

@app.post("/api/purchasing", response_model=schemas.PurchaseOrderResponse)
def create_purchase_order(po_in: schemas.PurchaseOrderCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_accountant_or_higher)):
    supplier = db.query(Supplier).filter(Supplier.id == po_in.supplier_id, Supplier.is_deleted == False).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    item = crud.get_inventory_item(db, po_in.inventory_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return crud.create_purchase_order(db=db, po=po_in, user_id=current_user.id)

@app.put("/api/purchasing/{po_id}/status", response_model=schemas.PurchaseOrderResponse)
def update_purchase_order_status(
    po_id: str,
    status: str = Query(..., description="approved, ordered, delivered, received"),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.require_any_authenticated)
):
    if status == "received" and current_user.role not in ["admin", "store"]:
        raise HTTPException(status_code=403, detail="Only store keepers can log goods as received")
    elif status in ["approved", "ordered", "delivered"] and current_user.role not in ["admin", "accountant"]:
        raise HTTPException(status_code=403, detail="Only accountants or admins can adjust purchase statuses")
        
    try:
        updated_po = crud.update_purchase_order_status(db=db, po_id=po_id, status=status, user_id=current_user.id)
        if not updated_po:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        return updated_po
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- STAFF & ATTENDANCE ---
@app.get("/api/staff", response_model=List[schemas.StaffResponse])
def read_staff(include_deleted: bool = False, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_staff(db, include_deleted)

@app.post("/api/staff", response_model=schemas.StaffResponse)
def create_staff_member(staff_in: schemas.StaffCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    return crud.create_staff(db=db, staff=staff_in, user_id=current_user.id)

@app.put("/api/staff/{staff_id}", response_model=schemas.StaffResponse)
def update_staff(staff_id: str, staff_in: schemas.StaffUpdate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    db_staff = crud.update_staff(db=db, staff_id=staff_id, staff_in=staff_in, user_id=current_user.id)
    if not db_staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    return db_staff

@app.delete("/api/staff/{staff_id}")
def delete_staff(staff_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    success = crud.delete_staff(db=db, staff_id=staff_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Staff not found")
    return {"status": "success", "message": "Staff archived"}

@app.post("/api/staff/{staff_id}/restore")
def restore_staff(staff_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    try:
        success = crud.restore_staff(db=db, staff_id=staff_id, user_id=current_user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Staff not found or active")
        return {"status": "success", "message": "Staff restored"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/attendance", response_model=List[schemas.AttendanceResponse])
def read_attendance(target_date: Optional[date] = Query(None), db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_attendance(db, target_date)

@app.post("/api/attendance", response_model=schemas.AttendanceResponse)
def log_staff_attendance(att_in: schemas.AttendanceCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_manager_or_higher)):
    staff = db.query(Staff).filter(Staff.id == att_in.staff_id, Staff.is_deleted == False).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return crud.log_attendance(db=db, att=att_in)


# --- NOTIFICATION MODULE ---
@app.get("/api/notifications", response_model=List[schemas.NotificationResponse])
def read_notifications(unread_only: bool = False, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_notifications(db, unread_only)

@app.put("/api/notifications/{notification_id}/read", response_model=schemas.NotificationResponse)
def read_notification(notification_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    notif = crud.mark_notification_as_read(db, notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notif


# --- DYNAMIC CUSTOM FIELD CONFIGURATION ROUTER ---

@app.get("/api/custom-fields/{entity_type}", response_model=List[schemas.CustomFieldDefinitionResponse])
def get_custom_fields(entity_type: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_custom_field_definitions(db, entity_type)

@app.post("/api/custom-fields", response_model=schemas.CustomFieldDefinitionResponse)
def define_custom_field(definition: schemas.CustomFieldDefinitionCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    return crud.create_custom_field_definition(db, definition)

@app.delete("/api/custom-fields/{field_id}")
def delete_custom_field(field_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    success = crud.delete_custom_field_definition(db, field_id)
    if not success:
         raise HTTPException(status_code=404, detail="Field definition not found")
    return {"status": "success", "message": "Custom field deleted"}

@app.get("/api/custom-fields/values/{entity_id}", response_model=List[schemas.CustomFieldValueResponse])
def get_entity_field_values(entity_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_custom_field_values(db, entity_id)

@app.post("/api/custom-fields/values", response_model=schemas.CustomFieldValueResponse)
def save_field_value(value_in: schemas.CustomFieldValueCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.save_custom_field_value(db, value_in)


# --- DYNAMIC WORKFLOW & APPROVAL MATRICES ROUTER ---

@app.get("/api/workflows", response_model=List[schemas.WorkflowDefinitionResponse])
def list_workflows(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_workflow_definitions(db)

@app.post("/api/workflows", response_model=schemas.WorkflowDefinitionResponse)
def create_workflow(wf_in: schemas.WorkflowDefinitionCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    return crud.create_workflow_definition(db, wf_in)

@app.get("/api/approval-rules", response_model=List[schemas.ApprovalRuleResponse])
def get_approval_rules(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_approval_rules(db)

@app.post("/api/approval-rules", response_model=schemas.ApprovalRuleResponse)
def create_approval_rule(rule_in: schemas.ApprovalRuleCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    return crud.create_approval_rule(db, rule_in)


# --- WIDGETS ENGINE ---

@app.get("/api/dashboard/widgets", response_model=List[schemas.DashboardWidgetResponse])
def get_my_widgets(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    widgets = crud.get_dashboard_widgets(db, current_user.id)
    if not widgets:
        # Seed default widgets list for first time login
        defaults = [
            {"title": "Warehouse Asset Valuation", "widget_type": "kpi_stock", "layout_x": 0, "layout_y": 0, "layout_w": 4, "layout_h": 2},
            {"title": "Active Production Projects", "widget_type": "kpi_projects", "layout_x": 4, "layout_y": 0, "layout_w": 4, "layout_h": 2},
            {"title": "Open Purchase Orders", "widget_type": "kpi_po", "layout_x": 8, "layout_y": 0, "layout_w": 4, "layout_h": 2},
            {"title": "Weekly Stock Movements", "widget_type": "chart_movement", "layout_x": 0, "layout_y": 2, "layout_w": 6, "layout_h": 4},
            {"title": "Monthly Purchasing Valuation", "widget_type": "chart_purchases", "layout_x": 6, "layout_y": 2, "layout_w": 6, "layout_h": 4}
        ]
        res = []
        for widget in defaults:
            w_in = schemas.DashboardWidgetCreate(**widget)
            res.append(crud.save_dashboard_widget(db, current_user.id, w_in))
        return res
    return widgets

@app.post("/api/dashboard/widgets", response_model=schemas.DashboardWidgetResponse)
def save_widget_layout(widget_in: schemas.DashboardWidgetCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.save_dashboard_widget(db, current_user.id, widget_in)

@app.delete("/api/dashboard/widgets/{widget_id}")
def remove_widget(widget_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    success = crud.delete_dashboard_widget(db, widget_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Widget not found")
    return {"status": "success", "message": "Widget removed"}


# --- TASKS MODULE ---

@app.get("/api/tasks", response_model=List[schemas.TaskResponse])
def get_tasks(include_deleted: bool = False, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_tasks(db, include_deleted)

@app.post("/api/tasks", response_model=schemas.TaskResponse)
def create_task(task_in: schemas.TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.create_task(db, task_in)

@app.put("/api/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_task(task_id: str, task_in: schemas.TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    db_task = crud.update_task(db, task_id, task_in)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    success = crud.delete_task(db, task_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "success", "message": "Task deleted"}


# --- DOCUMENT MANAGEMENT ---

@app.get("/api/documents", response_model=List[schemas.DocumentResponse])
def get_documents(entity_type: Optional[str] = None, entity_id: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_documents(db, entity_type, entity_id)

@app.post("/api/documents", response_model=schemas.DocumentResponse)
async def upload_document(
    name: str = Query(...),
    category: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.require_any_authenticated)
):
    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{uuid.uuid4()}{file_ext}"
    dest_path = os.path.join(UPLOAD_DIR, safe_filename)
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    doc_in = schemas.DocumentCreate(
        name=name,
        file_path=f"/uploads/{safe_filename}",
        category=category,
        entity_type=entity_type,
        entity_id=entity_id
    )
    return crud.create_document(db, doc_in, current_user.id)

@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    success = crud.delete_document(db, doc_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "success", "message": "Document deleted"}


# --- HISTORICAL VERSION HISTORY ---

@app.get("/api/versions/{entity_type}/{entity_id}", response_model=List[schemas.VersionHistoryResponse])
def get_versions(entity_type: str, entity_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    return crud.get_version_histories(db, entity_type, entity_id)


# --- REAL-TIME EXEC DASHBOARD ---
@app.get("/api/dashboard/overview", response_model=schemas.DashboardOverview)
def get_dashboard_overview(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    items = db.query(InventoryItem).filter(InventoryItem.is_deleted == False).all()
    total_val = sum(i.quantity * i.unit_cost for i in items)
    total_items = len(items)
    low_stock = sum(1 for i in items if 0 < i.quantity <= i.minimum_stock_level)
    out_of_stock = sum(1 for i in items if i.quantity == 0)
    
    projects = db.query(Project).filter(Project.is_deleted == False).all()
    active_proj = sum(1 for p in projects if p.status == "active")
    completed_proj = sum(1 for p in projects if p.status == "completed")
    delayed_proj = sum(1 for p in projects if p.status == "delayed")
    
    pos = db.query(PurchaseOrder).filter(PurchaseOrder.is_deleted == False).all()
    open_pos = sum(1 for po in pos if po.status in ["pending", "approved", "ordered"])
    pending_deliveries = sum(1 for po in pos if po.status == "delivered")
    
    # Staff Presence Today
    today = date.today()
    attendance_today = db.query(Attendance).join(Staff).filter(
        Attendance.date == today,
        Staff.is_deleted == False
    ).all()
    present_employees = sum(1 for a in attendance_today if a.status == "present")
    absent_employees = sum(1 for a in attendance_today if a.status == "absent")

    
    return {
        "inventory_total_value": total_val,
        "inventory_total_items": total_items,
        "low_stock_items_count": low_stock,
        "out_of_stock_items_count": out_of_stock,
        "today_received_stock": 0.0,
        "today_consumed_stock": 0.0,
        "active_projects_count": active_proj,
        "completed_projects_count": completed_proj,
        "delayed_projects_count": delayed_proj,
        "projects_shortage_count": 0,
        "open_pos_count": open_pos,
        "pending_deliveries_count": pending_deliveries,
        "present_employees_count": present_employees,
        "absent_employees_count": absent_employees
    }

@app.get("/api/dashboard/charts")
def get_dashboard_charts(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    # Weekly stock changes (last 7 days)
    weekly_movement = []
    for i in range(6, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        weekly_movement.append({
            "name": day.strftime("%a"),
            "received": 0.0,
            "issued": 0.0
        })
        
    # Categories allocation
    categories = db.query(Category).filter(Category.is_deleted == False).all()
    cat_distribution = []
    for cat in categories:
        count = db.query(InventoryItem).filter(
            InventoryItem.category_id == cat.id,
            InventoryItem.is_deleted == False
        ).count()
        if count > 0:
            cat_distribution.append({
                "name": cat.name,
                "value": count
            })
            
    # Monthly Purchases Cost trends
    monthly_purchase = []
    for i in range(5, -1, -1):
        target_month = datetime.utcnow() - timedelta(days=i*30)
        monthly_purchase.append({
            "name": target_month.strftime("%b"),
            "cost": 0.0
        })
        
    # Suppliers evaluations scorecards
    suppliers = db.query(Supplier).filter(Supplier.is_deleted == False).all()
    supplier_stats = []
    for sup in suppliers:
        pos_count = db.query(PurchaseOrder).filter(
            PurchaseOrder.supplier_id == sup.id,
            PurchaseOrder.is_deleted == False
        ).count()
        supplier_stats.append({
            "name": sup.name,
            "orders": pos_count,
            "performance": 95 if pos_count > 0 else 100
        })
        
    return {
        "weeklyStockMovement": weekly_movement,
        "categoryDistribution": cat_distribution,
        "monthlyPurchaseCost": monthly_purchase,
        "supplierPerformance": supplier_stats
    }


# --- BARCODE PDF GENERATOR ---
@app.get("/api/inventory/{item_id}/barcode/pdf")
def get_barcode_pdf(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    item = crud.get_inventory_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=(216, 144), rightMargin=10, leftMargin=10, topMargin=10, bottomMargin=10)
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'LabelTitle', parent=styles['Heading3'], fontSize=10, leading=12, alignment=1
    )
    sku_style = ParagraphStyle(
        'LabelSKU', parent=styles['Normal'], fontSize=8, leading=10, alignment=1, fontName='Helvetica-Bold'
    )
    
    story.append(Paragraph(item.name[:35], title_style))
    story.append(Spacer(1, 5))
    story.append(Paragraph(f"SKU: {item.sku}", sku_style))
    story.append(Spacer(1, 10))
    
    try:
        barcode_svg = Code128(item.barcode, barHeight=35, barWidth=1.2)
        t = Table([[barcode_svg]], colWidths=[196])
        t.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(t)
    except Exception as e:
        story.append(Paragraph(f"Barcode: {item.barcode}", sku_style))
        
    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=barcode_{item.sku}.pdf"}
    )


# --- REPORTING ENGINE (PDF / EXCEL / CSV) ---
@app.get("/api/reports/inventory/csv")
def download_inventory_report_csv(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    items = db.query(InventoryItem).filter(InventoryItem.is_deleted == False).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Material Code/SKU", "Material Name", "Category", "Brand", "Unit", "Quantity", "Minimum Level", "Unit Cost ($)", "Total Value ($)", "Last Updated"])
    for item in items:
        cat_name = item.category.name if item.category else "Uncategorized"
        writer.writerow([
            item.sku, item.name, cat_name, item.brand or "-", 
            item.unit, item.quantity, item.minimum_stock_level, 
            item.unit_cost, item.quantity * item.unit_cost,
            item.updated_at.strftime("%Y-%m-%d %H:%M")
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=allure_inventory_report.csv"}
    )

@app.get("/api/reports/inventory/excel")
def download_inventory_report_excel(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    items = db.query(InventoryItem).filter(InventoryItem.is_deleted == False).all()
    wb = Workbook()
    ws = wb.active
    ws.title = "Inventory Valuation"
    ws.views.sheetView[0].showGridLines = True
    
    ws.append(["Material Code/SKU", "Material Name", "Category", "Brand", "Unit", "Quantity", "Minimum Level", "Unit Cost ($)", "Total Value ($)", "Last Updated"])
    
    header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    for col in range(1, 11):
        cell = ws.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        
    row_num = 2
    for item in items:
        cat_name = item.category.name if item.category else "Uncategorized"
        ws.append([
            item.sku, item.name, cat_name, item.brand or "-",
            item.unit, item.quantity, item.minimum_stock_level,
            item.unit_cost, item.quantity * item.unit_cost,
            item.updated_at.strftime("%Y-%m-%d %H:%M")
        ])
        for col in range(1, 11):
            cell = ws.cell(row=row_num, column=col)
            cell.font = Font(name="Segoe UI", size=10)
            if col in [6, 7, 8, 9]:
                cell.number_format = '#,##0.00'
                cell.alignment = Alignment(horizontal="right")
            elif col in [1, 3, 5, 10]:
                cell.alignment = Alignment(horizontal="center")
        row_num += 1
        
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = col[0].column_letter
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)
        
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=allure_inventory_report.xlsx"}
    )

@app.get("/api/reports/inventory/pdf")
def download_inventory_report_pdf(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    items = db.query(InventoryItem).filter(InventoryItem.is_deleted == False).all()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Heading1'], fontSize=18, leading=22, alignment=1, textColor=colors.HexColor('#4f46e5')
    )
    story.append(Paragraph("Allure Living ERP - Inventory & Valuation Report", title_style))
    story.append(Spacer(1, 15))
    
    data = [["SKU", "Material Name", "Category", "Qty", "Unit", "Unit Cost", "Total Value"]]
    for item in items:
        cat_name = item.category.name if item.category else "N/A"
        data.append([
            item.sku, 
            item.name[:25], 
            cat_name, 
            str(item.quantity), 
            item.unit, 
            f"${item.unit_cost:.2f}", 
            f"${(item.quantity * item.unit_cost):.2f}"
        ])
        
    table = Table(data, colWidths=[70, 150, 80, 50, 40, 60, 70])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#4f46e5')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 10),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 8),
        ('ALIGN', (1,1), (1,-1), 'LEFT'),
    ]))
    
    story.append(table)
    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=allure_inventory_report.pdf"}
    )

@app.get("/api/reports/projects/csv")
def download_projects_report_csv(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    projects = db.query(Project).filter(Project.is_deleted == False).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Project Name", "Client", "Site Location", "Status", "Start Date", "End Date", "Budget ($)", "BOM Items Count"])
    for p in projects:
        client_name = p.client.name if p.client else "N/A"
        writer.writerow([
            p.name, client_name, p.site_location or "-", p.status, 
            p.start_date.strftime("%Y-%m-%d") if p.start_date else "-", 
            p.end_date.strftime("%Y-%m-%d") if p.end_date else "-", 
            p.budget, len(p.bom_items)
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=projects_report.csv"}
    )

@app.get("/api/reports/purchasing/csv")
def download_purchasing_report_csv(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    pos = db.query(PurchaseOrder).filter(PurchaseOrder.is_deleted == False).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["PO Number", "Supplier", "Material Ordered", "Quantity", "Unit Cost ($)", "Total Cost ($)", "Status", "Created At"])
    for po in pos:
        supplier_name = po.supplier.name if po.supplier else "N/A"
        item_name = po.inventory.name if po.inventory else "N/A"
        writer.writerow([
            po.po_number, supplier_name, item_name, po.quantity,
            po.unit_cost, po.total_cost, po.status,
            po.created_at.strftime("%Y-%m-%d %H:%M")
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=purchasing_report.csv"}
    )


# --- BACKUP & RESTORE SYSTEM ---
@app.post("/api/settings/backup")
def create_database_backup(db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    if not settings.DATABASE_URL.startswith("sqlite"):
        raise HTTPException(status_code=400, detail="Backups are only simulated/supported for SQLite in this local workspace.")
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    if not os.path.exists(db_path):
         raise HTTPException(status_code=404, detail="Database file not found to backup.")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file_name = f"backup_{timestamp}.db"
    dest_path = os.path.join(BACKUP_DIR, backup_file_name)
    try:
        shutil.copy2(db_path, dest_path)
        crud.log_activity(db, current_user.id, "database_backup", f"Created database backup: {backup_file_name}")
        return {"status": "success", "filename": backup_file_name, "message": "Backup created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to copy database: {str(e)}")

@app.get("/api/settings/backups")
def list_backups(current_user: User = Depends(auth.require_admin)):
    backups = []
    if not os.path.exists(BACKUP_DIR):
        return backups
    for file in os.listdir(BACKUP_DIR):
        if file.endswith(".db"):
            full_path = os.path.join(BACKUP_DIR, file)
            size = os.path.getsize(full_path)
            created = datetime.fromtimestamp(os.path.getctime(full_path))
            backups.append({
                "filename": file,
                "size_bytes": size,
                "created_at": created.strftime("%Y-%m-%d %H:%M:%S")
            })
    return sorted(backups, key=lambda x: x["created_at"], reverse=True)

@app.post("/api/settings/restore/{filename}")
def restore_database_backup(filename: str, current_user: User = Depends(auth.require_admin)):
    if not settings.DATABASE_URL.startswith("sqlite"):
        raise HTTPException(status_code=400, detail="Restores are only supported for SQLite in this local workspace.")
    backup_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Backup file not found.")
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    try:
        engine.dispose()
        shutil.copy2(backup_path, db_path)
        return {"status": "success", "message": "Database restored successfully. Please reload pages."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")

# Activity Logs
@app.get("/api/settings/logs", response_model=List[schemas.ActivityLogResponse])
def read_activity_logs(db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    return crud.get_activity_logs(db)


# --- LOGIN HISTORY & ACTIVE USER MONITORING ---
@app.get("/api/settings/login-history")
def get_login_history(limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(auth.require_admin)):
    """Return last N login activity logs."""
    logs = db.query(ActivityLog).filter(
        ActivityLog.action == "login"
    ).order_by(ActivityLog.created_at.desc()).limit(limit).all()
    
    result = []
    for log in logs:
        user = db.query(User).filter(User.id == log.user_id).first() if log.user_id else None
        result.append({
            "id": log.id,
            "user_email": user.email if user else "Unknown",
            "user_name": user.full_name if user else "Unknown",
            "user_role": user.role if user else "unknown",
            "action": log.action,
            "details": log.details,
            "timestamp": log.created_at.isoformat() if log.created_at else None
        })
    return result


# --- PROJECT REPORTS (PDF + EXCEL) ---
@app.get("/api/reports/projects/excel")
def download_projects_report_excel(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    projects = db.query(Project).filter(Project.is_deleted == False).all()
    wb = Workbook()
    ws = wb.active
    ws.title = "Projects Report"

    ws.append(["Project Name", "Client", "Site Location", "Status", "Start Date", "End Date", "Budget ($)", "BOM Items", "BOM Fulfilled"])

    header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    for col in range(1, 10):
        cell = ws.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    row_num = 2
    for p in projects:
        client_name = p.client.name if p.client else "N/A"
        total_bom = len(p.bom_items)
        fulfilled = sum(1 for b in p.bom_items if b.status == "fulfilled")
        ws.append([
            p.name, client_name, p.site_location or "-", p.status.replace("_", " ").title(),
            p.start_date.strftime("%Y-%m-%d") if p.start_date else "-",
            p.end_date.strftime("%Y-%m-%d") if p.end_date else "-",
            p.budget, total_bom, f"{fulfilled}/{total_bom}"
        ])
        for col in range(1, 10):
            cell = ws.cell(row=row_num, column=col)
            cell.font = Font(name="Segoe UI", size=10)
            if col == 7:
                cell.number_format = '#,##0.00'
                cell.alignment = Alignment(horizontal="right")
        row_num += 1

    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = max(max_len + 3, 12)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=allure_projects_report.xlsx"}
    )


@app.get("/api/reports/projects/pdf")
def download_projects_report_pdf(db: Session = Depends(get_db), current_user: User = Depends(auth.require_any_authenticated)):
    projects = db.query(Project).filter(Project.is_deleted == False).all()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    story = []

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Heading1'], fontSize=16, leading=20, alignment=1,
        textColor=colors.HexColor('#4f46e5')
    )
    story.append(Paragraph("Allure Living ERP - Projects & Budget Report", title_style))
    story.append(Spacer(1, 12))

    data = [["Project Name", "Client", "Status", "Start Date", "End Date", "Budget ($)", "BOM"]]
    for p in projects:
        client_name = p.client.name if p.client else "N/A"
        total_bom = len(p.bom_items)
        fulfilled = sum(1 for b in p.bom_items if b.status == "fulfilled")
        data.append([
            p.name[:28],
            client_name[:18],
            p.status.replace("_", " ").title(),
            p.start_date.strftime("%Y-%m-%d") if p.start_date else "-",
            p.end_date.strftime("%Y-%m-%d") if p.end_date else "-",
            f"${p.budget:,.0f}",
            f"{fulfilled}/{total_bom}"
        ])

    table = Table(data, colWidths=[130, 100, 65, 65, 65, 65, 40])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4f46e5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 7),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 1), (1, -1), 'LEFT'),
    ]))
    story.append(table)
    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=allure_projects_report.pdf"}
    )
