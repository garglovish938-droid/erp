import uuid
from datetime import datetime, UTC
from typing import Callable, List, Dict, Any, Optional
import logging
import contextvars

logger = logging.getLogger("event_service")

# Async/thread-safe request tracking context variable
correlation_id_var = contextvars.ContextVar("correlation_id", default=None)

class ERPEvent:
    def __init__(
        self, 
        event_id: str, 
        timestamp: str, 
        user: Dict[str, Any], 
        module: str, 
        event_type: str, 
        payload: Dict[str, Any], 
        correlation_id: str
    ):
        self.event_id = event_id
        self.timestamp = timestamp
        self.user = user
        self.module = module
        self.event_type = event_type
        self.payload = payload
        self.correlation_id = correlation_id

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp,
            "user": self.user,
            "module": self.module,
            "event_type": self.event_type,
            "payload": self.payload,
            "correlation_id": self.correlation_id
        }

# Thread-safe in-memory subscriber collection
_subscribers: List[Callable[[ERPEvent], None]] = []

class EventService:
    @staticmethod
    def subscribe(callback: Callable[[ERPEvent], None]):
        """
        Registers a callback subscriber to receive all published events.
        """
        if callback not in _subscribers:
            _subscribers.append(callback)
            logger.info(f"Subscribed callback: {callback.__name__ if hasattr(callback, '__name__') else callback}")

    @staticmethod
    def unsubscribe(callback: Callable[[ERPEvent], None]):
        if callback in _subscribers:
            _subscribers.remove(callback)
            logger.info(f"Unsubscribed callback: {callback.__name__ if hasattr(callback, '__name__') else callback}")

    @staticmethod
    def publish(
        event_type: str,
        user: Dict[str, Any],
        module: str,
        payload: Dict[str, Any],
        correlation_id: Optional[str] = None
    ) -> ERPEvent:
        """
        Creates and broadcasts an event to all subscribers.
        """
        event_id = str(uuid.uuid4())
        timestamp = datetime.now(UTC).isoformat()
        
        # Ensure we always have a tracking ID
        final_corr_id = correlation_id or correlation_id_var.get() or str(uuid.uuid4())
        
        # Standardize User payload structure
        user_dict = {
            "id": user.get("id") or user.get("user_id") or "system",
            "name": user.get("name") or user.get("full_name") or user.get("email") or "System",
            "role": user.get("role") or "system"
        }
        
        event = ERPEvent(
            event_id=event_id,
            timestamp=timestamp,
            user=user_dict,
            module=module,
            event_type=event_type,
            payload=payload,
            correlation_id=final_corr_id
        )
        
        logger.info(f"[EVENT PUBLISH] Type: {event_type} | Correlation ID: {final_corr_id} | Module: {module}")
        
        # Broadcast to all registered handlers
        for sub in _subscribers:
            try:
                sub(event)
            except Exception as e:
                logger.error(f"Subscriber notification failed for {sub}: {e}", exc_info=True)
                
        return event
