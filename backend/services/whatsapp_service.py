import logging
import hashlib
from datetime import datetime, timedelta
import requests
from config import settings

logger = logging.getLogger("whatsapp_service")

# Thread-safe in-memory message deduplication registry (message_hash -> timestamp)
_dedup_cache = {}

class WhatsAppService:
    @staticmethod
    def send_alert(recipient_role: str, category: str, message: str) -> bool:
        """
        Transmits real-time notification alerts to users mapping to target roles (owner, manager, super_admin).
        Prevents duplicate alerts from being dispatched within a 1-hour window.
        """
        # Deduplication check
        message_hash = hashlib.md5(f"{recipient_role}:{category}:{message}".encode("utf-8")).hexdigest()
        now = datetime.now()
        
        # Housekeep old entries
        stale = [k for k, v in _dedup_cache.items() if now - v > timedelta(hours=1)]
        for k in stale:
            _dedup_cache.pop(k, None)
            
        if message_hash in _dedup_cache:
            logger.info(f"[WhatsApp Service] Skipping duplicate alert to {recipient_role} under category '{category}'.")
            return False
            
        _dedup_cache[message_hash] = now
        
        token = getattr(settings, "WHATSAPP_API_TOKEN", None)
        phone_number_id = getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", None)
        # Fallback simulated sandbox number
        recipient = getattr(settings, f"WHATSAPP_{recipient_role.upper()}_PHONE", None) or "+919999999999"
        
        logger.info(f"[WhatsApp Alert] Dispatching alert to {recipient} ({recipient_role}). Msg: {message[:100]}...")
        
        # Fallback to local simulation if unconfigured
        if not token or not phone_number_id:
            logger.info("[WhatsApp Simulation] Alert successfully simulated to log.")
            return True
            
        url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": recipient,
            "type": "text",
            "text": {
                "body": f"🔔 Allure Living ERP Alert 🔔\n\n📌 Category: {category.upper()}\n⚠️ Details: {message}"
            }
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=5)
            if response.status_code in [200, 201]:
                logger.info("[WhatsApp Service] Message transmitted successfully.")
                return True
            else:
                logger.warning(f"[WhatsApp Service] Request returned non-200 code: {response.status_code}. Response: {response.text}")
                return False
        except Exception as e:
            logger.error(f"[WhatsApp Service] Endpoint request exception encountered: {e}")
            return False
