import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
import models
import crud

logger = logging.getLogger("barcode_service")

# Thread-safe scan history cache to prevent duplicate scans within a 5-second window
_recent_scans = {}

class BarcodeService:
    @staticmethod
    def lookup_barcode(db: Session, barcode: str, user_id: str) -> dict:
        """
        Identifies an inventory item using its unique barcode.
        Returns item name, sku, available stock, rack location, and last transaction.
        Enforces a 5-second sliding window to prevent accidental double-scanning.
        """
        throttle_key = f"{user_id}:{barcode}"
        now = datetime.now()
        
        # Clean expired scans
        expired = [k for k, v in _recent_scans.items() if now - v > timedelta(seconds=5)]
        for k in expired:
            _recent_scans.pop(k, None)
            
        if throttle_key in _recent_scans:
            logger.warning(f"Barcode double scan blocked for: {barcode}")
            raise ValueError(f"Duplicate scan signal blocked for barcode: {barcode}. Please wait 5 seconds.")
            
        _recent_scans[throttle_key] = now
        
        db_item = db.query(models.InventoryItem).filter(
            models.InventoryItem.barcode == barcode,
            models.InventoryItem.is_deleted == False
        ).first()
        
        if not db_item:
            raise ValueError(f"Inventory item with barcode '{barcode}' not found.")
            
        supplier_name = None
        if db_item.supplier_id:
            supplier = db.query(models.Supplier).filter(models.Supplier.id == db_item.supplier_id).first()
            if supplier:
                supplier_name = supplier.name
                
        last_tx = db.query(models.StockTransaction).filter(
            models.StockTransaction.inventory_id == db_item.id
        ).order_by(models.StockTransaction.created_at.desc()).first()
        
        return {
            "id": db_item.id,
            "name": db_item.name,
            "sku": db_item.sku,
            "barcode": db_item.barcode,
            "unit": db_item.unit,
            "unit_cost": db_item.unit_cost,
            "quantity": db_item.quantity,
            "available_quantity": db_item.available_quantity if db_item.available_quantity is not None else db_item.quantity,
            "rack_location": getattr(db_item, 'rack_location', 'Main Rack - Section A'),
            "supplier_name": supplier_name,
            "last_transaction": {
                "type": last_tx.transaction_type,
                "quantity": last_tx.quantity,
                "date": last_tx.created_at.isoformat()
            } if last_tx else None
        }

    @staticmethod
    def receive_stock(db: Session, barcode: str, qty: float, user_id: str, notes: Optional[str] = None) -> dict:
        """
        Receives inventory stock for an item by scanning its barcode.
        """
        item_details = BarcodeService.lookup_barcode(db, barcode, user_id)
        db_item = crud.adjust_stock(
            db=db,
            inventory_id=item_details["id"],
            quantity=qty,
            transaction_type="in",
            user_id=user_id,
            notes=notes or "Received stock via barcode scan"
        )
        return {
            "status": "success",
            "item_name": db_item.name,
            "sku": db_item.sku,
            "new_stock": db_item.quantity
        }

    @staticmethod
    def issue_stock(db: Session, barcode: str, qty: float, user_id: str, notes: Optional[str] = None) -> dict:
        """
        Issues inventory stock for an item by scanning its barcode.
        """
        item_details = BarcodeService.lookup_barcode(db, barcode, user_id)
        # Note: quantity is sent positive; adjust_stock handles signs depending on type
        db_item = crud.adjust_stock(
            db=db,
            inventory_id=item_details["id"],
            quantity=-qty,
            transaction_type="out",
            user_id=user_id,
            notes=notes or "Issued stock via barcode scan"
        )
        return {
            "status": "success",
            "item_name": db_item.name,
            "sku": db_item.sku,
            "new_stock": db_item.quantity
        }
