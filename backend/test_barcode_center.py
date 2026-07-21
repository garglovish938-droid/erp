import os
import sys
import unittest
from datetime import date, datetime

# Append current directory to import path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_dir)

os.environ["DATABASE_URL"] = "sqlite:///C:/Users/ASUS/.gemini/antigravity-ide/scratch/erp_demo/backend/test_barcode_center.db"

from database import SessionLocal, Base, engine
import crud, schemas, auth
from models import User, InventoryItem, Project, BarcodeHistory, Category

class TestBarcodeCenter(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
    def setUp(self):
        self.db = SessionLocal()
        # Clean tables
        self.db.query(BarcodeHistory).delete()
        self.db.query(Project).delete()
        self.db.query(InventoryItem).delete()
        self.db.query(Category).delete()
        self.db.query(User).delete()
        self.db.commit()
        
        # Setup helper user
        self.password = "testpass123"
        self.hash = auth.get_password_hash(self.password)
        self.store = User(email="store_barcode@test.com", password_hash=self.hash, role="store", full_name="Store Keeper")
        self.db.add(self.store)
        self.db.commit()
        self.db.refresh(self.store)

    def tearDown(self):
        self.db.close()
        
    def test_sequential_al_and_prj_barcodes(self):
        # Create category
        category = Category(name="Boards")
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        
        # Create inventory item - should auto-generate barcode "AL-000001"
        item_in = schemas.InventoryItemCreate(
            category_id=category.id,
            name="MDF Board 18mm",
            brand="Century",
            unit="Sheets",
            quantity=10.0,
            minimum_stock_level=2.0
        )
        item = crud.create_inventory_item(self.db, item_in, self.store.id)
        self.assertEqual(item.barcode, "AL-000001")
        
        # Create project - should auto-generate barcode "PRJ-000001"
        proj_in = schemas.ProjectCreate(
            name="Villa Wardrobe Project"
        )
        proj = crud.create_project(self.db, proj_in, self.store.id)
        self.assertEqual(proj.barcode, "PRJ-000001")
        
        # Verify history logs
        histories = self.db.query(BarcodeHistory).all()
        self.assertEqual(len(histories), 2)
        
        types = [h.barcode_type for h in histories]
        barcodes = [h.barcode for h in histories]
        
        self.assertIn("inventory", types)
        self.assertIn("project", types)
        self.assertIn("AL-000001", barcodes)
        self.assertIn("PRJ-000001", barcodes)

    def test_explicit_generation_and_print_log(self):
        category = Category(name="Hardware")
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        
        # Create item manually with dummy barcode to satisfy nullable=False database constraint
        item = InventoryItem(
            name="Drawer Slides", sku="DRW-SLD", barcode="DUMMY-BARCODE",
            category_id=category.id, quantity=0.0, unit="Pcs"
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        
        # Call explicit generate helper
        from main import barcode_center_generate
        req = schemas.BarcodeGenerateRequest(
            entity_type="inventory",
            entity_id=item.id
        )
        res = barcode_center_generate(req, self.db, self.store)
        self.assertEqual(res["status"], "success")
        self.assertTrue(res["barcode"].startswith("AL-"))
        
        # Call print log endpoint helper
        from main import log_barcode_print
        print_res = log_barcode_print(res["barcode"], self.db, self.store)
        self.assertEqual(print_res["status"], "success")
        self.assertEqual(print_res["print_count"], 1)

if __name__ == "__main__":
    unittest.main()
