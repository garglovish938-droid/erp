import os
import json

def init_all_flows():
    flows_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flows")
    os.makedirs(flows_dir, exist_ok=True)
    
    flow_definitions = {
        "flow_1_inventory": {
            "name": "Inventory AI Flow",
            "version": "1.0.0",
            "description": "Inventory stock checks, safety stock evaluation, and low stock warnings.",
            "components": ["ChatInput", "FastAPIInventoryAPI", "StockThresholdChecker", "ChatOutput"]
        },
        "flow_2_material_request": {
            "name": "Material Request AI Flow",
            "version": "1.0.0",
            "description": "Compiles and submits draft material requests for production pipelines.",
            "components": ["ChatInput", "FastAPIMaterialRequestAPI", "DraftValidator", "ChatOutput"]
        },
        "flow_3_purchase": {
            "name": "Purchase AI Flow",
            "version": "1.0.0",
            "description": "Compiles and registers purchase order drafts for procurement.",
            "components": ["ChatInput", "FastAPIPurchaseOrderAPI", "DraftValidator", "ChatOutput"]
        },
        "flow_4_expense": {
            "name": "Daily Expense AI Flow",
            "version": "1.0.0",
            "description": "Records daily operational expenses and computes burn rates.",
            "components": ["ChatInput", "FastAPIExpensesAPI", "DuplicateDetector", "ChatOutput"]
        },
        "flow_5_wallet": {
            "name": "Wallet AI Flow",
            "version": "1.0.0",
            "description": "Reviews factory wallet balances and handles manager fund requests.",
            "components": ["ChatInput", "FastAPIWalletsAPI", "BalanceValidator", "ChatOutput"]
        },
        "flow_6_cashbook": {
            "name": "Cash Book AI Flow",
            "version": "1.0.0",
            "description": "Queries historical capital cash book balances and logs transfers.",
            "components": ["ChatInput", "FastAPICashBookAPI", "BalanceValidator", "ChatOutput"]
        },
        "flow_7_receipt": {
            "name": "Client Receipt AI Flow",
            "version": "1.0.0",
            "description": "Monitors client invoices and logs revenue payment receipts.",
            "components": ["ChatInput", "FastAPIReceiptsAPI", "ReceiptValidator", "ChatOutput"]
        },
        "flow_8_project": {
            "name": "Project AI Flow",
            "version": "1.0.0",
            "description": "Tracks active projects, delay predictions, and BOM progress.",
            "components": ["ChatInput", "FastAPIProjectsAPI", "ProgressEstimator", "ChatOutput"]
        },
        "flow_9_employee": {
            "name": "Employee AI Flow",
            "version": "1.0.0",
            "description": "Enables querying active personnel rosters and staff profile details.",
            "components": ["ChatInput", "FastAPIEmployeeAPI", "RosterReader", "ChatOutput"]
        },
        "flow_10_attendance": {
            "name": "Attendance AI Flow",
            "version": "1.0.0",
            "description": "Registers daily check-ins/check-outs and audits attendance lists.",
            "components": ["ChatInput", "FastAPIAttendanceAPI", "CheckInValidator", "ChatOutput"]
        },
        "flow_11_reports": {
            "name": "Reports AI Flow",
            "version": "1.0.0",
            "description": "Generates PDF, Excel, and CSV reports with custom branding.",
            "components": ["ChatInput", "ReportCompiler", "PDFGenerator", "ChatOutput"]
        },
        "flow_12_ocr": {
            "name": "OCR AI Flow",
            "version": "1.0.0",
            "description": "Performs OCR scans on receipt images to extract bill entities.",
            "components": ["FileInput", "OCRParser", "ClassifyDocument", "ChatOutput"]
        },
        "flow_13_notification": {
            "name": "Notification AI Flow",
            "version": "1.0.0",
            "description": "Dispatches system alerts and reminder messages through WhatsApp/Email.",
            "components": ["EventTrigger", "TemplateFormatter", "NotificationQueue", "ChatOutput"]
        },
        "flow_14_security_monitor": {
            "name": "Security Monitor AI Flow",
            "version": "1.0.0",
            "description": "Flags authentication failures and rates limit anomalies.",
            "components": ["AuditLogReader", "SecurityRulesEngine", "ThreatNotifier", "ChatOutput"]
        },
        "flow_15_executive_dashboard": {
            "name": "Executive Dashboard AI Flow",
            "version": "1.0.0",
            "description": "Aggregates overall factory analytics, stock warnings, and finance health.",
            "components": ["AnalyticsEngine", "StatsAggregator", "DashboardFormatter", "ChatOutput"]
        },
        "flow_16_barcode": {
            "name": "Barcode Workflow Flow",
            "version": "1.0.0",
            "description": "Handles barcode scans, maps material items, and tracks stock levels.",
            "components": ["BarcodeScanner", "FastAPIInventoryLookup", "StockTransactionPoster", "ChatOutput"]
        },
        "flow_17_approval": {
            "name": "Approval Workflow Flow",
            "version": "1.0.0",
            "description": "Executes drafts (POs/MRs) upon manager or admin confirmation.",
            "components": ["ChatInput", "ActionEngineApprover", "Auditor", "ChatOutput"]
        },
        "flow_18_analytics": {
            "name": "Analytics Workflow Flow",
            "version": "1.0.0",
            "description": "Predicts inventory stock-out timelines and optimizes expenses.",
            "components": ["ForecastingModel", "GeminiContextBuilder", "RecommendationsGenerator", "ChatOutput"]
        },
        "flow_19_audit": {
            "name": "Audit Workflow Flow",
            "version": "1.0.0",
            "description": "Retrieves logs and offers recovery rollback recommendations.",
            "components": ["AuditLogReader", "RollbackRecommender", "ChatOutput"]
        },
        "flow_20_assistant": {
            "name": "ERP Assistant Flow",
            "version": "1.0.0",
            "description": "General conversational ERP assistant, query routing, and fallback helper.",
            "components": ["ChatInput", "DifyKBClient", "RBACFilter", "ChatOutput"]
        }
    }
    
    for flow_id, definition in flow_definitions.items():
        filepath = os.path.join(flows_dir, f"{flow_id}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(definition, f, indent=2)
    print(f"Successfully generated {len(flow_definitions)} flows in {flows_dir}")
            
if __name__ == "__main__":
    init_all_flows()
