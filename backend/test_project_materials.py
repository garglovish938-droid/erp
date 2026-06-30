import os
import sys
import unittest
from datetime import datetime

# Append current directory to import path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_dir)

# Override database URL for tests to prevent wiping development database
os.environ["DATABASE_URL"] = "sqlite:///C:/Users/ASUS/.gemini/antigravity-ide/scratch/erp_demo/backend/test_erp.db"

from database import SessionLocal, Base, engine
import crud, schemas, auth
from models import User, InventoryItem, Project, ProjectBOM, ProjectMaterialHistory, AuditLog

class TestProjectMaterials(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
    def setUp(self):
        self.db = SessionLocal()
        self.db.query(ProjectMaterialHistory).delete()
        self.db.query(ProjectBOM).delete()
        self.db.query(Project).delete()
        self.db.query(InventoryItem).delete()
        self.db.query(User).delete()
        self.db.commit()
        
        self.password = "testpass123"
        self.hash = auth.get_password_hash(self.password)
        
        # Create users
        self.admin = User(email="admin@test.com", password_hash=self.hash, role="admin", full_name="Admin User")
        self.pm = User(email="pm@test.com", password_hash=self.hash, role="manager", full_name="Project Manager")
        self.db.add_all([self.admin, self.pm])
        self.db.commit()
        self.db.refresh(self.admin)
        self.db.refresh(self.pm)

    def tearDown(self):
        self.db.close()
        
    def test_record_usage_and_returns(self):
        # 1. Create a project and an inventory item
        project = Project(name="Project Alpha", status="active", budget=10000.0)
        item = InventoryItem(
            name="Teak Plywood 18mm", sku="PLY-TEAK-18", barcode="123456",
            quantity=50.0, unit="Sheets", minimum_stock_level=5.0, unit_cost=1000.0
        )
        self.db.add_all([project, item])
        self.db.commit()
        self.db.refresh(project)
        self.db.refresh(item)
        
        # 2. Record material usage (deduct 10 sheets)
        history = crud.record_material_usage(
            db=self.db, project_id=project.id, inventory_id=item.id,
            user_id=self.pm.id, action="used", quantity=10.0,
            notes="Woodwork assembly", reason="Initial woodwork issue"
        )
        
        # Verify warehouse stock reduced
        self.db.refresh(item)
        self.assertEqual(item.quantity, 40.0)
        
        # Verify BOM created
        bom = self.db.query(ProjectBOM).filter(
            ProjectBOM.project_id == project.id,
            ProjectBOM.inventory_id == item.id
        ).first()
        self.assertIsNotNone(bom)
        self.assertEqual(bom.used_quantity, 10.0)
        
        # Verify history log created
        self.assertEqual(history.action, "used")
        self.assertEqual(history.quantity, 10.0)
        
        # Verify audit log created with reason
        audit = self.db.query(AuditLog).filter_by(project_id=project.id, inventory_id=item.id).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.reason, "Initial woodwork issue")
        
        # 3. Record material return (return 3 sheets)
        history_ret = crud.record_material_usage(
            db=self.db, project_id=project.id, inventory_id=item.id,
            user_id=self.pm.id, action="returned", quantity=3.0,
            notes="Leftover sheets", reason="Project woodwork completion"
        )
        
        # Verify stock updated
        self.db.refresh(item)
        self.assertEqual(item.quantity, 43.0)
        self.db.refresh(bom)
        self.assertEqual(bom.used_quantity, 7.0)
        
        # 4. Try to return more than used (return 10 sheets when used is 7)
        with self.assertRaises(ValueError):
            crud.record_material_usage(
                db=self.db, project_id=project.id, inventory_id=item.id,
                user_id=self.pm.id, action="returned", quantity=10.0,
                notes="Too many returned", reason="Error"
            )

    def test_transfer_project_material(self):
        # 1. Setup inventory item and projects A & B
        item = InventoryItem(
            name="MDF Board 12mm", sku="MDF-12", barcode="234567",
            quantity=30.0, unit="Sheets", minimum_stock_level=5.0, unit_cost=500.0
        )
        proj_a = Project(name="Project A", status="active", budget=5000.0)
        proj_b = Project(name="Project B", status="active", budget=5000.0)
        self.db.add_all([item, proj_a, proj_b])
        self.db.commit()
        self.db.refresh(item)
        self.db.refresh(proj_a)
        self.db.refresh(proj_b)
        
        # 2. Allocate 15 sheets to Project A
        crud.record_material_usage(
            db=self.db, project_id=proj_a.id, inventory_id=item.id,
            user_id=self.pm.id, action="used", quantity=15.0,
            notes="Proj A layout", reason="Allocation A"
        )
        
        # Verify warehouse stock is 15
        self.db.refresh(item)
        self.assertEqual(item.quantity, 15.0)
        
        # 3. Transfer 5 sheets from Project A to Project B
        success = crud.transfer_project_material(
            db=self.db, from_project_id=proj_a.id, to_project_id=proj_b.id,
            inventory_id=item.id, quantity=5.0, user_id=self.pm.id,
            notes="Bed design adjustment transfer", reason="Transfer to B"
        )
        self.assertTrue(success)
        
        # 4. Verify allocations
        bom_a = self.db.query(ProjectBOM).filter_by(project_id=proj_a.id, inventory_id=item.id).first()
        bom_b = self.db.query(ProjectBOM).filter_by(project_id=proj_b.id, inventory_id=item.id).first()
        self.assertEqual(bom_a.used_quantity, 10.0)
        self.assertEqual(bom_b.used_quantity, 5.0)
        
        # Verify warehouse stock remains 15 (unchanged)
        self.db.refresh(item)
        self.assertEqual(item.quantity, 15.0)
        
        # Verify history timeline entries exist
        hist_a = self.db.query(ProjectMaterialHistory).filter_by(project_id=proj_a.id, action="transferred_out").first()
        hist_b = self.db.query(ProjectMaterialHistory).filter_by(project_id=proj_b.id, action="transferred_in").first()
        self.assertIsNotNone(hist_a)
        self.assertIsNotNone(hist_b)
        self.assertEqual(hist_a.quantity, 5.0)
        self.assertEqual(hist_b.quantity, 5.0)

    def test_add_new_material_to_project(self):
        project = Project(name="Project New", status="active", budget=10000.0)
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        
        # Add a totally new material and allocate it to the project directly
        item_in = schemas.NewMaterialAndProjectUsageRequest(
            name="Oak Timber Plank",
            sku="TIMB-OAK-50",
            barcode="555001",
            brand="TimberCo",
            size_variant="50mm thick",
            unit="Planks",
            minimum_stock_level=3.0,
            unit_cost=1200.0,
            quantity=10.0,
            reason="Custom library shelf",
            notes="Direct allocation"
        )
        
        item = crud.add_new_material_to_project(
            db=self.db, project_id=project.id,
            item_in=item_in, user_id=self.pm.id
        )
        
        # Verify item was created
        self.assertEqual(item.sku, "TIMB-OAK-50")
        self.assertEqual(item.quantity, 0.0) # 10 added then 10 used, so warehouse stock is 0
        
        # Verify project BOM allocated
        bom = self.db.query(ProjectBOM).filter_by(project_id=project.id, inventory_id=item.id).first()
        self.assertIsNotNone(bom)
        self.assertEqual(bom.used_quantity, 10.0)
        
        # Verify history timeline
        hist = self.db.query(ProjectMaterialHistory).filter_by(project_id=project.id, inventory_id=item.id).first()
        self.assertIsNotNone(hist)
        self.assertEqual(hist.action, "used")
        self.assertEqual(hist.quantity, 10.0)

    def test_admin_history_edit_and_delete(self):
        # 1. Setup project & item
        project = Project(name="Project Admin", status="active", budget=20000.0)
        item = InventoryItem(
            name="Steel Beam H", sku="ST-BEAM-H", barcode="888001",
            quantity=100.0, unit="Beams", minimum_stock_level=10.0, unit_cost=5000.0
        )
        self.db.add_all([project, item])
        self.db.commit()
        self.db.refresh(project)
        self.db.refresh(item)
        
        # 2. Record initial usage of 20 beams
        history = crud.record_material_usage(
            db=self.db, project_id=project.id, inventory_id=item.id,
            user_id=self.pm.id, action="used", quantity=20.0,
            notes="Foundation beams", reason="Phase 1 foundations"
        )
        
        # Verify stock and BOM
        self.db.refresh(item)
        self.assertEqual(item.quantity, 80.0)
        
        # 3. Super Admin edits the history log to change used quantity to 30.0
        updated_history = crud.update_project_material_history(
            db=self.db, project_id=project.id, history_id=history.id,
            quantity=30.0, action="used", notes="Corrected beam count",
            reason="Admin audit correction", user_id=self.admin.id
        )
        
        # Verify stock adjusts to 70.0 (old 20 returned, new 30 deducted)
        self.db.refresh(item)
        self.assertEqual(item.quantity, 70.0)
        bom = self.db.query(ProjectBOM).filter_by(project_id=project.id, inventory_id=item.id).first()
        self.assertEqual(bom.used_quantity, 30.0)
        
        # 4. Super Admin deletes the history log completely
        success = crud.delete_project_material_history(
            db=self.db, project_id=project.id, history_id=history.id,
            reason="Log deletion test", user_id=self.admin.id
        )
        self.assertTrue(success)
        
        # Verify stock reverts back to 100.0 and BOM used_quantity is 0.0
        self.db.refresh(item)
        self.assertEqual(item.quantity, 100.0)
        self.db.refresh(bom)
        self.assertEqual(bom.used_quantity, 0.0)
