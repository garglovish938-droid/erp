import logging
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from services.event_service import EventService, ERPEvent
from services.notification_service import NotificationService
from services.langflow_service import LangflowService
from ai_orchestration.gemini_client import query_gemini_with_context

logger = logging.getLogger("automation_service")

class AutomationService:
    @staticmethod
    def initialize():
        """
        Registers the AutomationService callback as a subscriber to the Event Bus.
        """
        EventService.subscribe(AutomationService.handle_event)
        logger.info("AutomationService initialized and subscribed to ERP Event Bus.")

    @staticmethod
    def handle_event(event: ERPEvent):
        """
        Subscriber callback: Receives the event, gates access (RBAC), maps workflow,
        invokes Gemini reasoning, pushes WebSocket reloads, and generates audit logs.
        """
        logger.info(f"[Automation Coordinator] Processing event: {event.event_type} | Correlation ID: {event.correlation_id}")
        
        # 1. RBAC Permission Checks
        sensitive_events = ["WALLET_FUNDED", "WALLET_DEDUCTED", "RECEIPT_DELETED"]
        if event.event_type in sensitive_events:
            user_role = event.user.get("role", "guest")
            if user_role not in ["admin", "factory_manager"]:
                logger.warning(f"[Security Alert] Unauthorized event execution block. User: {event.user.get('name')} | Role: {user_role}")
                return
                
        # 2. Workflow Mapping Selection
        flow_mapping = {
            "STOCK_RECEIVED": "flow_1_inventory",
            "STOCK_ISSUED": "flow_1_inventory",
            "EXPENSE_ADDED": "flow_4_expense",
            "WALLET_FUNDED": "flow_5_wallet",
            "RECEIPT_ADDED": "flow_7_receipt",
            "ATTENDANCE_MARKED": "flow_10_attendance",
            "PROJECT_UPDATED": "flow_8_project",
            "PURCHASE_APPROVED": "flow_17_approval"
        }
        flow_id = flow_mapping.get(event.event_type, "flow_20_assistant")
        
        db = SessionLocal()
        try:
            # 3. Gemini Reasoning Integration
            context = f"ERP Event: {event.event_type}\nUser Context: {event.user}\nPayload details: {event.payload}"
            prompt = "Analyze if this event presents operational risks or requires management action."
            gemini_analysis = query_gemini_with_context(prompt, context)
            
            if gemini_analysis:
                logger.info(f"[Automation Reasoning Summary]: {gemini_analysis}")
                # Check for critical keywords
                lower_ans = gemini_analysis.lower()
                if "risk" in lower_ans or "warning" in lower_ans or "critical" in lower_ans:
                    NotificationService.dispatch_alert("critical_risk", f"AI Alert: {gemini_analysis}")
            
            # 4. WebSocket sync pushes
            NotificationService.send_broadcast_refresh(event.event_type)
            
            # 5. DB Audit Logs Generation
            audit_log = models.ActivityLog(
                user_id=event.user.get("id"),
                action=event.event_type,
                details=f"Event ID: {event.event_id} | Correlation ID: {event.correlation_id} | Context: {event.payload}"
            )
            db.add(audit_log)
            db.commit()
            
            # 6. Trigger n8n Automation Webhook
            from ai_orchestration.automation_coordinator import trigger_database_event_webhook
            trigger_database_event_webhook(
                event_type=event.event_type,
                details={
                    "event_id": event.event_id,
                    "correlation_id": event.correlation_id,
                    "user": event.user,
                    "module": event.module,
                    "payload": event.payload,
                    "timestamp": event.timestamp
                }
            )
            
        except Exception as e:
            logger.error(f"[Automation Coordinator] Event processing failure: {e}", exc_info=True)
        finally:
            db.close()
