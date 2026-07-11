import requests
import logging
from datetime import date
from config import settings

logger = logging.getLogger("nexora_automation")

def trigger_automation_webhook(flow_id: str, user_name: str, user_role: str, message: str, context: str) -> str:
    """
    Sends execution request payload to the automation coordinator webhook engine.
    """
    webhook_url = settings.N8N_WEBHOOK_URL
    if not webhook_url:
        logger.info("Automation webhook skipped: No webhook URL configured.")
        return "skipped"
        
    payload = {
        "flow_id": flow_id,
        "user_name": user_name,
        "user_role": user_role,
        "message": message,
        "context": context,
        "timestamp": date.today().isoformat()
    }
    
    try:
        response = requests.post(webhook_url, json=payload, timeout=5)
        if response.status_code in [200, 201]:
            logger.info(f"Automation webhook triggered successfully for {flow_id}.")
            return "triggered"
        else:
            logger.warning(f"Automation webhook returned status code {response.status_code}")
            return f"failed_status_{response.status_code}"
    except Exception as e:
        logger.error(f"Automation webhook connection failed: {e}")
        return f"error: {str(e)}"

def trigger_database_event_webhook(event_type: str, details: dict) -> str:
    """
    Triggers webhooks for real-time database event logs.
    """
    webhook_url = settings.N8N_WEBHOOK_URL
    if not webhook_url:
        return "skipped"
        
    payload = {
        "event_type": event_type,
        "details": details,
        "timestamp": date.today().isoformat(),
        "is_database_event": True
    }
    
    try:
        response = requests.post(webhook_url, json=payload, timeout=5)
        if response.status_code in [200, 201]:
            return "triggered"
        return f"failed_status_{response.status_code}"
    except Exception as e:
        return f"error: {str(e)}"

def trigger_owner_reporting_webhook(report_type: str, report_data: dict) -> str:
    """
    Triggers webhooks specifically for daily/weekly owner reports.
    """
    webhook_url = settings.N8N_WEBHOOK_URL
    if not webhook_url:
        return "skipped"
        
    payload = {
        "report_type": report_type,
        "data": report_data,
        "timestamp": date.today().isoformat(),
        "is_owner_report": True
    }
    
    try:
        response = requests.post(webhook_url, json=payload, timeout=5)
        if response.status_code in [200, 201]:
            return "triggered"
        return f"failed_status_{response.status_code}"
    except Exception as e:
        return f"error: {str(e)}"
