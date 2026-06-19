import os
import sys
import unittest
from datetime import date

# Append current directory to import path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Override database URL for tests to prevent wiping development database
os.environ["DATABASE_URL"] = "sqlite:///C:/Users/ASUS/.gemini/antigravity-ide/scratch/erp_demo/backend/test_erp.db"

from backend.database import SessionLocal, Base, engine
from backend import crud, schemas, auth
from backend.models import User, InventoryItem, Project, ProjectBOM, MaterialRequest, PurchaseOrder, Supplier

class TestAllureERP(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # Initialize test tables on the engine
        Base.metadata.create_all(bind=engine)
        
    def setUp(self):
        self.db = SessionLocal()
        # Clean tables
        self.db.query(MaterialRequest).delete()
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
        
        # Create default Admin and PM users
        self.admin = User(email="admin@test.com", password_hash=self.hash, role="admin", full_name="Admin User")
        self.pm = User(email="pm@test.com", password_hash=self.hash, role="manager", full_name="Project Manager")
        self.store = User(email="store@test.com", password_hash=self.hash, role="store", full_name="Store Keeper")
        self.db.add_all([self.admin, self.pm, self.store])
        self.db.commit()
        self.db.refresh(self.admin)
        self.db.refresh(self.pm)
        self.db.refresh(self.store)

    def tearDown(self):
        self.db.close()
        
    def test_user_authentication(self):
        # Test password hashing and verification
        self.assertTrue(auth.verify_password("testpass123", self.admin.password_hash))
        self.assertFalse(auth.verify_password("wrongpassword", self.admin.password_hash))
        
    def test_stock_adjustments(self):
        # Create an inventory item
        item = InventoryItem(
            name="Plywood test", sku="PLY-TEST", barcode="999001",
            quantity=10.0, unit="Sheets", minimum_stock_level=5.0, unit_cost=20.0
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        
        # Test positive stock adjustment (restocking)
        updated_item = crud.adjust_stock(
            db=self.db, inventory_id=item.id, quantity=5.0,
            transaction_type="in", user_id=self.store.id, notes="Restock test"
        )
        self.assertEqual(updated_item.quantity, 15.0)
        
        # Test negative stock adjustment within limits
        updated_item = crud.adjust_stock(
            db=self.db, inventory_id=item.id, quantity=-3.0,
            transaction_type="out", user_id=self.store.id, notes="Issue test"
        )
        self.assertEqual(updated_item.quantity, 12.0)
        
        # Test insufficient stock safety guard
        with self.assertRaises(ValueError):
            crud.adjust_stock(
                db=self.db, inventory_id=item.id, quantity=-20.0,
                transaction_type="out", user_id=self.store.id, notes="Overdraw test"
            )
            
    def test_material_request_approval_workflow(self):
        # Create inventory
        item = InventoryItem(
            name="Hinges test", sku="HNG-TEST", barcode="999002",
            quantity=20.0, unit="Pairs", minimum_stock_level=5.0, unit_cost=5.0
        )
        self.db.add(item)
        
        # Create project
        project = Project(name="Test Project", status="active", budget=5000.0)
        self.db.add(project)
        self.db.commit()
        self.db.refresh(item)
        self.db.refresh(project)
        
        # Create Project BOM
        bom = ProjectBOM(project_id=project.id, inventory_id=item.id, required_quantity=15.0, used_quantity=0.0)
        self.db.add(bom)
        self.db.commit()
        self.db.refresh(bom)
        
        # Create Material Request
        req_in = schemas.MaterialRequestCreate(
            project_id=project.id, inventory_id=item.id, quantity=10.0, notes="Need hinges"
        )
        req = crud.create_material_request(db=self.db, req=req_in, user_id=self.pm.id)
        self.assertEqual(req.status, "pending")
        
        # Approve request
        req = crud.update_material_request_status(db=self.db, request_id=req.id, status="approved", user_id=self.pm.id)
        self.assertEqual(req.status, "approved")
        self.assertEqual(req.approved_by, self.pm.id)
        
        # Issue request and verify stock deduction and BOM increment
        req = crud.update_material_request_status(db=self.db, request_id=req.id, status="issued", user_id=self.store.id)
        self.assertEqual(req.status, "issued")
        
        # Reload inventory and BOM items
        self.db.refresh(item)
        self.db.refresh(bom)
        
        # Hinges: 20 -> 10 remaining
        self.assertEqual(item.quantity, 10.0)
        # BOM: 0 used -> 10 used
        self.assertEqual(bom.used_quantity, 10.0)
        self.assertEqual(bom.status, "partial")
        
    def test_purchase_order_completion_workflow(self):
        # Create supplier
        supplier = Supplier(name="Test Supplier")
        self.db.add(supplier)
        
        # Create inventory item
        item = InventoryItem(
            name="Glue test", sku="GLU-TEST", barcode="999003",
            quantity=2.0, unit="Buckets", minimum_stock_level=5.0, unit_cost=10.0
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(supplier)
        self.db.refresh(item)
        
        # Create PO
        po_in = schemas.PurchaseOrderCreate(
            supplier_id=supplier.id, inventory_id=item.id, quantity=10.0, unit_cost=10.0
        )
        po = crud.create_purchase_order(db=self.db, po=po_in, user_id=self.admin.id)
        self.assertEqual(po.status, "pending")
        self.assertEqual(po.total_cost, 100.0)
        
        # Receive PO goods
        po = crud.update_purchase_order_status(db=self.db, po_id=po.id, status="received", user_id=self.store.id)
        self.assertEqual(po.status, "received")
        
        # Reload inventory
        self.db.refresh(item)
        # Glue: 2 -> 12 buckets
        self.assertEqual(item.quantity, 12.0)

if __name__ == "__main__":
    unittest.main()
