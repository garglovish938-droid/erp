import os
import json

def init_all_flows():
    flows_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flows")
    os.makedirs(flows_dir, exist_ok=True)
    
    flow_definitions = {
        "flow_1_inventory": {
            "name": "Inventory Assistant Flow",
            "version": "1.0.0",
            "description": "Stock lookup, low stock thresholds, and reorder suggestion logs.",
            "components": ["ChatInput", "IntentClassifier", "FastAPIVendorsAPI", "FastAPILowStockAPI", "ShortagePredictor", "ChatOutput"]
        },
        "flow_2_project": {
            "name": "Project Assistant Flow",
            "version": "1.0.0",
            "description": "Evaluates project timeline delays and schedules.",
            "components": ["ChatInput", "FastAPIProjectsAPI", "DelayPredictor", "ChatOutput"]
        },
        "flow_3_expense": {
            "name": "Daily Expense Assistant Flow",
            "version": "1.0.0",
            "description": "Checks and aggregates expense summaries.",
            "components": ["ChatInput", "FastAPIExpensesAPI", "ReceiptOCRComponent", "DuplicateDetector", "ChatOutput"]
        },
        "flow_4_wallet": {
            "name": "Factory Wallet Assistant Flow",
            "version": "1.0.0",
            "description": "Analyzes burn rates, balances, and funding recommendations.",
            "components": ["ChatInput", "FastAPIWalletsAPI", "ForecastEngine", "ChatOutput"]
        },
        "flow_5_cashbook": {
            "name": "Cash Book Assistant Flow",
            "version": "1.0.0",
            "description": "Explains ledger transactions and anomaly checks.",
            "components": ["ChatInput", "FastAPICashBookAPI", "AnomalyDetector", "ChatOutput"]
        },
        "flow_6_receipt": {
            "name": "Client Receipt Assistant Flow",
            "version": "1.0.0",
            "description": "Lists outstanding invoices and pending payments.",
            "components": ["ChatInput", "FastAPIReceiptsAPI", "PaymentReminderGenerator", "ChatOutput"]
        },
        "flow_7_employee": {
            "name": "Employee Assistant Flow",
            "version": "1.0.0",
            "description": "Queries attendance logs and allocations.",
            "components": ["ChatInput", "FastAPIAttendanceAPI", "WorkloadEstimator", "ChatOutput"]
        },
        "flow_8_reporting": {
            "name": "Reporting Assistant Flow",
            "version": "1.0.0",
            "description": "Prepares structured CSV/PDF data exports.",
            "components": ["ChatInput", "ReportGenerator", "FastAPIEngine", "ChatOutput"]
        },
        "flow_9_notification": {
            "name": "Notification Engine Flow",
            "version": "1.0.0",
            "description": "Formats system alerts (WhatsApp/Email templates).",
            "components": ["EventTrigger", "TemplateFormatter", "WhatsAppAPI", "EmailAPI", "ChatOutput"]
        },
        "flow_10_ocr": {
            "name": "OCR Assistant Flow",
            "version": "1.0.0",
            "description": "Classifies incoming bills/invoices without auto-approving.",
            "components": ["FileInput", "OCRParser", "ClassifyDocument", "FastAPIDraftExpense", "ChatOutput"]
        },
        "flow_11_chatbot": {
            "name": "AI Chatbot Flow",
            "version": "1.0.0",
            "description": "Interfaces with Dify KB and enforces role-based answers.",
            "components": ["ChatInput", "DifyKBClient", "RBACFilter", "ChatOutput"]
        },
        "flow_12_github": {
            "name": "GitHub Automation Flow",
            "version": "1.0.0",
            "description": "Read-only repository status analysis.",
            "components": ["ChatInput", "GitHubReadAPI", "CodeQualityAnalyzer", "ChatOutput"]
        },
        "flow_13_monitor_prod": {
            "name": "Production Monitor Flow",
            "version": "1.0.0",
            "description": "Summarizes API, DB health, CPU, memory, and error rates.",
            "components": ["CronTrigger", "MetricsFetcher", "FastAPIPing", "AlertGenerator", "ChatOutput"]
        },
        "flow_14_monitor_sec": {
            "name": "Security Monitor Flow",
            "version": "1.0.0",
            "description": "Flags login anomalies and token misuse.",
            "components": ["CronTrigger", "AuditLogReader", "SecurityRulesEngine", "AlertGenerator", "ChatOutput"]
        },
        "flow_15_audit": {
            "name": "Audit Assistant Flow",
            "version": "1.0.0",
            "description": "Traces who modified what record and outputs rollback directions.",
            "components": ["ChatInput", "FastAPIAuditLogs", "RollbackRecommender", "ChatOutput"]
        }
    }
    
    for flow_id, definition in flow_definitions.items():
        filepath = os.path.join(flows_dir, f"{flow_id}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(definition, f, indent=2)
    print(f"Successfully generated {len(flow_definitions)} flows in {flows_dir}")
            
if __name__ == "__main__":
    init_all_flows()
