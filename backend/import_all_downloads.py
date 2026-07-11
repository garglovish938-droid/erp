import os
import csv
import re
import random
from datetime import datetime, UTC
from database import SessionLocal
from models import InventoryItem, Category
from crud import update_inventory_reserved_and_available

# Configuration
DOWNLOADS_DIR = r"C:\Users\ASUS\Downloads"
db = SessionLocal()

header_mapping = {
    "sku": ["sku", "sku code", "item code", "material code", "material code/sku", "code", "item sku"],
    "name": ["name", "material name", "item name", "product name", "description"],
    "barcode": ["barcode", "barcode value"],
    "quantity": ["quantity", "qty", "stock", "stock quantity", "in stock", "current stock", "current_stock", "opening stock"],
    "unit": ["unit type", "unit", "unit of measure", "uom"],
    "minimum_stock_level": ["alert level", "minimum stock", "minimum_stock_level", "min stock", "minimum level", "min stock level"],
    "unit_cost": ["unit cost", "rate", "price", "material cost", "unit_cost", "cost", "unit cost ($)"],
    "brand": ["brand name", "brand", "make", "manufacturer"],
    "size_variant": ["size", "size / dimension variant", "size_variant", "dimension", "variant"],
    "category": ["category", "categories", "material category", "group"]
}

def clean_header(val: str) -> str:
    return re.sub(r'[^a-z0-9]', '', val.lower())

def run_bulk_import():
    # Find matching CSV files in Downloads
    csv_files = []
    for f in os.listdir(DOWNLOADS_DIR):
        if f.lower().endswith(".csv") and ("inventory" in f.lower() or "hfele" in f.lower() or "hettich" in f.lower() or "ebco" in f.lower()):
            csv_files.append(os.path.join(DOWNLOADS_DIR, f))
            
    if not csv_files:
        print(f"No matching inventory CSV files found in {DOWNLOADS_DIR}.")
        return
        
    print(f"Found {len(csv_files)} inventory CSV files to import:")
    for path in csv_files:
        print(f" - {os.path.basename(path)}")
        
    # Pre-fetch all existing SKUs, Barcodes and Names from database to do fast validation
    existing_skus = {} # SKU -> Item ID
    existing_barcodes = {} # Barcode -> Item ID
    existing_names = {} # Name.lower().strip() -> Item ID
    
    for item_id, sku, barcode, name in db.query(InventoryItem.id, InventoryItem.sku, InventoryItem.barcode, InventoryItem.name).all():
        if sku:
            existing_skus[sku.lower()] = item_id
        if barcode:
            existing_barcodes[barcode.lower()] = item_id
        if name:
            existing_names[name.lower().strip()] = item_id
            
    allocated_skus = set()
    allocated_barcodes = set()
    allocated_names = set()
    category_cache = {}
    
    def get_next_barcode(allocated: set) -> str:
        max_num = 100000
        for bc in existing_barcodes:
            if bc.startswith("bc") and bc[2:].isdigit():
                try:
                    num = int(bc[2:])
                    if num > max_num:
                        max_num = num
                except ValueError:
                    pass
        for bc in allocated:
            if bc.startswith("bc") and bc[2:].isdigit():
                try:
                    num = int(bc[2:])
                    if num > max_num:
                        max_num = num
                except ValueError:
                    pass
        next_num = max_num + 1
        while f"bc{next_num}" in existing_barcodes or f"bc{next_num}" in allocated:
            next_num += 1
        generated = f"BC{next_num}"
        allocated.add(generated.lower())
        return generated

    for csv_path in csv_files:
        filename = os.path.basename(csv_path)
        print(f"\n========================================\nProcessing: {filename}\n========================================")
        try:
            with open(csv_path, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f)
                try:
                    headers = [h.strip() for h in next(reader)]
                except StopIteration:
                    print(f"Skipping {filename}: Empty file.")
                    continue
                
                # Build col_indices
                col_indices = {}
                for field, synonyms in header_mapping.items():
                    clean_syns = [clean_header(s) for s in synonyms]
                    for idx, h in enumerate(headers):
                        if clean_header(h) in clean_syns:
                            col_indices[field] = idx
                            break
                            
                if "name" not in col_indices:
                    print(f"Skipping {filename}: Required column 'Name' or valid synonym not found.")
                    continue
                    
                success_count = 0
                updated_count = 0
                skipped_count = 0
                row_num = 1
                
                for row in reader:
                    row_num += 1
                    if not row or all(cell.strip() == "" for cell in row):
                        continue
                        
                    sku = ""
                    try:
                        def get_val(field, default=""):
                            idx = col_indices.get(field)
                            if idx is not None and idx < len(row):
                                return row[idx].strip()
                            return default
                            
                        sku = get_val("sku")
                        name = get_val("name")
                        
                        if not name:
                            skipped_count += 1
                            continue
                            
                        # Generate SKU if blank
                        if not sku:
                            clean_name = re.sub(r'[^a-zA-Z0-9]', '', name)[:6].upper()
                            if not clean_name:
                                clean_name = "MAT"
                            sku = f"{clean_name}-GEN-{random.randint(10000, 99999)}"
                            while sku.lower() in existing_skus or sku.lower() in allocated_skus:
                                sku = f"{clean_name}-GEN-{random.randint(10000, 99999)}"
                                
                        quantity_str = get_val("quantity", "0")
                        try:
                            quantity = float(quantity_str) if quantity_str else 0.0
                            if quantity < 0:
                                quantity = 0.0
                        except ValueError:
                            quantity = 0.0
                            
                        min_stock_str = get_val("minimum_stock_level", "5")
                        try:
                            min_stock = float(min_stock_str) if min_stock_str else 5.0
                            if min_stock < 0:
                                min_stock = 5.0
                        except ValueError:
                            min_stock = 5.0
                            
                        unit_cost_str = get_val("unit_cost", "0")
                        try:
                            unit_cost = float(unit_cost_str) if unit_cost_str else 0.0
                            if unit_cost < 0:
                                unit_cost = 0.0
                        except ValueError:
                            unit_cost = 0.0
                            
                        cat_name = get_val("category", "Uncategorized")
                        brand = get_val("brand")
                        unit = get_val("unit", "Pcs")
                        size_variant = get_val("size_variant")
                        
                        # Process Database Write/Update
                        with db.begin_nested():
                            cat_key = cat_name.lower().strip()
                            if cat_key in category_cache:
                                db_cat = category_cache[cat_key]
                            else:
                                db_cat = db.query(Category).filter(Category.name.ilike(cat_name)).first()
                                if not db_cat:
                                    db_cat = Category(name=cat_name, description="Auto created from CSV import")
                                    db.add(db_cat)
                                    db.flush()
                                category_cache[cat_key] = db_cat
                                
                            db_item = None
                            sku_lower = sku.lower()
                            barcode = get_val("barcode")
                            barcode_lower = barcode.lower() if barcode else None
                            name_key = name.lower().strip()
                            
                            # Match duplicate SKU
                            if sku_lower in existing_skus:
                                db_item = db.query(InventoryItem).filter(InventoryItem.id == existing_skus[sku_lower]).first()
                            elif sku_lower in allocated_skus:
                                db_item = db.query(InventoryItem).filter(InventoryItem.sku.ilike(sku)).first()
                                
                            # Match duplicate Barcode
                            if not db_item and barcode_lower:
                                if barcode_lower in existing_barcodes:
                                    db_item = db.query(InventoryItem).filter(InventoryItem.id == existing_barcodes[barcode_lower]).first()
                                elif barcode_lower in allocated_barcodes:
                                    db_item = db.query(InventoryItem).filter(InventoryItem.barcode.ilike(barcode)).first()
                                    
                            # Match duplicate Name
                            if not db_item:
                                if name_key in existing_names:
                                    db_item = db.query(InventoryItem).filter(InventoryItem.id == existing_names[name_key]).first()
                                elif name_key in allocated_names:
                                    db_item = db.query(InventoryItem).filter(InventoryItem.name.ilike(name)).first()
                                    
                            if not db_item:
                                if not barcode:
                                    barcode = get_next_barcode(allocated_barcodes)
                                else:
                                    if barcode_lower in allocated_barcodes or barcode_lower in existing_barcodes:
                                        barcode = get_next_barcode(allocated_barcodes)
                                    else:
                                        allocated_barcodes.add(barcode_lower)
                                        
                            if db_item:
                                db_item.name = name
                                db_item.category_id = db_cat.id
                                if brand:
                                    db_item.brand = brand
                                db_item.unit = unit
                                if size_variant:
                                    db_item.size_variant = size_variant
                                    
                                db_item.quantity += quantity
                                db_item.available_quantity = db_item.quantity - (db_item.reserved_quantity or 0.0)
                                if min_stock > 0:
                                    db_item.minimum_stock_level = min_stock
                                if unit_cost > 0:
                                    db_item.unit_cost = unit_cost
                                db_item.updated_at = datetime.now(UTC)
                                
                                if db_item.is_deleted:
                                    db_item.is_deleted = False
                                    db_item.deleted_at = None
                                    db_item.deleted_by = None
                                    
                                db.flush()
                                existing_skus[sku_lower] = db_item.id
                                allocated_skus.add(sku_lower)
                                existing_names[name_key] = db_item.id
                                allocated_names.add(name_key)
                                
                                updated_count += 1
                            else:
                                new_item = InventoryItem(
                                    sku=sku,
                                    name=name,
                                    category_id=db_cat.id,
                                    brand=brand,
                                    unit=unit,
                                    size_variant=size_variant,
                                    quantity=quantity,
                                    minimum_stock_level=min_stock,
                                    unit_cost=unit_cost,
                                    barcode=barcode,
                                    available_quantity=quantity,
                                    reserved_quantity=0.0
                                )
                                db.add(new_item)
                                db.flush()
                                
                                existing_skus[sku_lower] = new_item.id
                                allocated_skus.add(sku_lower)
                                existing_names[name_key] = new_item.id
                                allocated_names.add(name_key)
                                existing_barcodes[barcode.lower()] = new_item.id
                                allocated_barcodes.add(barcode.lower())
                                
                                success_count += 1
                                
                        if db_item:
                            update_inventory_reserved_and_available(db, db_item.id)
                        else:
                            update_inventory_reserved_and_available(db, new_item.id)
                            
                    except Exception as row_err:
                        print(f"Row {row_num} error: {row_err}")
                        skipped_count += 1
                        
                db.commit()
                print(f"Finished {filename}: Created={success_count}, Updated={updated_count}, Skipped={skipped_count}")
                
        except Exception as file_err:
            print(f"Failed to read file {filename}: {file_err}")

    db.close()
    print("\nBulk import completed successfully!")

if __name__ == "__main__":
    run_bulk_import()
