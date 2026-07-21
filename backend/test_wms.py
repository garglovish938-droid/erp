import os
import sys
import unittest
from datetime import date, datetime

# Append current directory to import path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_dir)

os.environ["DATABASE_URL"] = "sqlite:///C:/Users/ASUS/.gemini/antigravity-ide/scratch/erp_demo/backend/test_barcode_scan.db"

from database import SessionLocal, Base, engine
import crud, schemas, auth
from models import User, InventoryItem, Project, ProjectBOM, PurchaseOrder, Supplier, BarcodeTransaction, StockAudit, StockAuditItem, WarehouseLocation, BatchMaster, SerialMaster

class TestWMS(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # Drop all tables first to handle schema upgrades/drift in tests
        Base.metadata.drop_all(bind=engine)
        # Initialize test tables on the engine
        Base.metadata.create_all(bind=engine)
        
    def setUp(self):
        self.db = SessionLocal()
        # Clean tables
        self.db.query(BarcodeTransaction).delete()
        self.db.query(SerialMaster).delete()
        self.db.query(BatchMaster).delete()
        self.db.query(WarehouseLocation).delete()
        self.db.query(StockAuditItem).delete()
        self.db.query(StockAudit).delete()
        self.db.query(ProjectBOM).delete()
        self.db.query(Project).delete()
        self.db.query(PurchaseOrder).delete()
        self.db.query(InventoryItem).delete()
        self.db.query(Supplier).delete()
        self.db.query(User).delete()
        self.db.commit()
        
        # Setup helper data
        self.password = "testpass123"
        self.hash = auth.get_password_hash(self.password)
        
        self.store = User(email="store_wms@test.com", password_hash=self.hash, role="store", full_name="Store Keeper")
        self.db.add(self.store)
        self.db.commit()
        self.db.refresh(self.store)
        
        self.client_info = {
            "ip": "192.168.1.1",
            "device": "Mobile Camera Scanner",
            "browser": "Chrome Mobile"
        }

    def tearDown(self):
        self.db.close()
        
    def test_auto_sku_and_barcode_generation(self):
        # Create categories and supplier
        from models import Category
        category = Category(name="Hinges test")
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        
        # Create an inventory item with no SKU and no barcode
        item_in = schemas.InventoryItemCreate(
            category_id=category.id,
            name="Soft Close Hinges",
            sku=None,
            barcode=None,
            brand="Hafele",
            unit="Pairs",
            minimum_stock_level=5.0,
            quantity=0.0
        )
        
        item = crud.create_inventory_item(db=self.db, item=item_in, user_id=self.store.id)
        
        # Format check: [Brand]-[Category]-[YY]-[6-digit running serial]
        yy = datetime.now().strftime("%y")
        expected_prefix = f"HAF-HIN-{yy}-"
        
        self.assertTrue(item.sku.startswith(expected_prefix))
        self.assertEqual(item.barcode, item.sku) # standard default
        self.assertTrue(item.sku.endswith("000001"))
        
        # Create second item with same prefix to assert serial increment
        item_in2 = schemas.InventoryItemCreate(
            category_id=category.id,
            name="Soft Close Hinges Heavy",
            sku=None,
            barcode=None,
            brand="Hafele",
            unit="Pairs",
            minimum_stock_level=5.0,
            quantity=0.0
        )
        item2 = crud.create_inventory_item(db=self.db, item=item_in2, user_id=self.store.id)
        self.assertTrue(item2.sku.endswith("000002"))

    def test_material_receive_workflow(self):
        # Setup item
        item = InventoryItem(
            name="Plywood Heavy", sku="PLY-HVY", barcode="123456789",
            quantity=10.0, unit="Sheets", minimum_stock_level=5.0
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        
        # Perform receive
        req = schemas.MaterialReceiveRequest(
            barcode="123456789",
            quantity=5.0,
            warehouse="Zone A",
            rack="R1",
            shelf="S2",
            bin="B3",
            batch_number="BAT-PLY-01",
            notes="WMS Receive Test"
        )
        
        updated_item = crud.receive_material_wms(self.db, req, self.store.id, self.client_info)
        self.assertEqual(updated_item.quantity, 15.0)
        self.assertEqual(updated_item.warehouse, "Zone A")
        self.assertEqual(updated_item.rack, "R1")
        self.assertEqual(updated_item.shelf, "S2")
        self.assertEqual(updated_item.bin, "B3")
        
        # Assert barcode transaction logs
        txn = self.db.query(BarcodeTransaction).filter(BarcodeTransaction.inventory_id == item.id).first()
        self.assertIsNotNone(txn)
        self.assertEqual(txn.transaction_type, "receive")
        self.assertEqual(txn.quantity, 5.0)
        self.assertEqual(txn.ip_address, "192.168.1.1")
        self.assertEqual(txn.device, "Mobile Camera Scanner")

    def test_purchase_order_matching(self):
        supplier = Supplier(name="Test WMS Supplier")
        self.db.add(supplier)
        self.db.commit()
        self.db.refresh(supplier)
        
        item = InventoryItem(
            name="Glue Premium", sku="GLU-PRM", barcode="GLUE999",
            quantity=10.0, unit="Liters", minimum_stock_level=5.0
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        
        # Create PO
        po = PurchaseOrder(
            po_number="PO-WMS-101",
            supplier_id=supplier.id,
            inventory_id=item.id,
            quantity=20.0,
            unit_cost=15.0,
            total_cost=300.0,
            status="pending",
            received_quantity=0.0,
            pending_quantity=20.0
        )
        self.db.add(po)
        self.db.commit()
        self.db.refresh(po)
        
        # Receive half PO goods
        req = schemas.MaterialReceiveRequest(
            barcode="GLUE999",
            quantity=12.0,
            purchase_order_id=po.id
        )
        crud.receive_material_wms(self.db, req, self.store.id, self.client_info)
        
        self.db.refresh(po)
        self.assertEqual(po.received_quantity, 12.0)
        self.assertEqual(po.pending_quantity, 8.0)
        self.assertEqual(po.status, "delivered") # partial delivery
        
        # Receive the rest
        req2 = schemas.MaterialReceiveRequest(
            barcode="GLUE999",
            quantity=8.0,
            purchase_order_id=po.id
        )
        crud.receive_material_wms(self.db, req2, self.store.id, self.client_info)
        
        self.db.refresh(po)
        self.assertEqual(po.received_quantity, 20.0)
        self.assertEqual(po.pending_quantity, 0.0)
        self.assertEqual(po.status, "received") # fully received PO status

    def test_stock_audit_reconciliation(self):
        item = InventoryItem(
            name="Screws Test", sku="SCR-TEST", barcode="SCR99",
            quantity=100.0, unit="Box", minimum_stock_level=5.0
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        
        # Physical count is 95 boxes instead of 100
        audit_item = schemas.StockAuditItemCreate(
            inventory_id=item.id,
            expected_qty=100.0,
            actual_qty=95.0,
            notes="Physical inventory count"
        )
        
        audit_create = schemas.StockAuditCreate(
            warehouse="Zone B",
            items=[audit_item]
        )
        
        audit = crud.perform_audit_wms(self.db, audit_create, self.store.id)
        
        self.db.refresh(item)
        self.assertEqual(item.quantity, 95.0) # corrected automatically
        self.assertTrue("SCR-TEST: Diff -5.0" in audit.report_summary)

if __name__ == "__main__":
    unittest.main()
