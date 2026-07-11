import logging
from typing import Dict, Any, Optional
from services.whatsapp_service import WhatsAppService
from services.email_service import EmailService

logger = logging.getLogger("notification_service")

class NotificationService:
    @staticmethod
    def send_broadcast_refresh(event_type: str):
        """
        Triggers real-time screen reload signals via WebSockets for the UI.
        """
        try:
            ws_mapping = {
                "EXPENSE_ADDED": "expense_change",
                "EXPENSE_EDITED": "expense_change",
                "EXPENSE_DELETED": "expense_change",
                "RECEIPT_ADDED": "financial_change",
                "RECEIPT_EDITED": "financial_change",
                "RECEIPT_DELETED": "financial_change",
                "WALLET_CREATED": "wallet_change",
                "WALLET_FUNDED": "wallet_change",
                "WALLET_DEDUCTED": "wallet_change",
                "INVENTORY_ADDED": "inventory_change",
                "INVENTORY_UPDATED": "inventory_change",
                "INVENTORY_DELETED": "inventory_change",
                "STOCK_RECEIVED": "inventory_change",
                "STOCK_ISSUED": "inventory_change",
                "PURCHASE_APPROVED": "purchase_change",
                "EMPLOYEE_CREATED": "employee_change",
                "ATTENDANCE_MARKED": "attendance_change",
                "PROJECT_UPDATED": "project_change",
                "BARCODE_SCANNED": "inventory_change",
                "REPORT_GENERATED": "financial_change"
            }
            ws_event = ws_mapping.get(event_type)
            if ws_event:
                from main import broadcast_sync
                broadcast_sync({"event": ws_event})
                logger.info(f"[WebSocket Sync] Fired reload signal '{ws_event}' for event type '{event_type}'")
        except Exception as e:
            logger.error(f"[WebSocket Sync] Broadcast failed: {e}")

    @staticmethod
    def dispatch_alert(category: str, message: str, mail_recipient: Optional[str] = None):
        """
        Orchestrates multi-channel outward dispatches (WhatsApp Business messages and email notifications).
        """
        # WhatsApp Cloud API triggers
        WhatsAppService.send_alert("owner", category, message)
        WhatsAppService.send_alert("manager", category, message)
        WhatsAppService.send_alert("super_admin", category, message)
        
        # Email alerts
        if mail_recipient:
            try:
                subject = f"🔔 Allure Living ERP Alert: {category.upper()}"
                EmailService.send_low_stock_alert(mail_recipient, category, 0.0, 0.0)
            except Exception as e:
                logger.error(f"[Notification Service] Failed to send email alert: {e}")
