from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal, Base, engine
from models import (
    User, Category, InventoryItem, Supplier, Client, Project, ProjectBOM,
    StockTransaction, MaterialRequest, PurchaseOrder, Staff, Attendance,
    Notification, CustomFieldDefinition, CustomFieldValue, WorkflowDefinition,
    WorkflowStep, ApprovalRule, DashboardWidget, Task, Document, VersionHistory
)
from auth import get_password_hash

def seed_db(drop_all: bool = True):
    # Recreate tables to ensure clean slate
    if drop_all:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    try:
        print("Seeding database...")
        
        # 1. System Users
        users = [
            User(
                email="admin@allure.com",
                password_hash=get_password_hash("admin123"),
                role="admin",
                full_name="Allure Super Admin",
                phone="9876543210",
                employee_code="EMP-001",
                department="Administration",
                status="active"
            ),
            User(
                email="pm@allure.com",
                password_hash=get_password_hash("pm123"),
                role="manager",
                full_name="Alex River - Project Manager",
                phone="9876543211",
                employee_code="EMP-002",
                department="Projects",
                status="active"
            ),
            User(
                email="store@allure.com",
                password_hash=get_password_hash("store123"),
                role="store",
                full_name="Marc Stone - Inventory Manager",
                phone="9876543212",
                employee_code="EMP-003",
                department="Warehouse",
                status="active"
            ),
            User(
                email="accountant@allure.com",
                password_hash=get_password_hash("accountant123"),
                role="accountant",
                full_name="Sophia Cash - Accountant",
                phone="9876543213",
                employee_code="EMP-004",
                department="Finance",
                status="active"
            ),
            User(
                email="staff@allure.com",
                password_hash=get_password_hash("staff123"),
                role="worker",
                full_name="Robert Plank - Senior Carpenter",
                phone="9876543214",
                employee_code="EMP-005",
                department="Production",
                status="active"
            ),
            User(
                email="john.doe@allure.com",
                password_hash=get_password_hash("john123"),
                role="carpenter",
                full_name="John Doe",
                phone="8887776660",
                employee_code="EMP-006",
                department="Production",
                status="active"
            ),
            User(
                email="sarah.c@allure.com",
                password_hash=get_password_hash("sarah123"),
                role="operator",
                full_name="Sarah Connor",
                phone="8887776661",
                employee_code="EMP-007",
                department="Design",
                status="active"
            ),
            User(
                email="david.s@allure.com",
                password_hash=get_password_hash("david123"),
                role="operator",
                full_name="David Smith",
                phone="8887776662",
                employee_code="EMP-008",
                department="Production",
                status="active"
            )
        ]
        db.add_all(users)
        db.commit()
        
        # Reload users to get IDs
        admin_user = db.query(User).filter(User.role == "admin").first()
        pm_user = db.query(User).filter(User.role == "manager").first()
        store_user = db.query(User).filter(User.role == "store").first()
        acct_user = db.query(User).filter(User.role == "accountant").first()
        
        # 2. Material Categories
        categories = {
            "Boards": Category(name="Boards", description="Plywood, MDF, Particle Board sheets"),
            "Hardware": Category(name="Hardware", description="Hinges, Drawer slides, Handles, Locks"),
            "Decorative Surfaces": Category(name="Decorative Surfaces", description="Laminates, Veneers, Acrylic sheets"),
            "Edge Bands": Category(name="Edge Bands", description="PVC Edge Banding rolls"),
            "Consumables": Category(name="Consumables", description="Glue, Screws, Sandpaper, Masking tape")
        }
        db.add_all(categories.values())
        db.commit()
        
        # 3. Suppliers
        suppliers = {
            "Apex": Supplier(
                name="Apex Boards & Plywood Co.", contact_person="Ravi Kumar",
                phone="9988776655", email="sales@apexboards.com", gst_number="27AAACA1111A1Z1",
                address="Plot 45, Industrial Area Phase 1, Mumbai", material_categories="Boards"
            ),
            "Hettich": Supplier(
                name="Hettich Fittings Ltd", contact_person="Amit Sharma",
                phone="9988776656", email="info@hettichfittings.com", gst_number="27AAACA2222A1Z2",
                address="Verna Industrial Estate, Goa", material_categories="Hardware"
            ),
            "Deco": Supplier(
                name="Deco Surfaces Inc", contact_person="Lisa Geller",
                phone="9988776657", email="lisa@decosurfaces.com", gst_number="27AAACA3333A1Z3",
                address="Sector 15, Koparkhairane, Navi Mumbai", material_categories="Decorative Surfaces"
            ),
            "EdgeBand": Supplier(
                name="EdgeBand Pro Distributors", contact_person="Vikram Singh",
                phone="9988776658", email="support@edgebandpro.com", gst_number="27AAACA4444A1Z4",
                address="Lal Bahadur Complex, Delhi", material_categories="Edge Bands"
            ),
            "General": Supplier(
                name="General Consumables Corp", contact_person="Neha Gupta",
                phone="9988776659", email="orders@generalcorp.com", gst_number="27AAACA5555A1Z5",
                address="Phase 3, Okhla Industrial Area, Delhi", material_categories="Consumables"
            )
        }
        db.add_all(suppliers.values())
        db.commit()
        
        # 4. Clients
        clients = {
            "Skyline": Client(name="Skyline Apartments Ltd", contact_person="John Doe", phone="9112233445", email="john@skyline.com", address="Skyline Tower, Worli, Mumbai"),
            "Prestige": Client(name="Prestige Villas Group", contact_person="Elena D'Cruz", phone="9112233446", email="elena@prestigevillas.com", address="Hilltop Colony, Bandra, Mumbai"),
            "TechCorp": Client(name="TechCorp Corporate Office", contact_person="Sanjay Mehta", phone="9112233447", email="smehta@techcorp.com", address="Building 4B, Mindspace IT Park, Navi Mumbai")
        }
        db.add_all(clients.values())
        db.commit()
        
        # 5. Inventory Items (Raw materials)
        inventory = {
            "Plywood18": InventoryItem(
                category_id=categories["Boards"].id, name="Plywood 18mm MR Grade",
                sku="PLY-18-MR", barcode="100001", brand="CenturyPly", size_variant="8x4 Ft",
                quantity=45.0, unit="Sheets", minimum_stock_level=20.0, unit_cost=35.0,
                supplier_id=suppliers["Apex"].id
            ),
            "MDF12": InventoryItem(
                category_id=categories["Boards"].id, name="MDF Board 12mm",
                sku="MDF-12", barcode="100002", brand="Greenpanel", size_variant="8x4 Ft",
                quantity=60.0, unit="Sheets", minimum_stock_level=15.0, unit_cost=22.0,
                supplier_id=suppliers["Apex"].id
            ),
            "Hinges": InventoryItem(
                category_id=categories["Hardware"].id, name="Soft Close Cabinet Hinges",
                sku="HDW-HNG-SC", barcode="100003", brand="Hettich", size_variant="Standard 110 deg",
                quantity=120.0, unit="Pairs", minimum_stock_level=50.0, unit_cost=4.5,
                supplier_id=suppliers["Hettich"].id
            ),
            "Laminate": InventoryItem(
                category_id=categories["Decorative Surfaces"].id, name="White Gloss Laminate 1mm",
                sku="LAM-WH-GL-1", barcode="100004", brand="MerinoLam", size_variant="8x4 Ft",
                quantity=8.0, unit="Sheets", minimum_stock_level=15.0, unit_cost=18.0,  # Low stock!
                supplier_id=suppliers["Deco"].id
            ),
            "Edgeband": InventoryItem(
                category_id=categories["Edge Bands"].id, name="Edge Banding PVC White 2mm",
                sku="ACC-EB-WH-2", barcode="100005", brand="Rehau", size_variant="22x2 mm Roll",
                quantity=350.0, unit="Meters", minimum_stock_level=100.0, unit_cost=0.4,
                supplier_id=suppliers["EdgeBand"].id
            ),
            "Glue": InventoryItem(
                category_id=categories["Consumables"].id, name="PVA Wood Glue 5kg",
                sku="CON-PVA-5", barcode="100006", brand="Fevicol SH", size_variant="5 Kg Bucket",
                quantity=15.0, unit="Buckets", minimum_stock_level=5.0, unit_cost=12.0,
                supplier_id=suppliers["General"].id
            )
        }
        db.add_all(inventory.values())
        db.commit()
        
        # 6. Projects
        projects = {
            "Kitchen": Project(
                name="Skyline Penthouse Kitchen", client_id=clients["Skyline"].id,
                site_location="Worli Penthouse 40A, Mumbai", status="active",
                start_date=date.today() - timedelta(days=15), end_date=date.today() + timedelta(days=15),
                budget=25000.0
            ),
            "Wardrobe": Project(
                name="Prestige Villa Wardrobes", client_id=clients["Prestige"].id,
                site_location="Villa 12, Hilltop Bandra, Mumbai", status="planning",
                start_date=date.today() + timedelta(days=5), end_date=date.today() + timedelta(days=35),
                budget=18000.0
            ),
            "Reception": Project(
                name="TechCorp Reception Table", client_id=clients["TechCorp"].id,
                site_location="IT Park Block 4, Navi Mumbai", status="completed",
                start_date=date.today() - timedelta(days=25), end_date=date.today() - timedelta(days=5),
                budget=5000.0
            )
        }
        db.add_all(projects.values())
        db.commit()
        
        # 7. Project BOM (Bill of Materials)
        bom_items = [
            ProjectBOM(project_id=projects["Kitchen"].id, inventory_id=inventory["Plywood18"].id, required_quantity=20.0, used_quantity=15.0, status="partial"),
            ProjectBOM(project_id=projects["Kitchen"].id, inventory_id=inventory["Hinges"].id, required_quantity=40.0, used_quantity=30.0, status="partial"),
            ProjectBOM(project_id=projects["Kitchen"].id, inventory_id=inventory["Laminate"].id, required_quantity=10.0, used_quantity=8.0, status="partial"),
            ProjectBOM(project_id=projects["Reception"].id, inventory_id=inventory["MDF12"].id, required_quantity=6.0, used_quantity=6.0, status="fulfilled"),
            ProjectBOM(project_id=projects["Reception"].id, inventory_id=inventory["Glue"].id, required_quantity=2.0, used_quantity=2.0, status="fulfilled")
        ]
        db.add_all(bom_items)
        db.commit()
        
        # 8. Historical Stock Transactions for Charts
        # Seed transactions for the past 7 days to make Recharts area chart look amazing
        transactions = []
        for i in range(7, 0, -1):
            tx_date = datetime.utcnow() - timedelta(days=i)
            # Alternate days
            in_qty = 15.0 + (i * 2.5)
            out_qty = 8.0 + (i * 1.5)
            
            # Stock In
            transactions.append(
                StockTransaction(
                    inventory_id=inventory["Plywood18"].id,
                    transaction_type="in",
                    quantity=in_qty,
                    user_id=store_user.id,
                    notes=f"Restock CenturyPly 18mm",
                    created_at=tx_date
                )
            )
            # Stock Out
            transactions.append(
                StockTransaction(
                    inventory_id=inventory["Plywood18"].id,
                    transaction_type="out",
                    quantity=out_qty,
                    project_id=projects["Kitchen"].id,
                    user_id=store_user.id,
                    notes=f"Issued for Skyline Kitchen",
                    created_at=tx_date + timedelta(hours=4)
                )
            )
        db.add_all(transactions)
        db.commit()
        
        # 9. Material Requests
        requests = [
            MaterialRequest(
                project_id=projects["Kitchen"].id,
                inventory_id=inventory["Plywood18"].id,
                requested_by=pm_user.id,
                quantity=5.0,
                status="approved",
                approved_by=store_user.id,
                notes="Extra panel sheets needed for counter back-panel"
            ),
            MaterialRequest(
                project_id=projects["Kitchen"].id,
                inventory_id=inventory["Hinges"].id,
                requested_by=pm_user.id,
                quantity=10.0,
                status="pending",
                notes="Hinges for custom cabinet adjustments"
            )
        ]
        db.add_all(requests)
        db.commit()
        
        # 10. Purchase Orders (Purchasing Workflow)
        pos = [
            PurchaseOrder(
                po_number="PO-20260618-0001",
                supplier_id=suppliers["Apex"].id,
                inventory_id=inventory["MDF12"].id,
                quantity=30.0,
                unit_cost=22.0,
                total_cost=660.0,
                status="received",
                requested_by=acct_user.id,
                created_at=datetime.utcnow() - timedelta(days=2),
                updated_at=datetime.utcnow() - timedelta(days=1)
            ),
            PurchaseOrder(
                po_number="PO-20260618-0002",
                supplier_id=suppliers["Deco"].id,
                inventory_id=inventory["Laminate"].id,
                quantity=15.0,
                unit_cost=18.0,
                total_cost=270.0,
                status="ordered",
                requested_by=acct_user.id,
                created_at=datetime.utcnow() - timedelta(hours=12)
            )
        ]
        db.add_all(pos)
        db.commit()
        
        # 11. Staff Registry
        staff_user = db.query(User).filter(User.email == "staff@allure.com").first()
        john_user = db.query(User).filter(User.email == "john.doe@allure.com").first()
        sarah_user = db.query(User).filter(User.email == "sarah.c@allure.com").first()
        david_user = db.query(User).filter(User.email == "david.s@allure.com").first()

        staff = {
            "Robert": Staff(name="Robert Plank", role="Senior Carpenter", phone="9876543214", email="staff@allure.com", salary=3500.0, status="active", user_id=staff_user.id if staff_user else None),
            "John": Staff(name="John Doe", role="Senior Carpenter", phone="8887776660", email="john.doe@allure.com", salary=4000.0, status="active", user_id=john_user.id if john_user else None),
            "Sarah": Staff(name="Sarah Connor", role="Lead CAD Designer", phone="8887776661", email="sarah.c@allure.com", salary=5500.0, status="active", user_id=sarah_user.id if sarah_user else None),
            "David": Staff(name="David Smith", role="Assembler Helper", phone="8887776662", email="david.s@allure.com", salary=2500.0, status="active", user_id=david_user.id if david_user else None)
        }
        db.add_all(staff.values())
        db.commit()
        
        # 12. Attendance logs for the past 2 days + today
        today_dt = date.today()
        attendance_logs = [
            # Today
            Attendance(staff_id=staff["John"].id, date=today_dt, status="present", check_in="09:00", check_out="18:00"),
            Attendance(staff_id=staff["Sarah"].id, date=today_dt, status="present", check_in="08:45", check_out="17:30"),
            Attendance(staff_id=staff["David"].id, date=today_dt, status="leave", check_in=None, check_out=None),
            # Yesterday
            Attendance(staff_id=staff["John"].id, date=today_dt - timedelta(days=1), status="present", check_in="09:02", check_out="18:05"),
            Attendance(staff_id=staff["Sarah"].id, date=today_dt - timedelta(days=1), status="present", check_in="08:50", check_out="17:35"),
            Attendance(staff_id=staff["David"].id, date=today_dt - timedelta(days=1), status="present", check_in="09:15", check_out="18:10")
        ]
        db.add_all(attendance_logs)
        db.commit()
        
        # 13. System Notifications
        notifications = [
            Notification(
                title="LOW STOCK: White Gloss Laminate 1mm",
                description="Material White Gloss Laminate 1mm (LAM-WH-GL-1) is below minimum level. Current: 8.0 Sheets (Min: 15.0)",
                type="low_stock",
                is_read=False
            ),
            Notification(
                title="Pending Material Request",
                description="Soft Close Cabinet Hinges (10.0 Pairs) requested for Project 'Skyline Penthouse Kitchen'.",
                type="request_pending",
                is_read=False
            )
        ]
        db.add_all(notifications)
        db.commit()
        
        # 14. Custom Field Definitions
        cf_definitions = [
            CustomFieldDefinition(
                entity_type="Supplier",
                name="credit_limit",
                label="Credit Limit",
                field_type="number",
                is_required=False,
                choices=None
            ),
            CustomFieldDefinition(
                entity_type="Staff",
                name="pan_card",
                label="PAN Card Number",
                field_type="text",
                is_required=False,
                choices=None
            ),
            CustomFieldDefinition(
                entity_type="Project",
                name="priority_level",
                label="Priority Level",
                field_type="dropdown",
                is_required=False,
                choices="Low,Medium,High,Critical"
            )
        ]
        db.add_all(cf_definitions)
        db.commit()

        # Seed custom field values for existing suppliers/staff
        apex_supplier = db.query(Supplier).filter(Supplier.name == "Apex Boards & Plywood Co.").first()
        credit_limit_cf = db.query(CustomFieldDefinition).filter(
            CustomFieldDefinition.entity_type == "Supplier",
            CustomFieldDefinition.name == "credit_limit"
        ).first()
        if apex_supplier and credit_limit_cf:
            db.add(CustomFieldValue(
                field_definition_id=credit_limit_cf.id,
                entity_id=apex_supplier.id,
                value_text="50000"
            ))

        john_staff = db.query(Staff).filter(Staff.name == "John Doe").first()
        pan_card_cf = db.query(CustomFieldDefinition).filter(
            CustomFieldDefinition.entity_type == "Staff",
            CustomFieldDefinition.name == "pan_card"
        ).first()
        if john_staff and pan_card_cf:
            db.add(CustomFieldValue(
                field_definition_id=pan_card_cf.id,
                entity_id=john_staff.id,
                value_text="ABCDE1234F"
            ))
        db.commit()

        # 15. Workflow Definitions & Steps
        mr_workflow = WorkflowDefinition(
            entity_type="MaterialRequest",
            name="Material Request Approval Workflow",
            description="Multi-stage approval process for material release"
        )
        db.add(mr_workflow)
        db.commit()

        mr_steps = [
            WorkflowStep(workflow_id=mr_workflow.id, step_name="Draft Request", step_order=1, role_allowed_to_execute="worker"),
            WorkflowStep(workflow_id=mr_workflow.id, step_name="Manager Approval", step_order=2, role_allowed_to_execute="manager"),
            WorkflowStep(workflow_id=mr_workflow.id, step_name="Store Dispatch", step_order=3, role_allowed_to_execute="store"),
            WorkflowStep(workflow_id=mr_workflow.id, step_name="Completed", step_order=4, role_allowed_to_execute="admin")
        ]
        db.add_all(mr_steps)
        db.commit()

        # 16. Approval Rules
        po_rules = [
            ApprovalRule(entity_type="PurchaseOrder", min_value=0.0, max_value=10000.0, role_approver="manager"),
            ApprovalRule(entity_type="PurchaseOrder", min_value=10000.01, max_value=50000.0, role_approver="accountant"),
            ApprovalRule(entity_type="PurchaseOrder", min_value=50000.01, max_value=9999999.0, role_approver="admin")
        ]
        db.add_all(po_rules)
        db.commit()

        # 17. Dashboard Widgets
        if admin_user:
            widgets = [
                DashboardWidget(user_id=admin_user.id, title="Stock Overview", widget_type="kpi_stock", layout_x=0, layout_y=0, layout_w=4, layout_h=2),
                DashboardWidget(user_id=admin_user.id, title="Active Projects", widget_type="kpi_projects", layout_x=4, layout_y=0, layout_w=4, layout_h=2),
                DashboardWidget(user_id=admin_user.id, title="Purchase Orders Status", widget_type="kpi_po", layout_x=8, layout_y=0, layout_w=4, layout_h=2),
                DashboardWidget(user_id=admin_user.id, title="Material Flow Analysis", widget_type="chart_movement", layout_x=0, layout_y=2, layout_w=6, layout_h=4),
                DashboardWidget(user_id=admin_user.id, title="Recent Activity Log", widget_type="recent_activity", layout_x=6, layout_y=2, layout_w=6, layout_h=4)
            ]
            db.add_all(widgets)
            db.commit()

        print("Database seeded successfully!")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
