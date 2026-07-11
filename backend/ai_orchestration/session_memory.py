import json
import logging
from ai_orchestration.memory_cache import system_cache

logger = logging.getLogger("nexora_session_memory")

class SessionChatHistory:
    """
    Manages user chat conversation history, stored in the Redis memory cache.
    """
    def __init__(self, max_history: int = 15):
        self.max_history = max_history

    def _get_key(self, session_id: str) -> str:
        return f"chat_history:{session_id}"

    def add_message(self, session_id: str, sender: str, text: str):
        key = self._get_key(session_id)
        history = self.get_history(session_id)
        
        # Add new message
        history.append({"sender": sender, "text": text})
        
        # Trim history
        if len(history) > self.max_history:
            history = history[-self.max_history:]
            
        try:
            system_cache.set(key, json.dumps(history))
        except Exception as e:
            logger.error(f"Failed to save chat history to cache: {e}")

    def get_history(self, session_id: str) -> list:
        key = self._get_key(session_id)
        try:
            val = system_cache.get(key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.error(f"Failed to retrieve chat history from cache: {e}")
        return []

    def clear_history(self, session_id: str):
        key = self._get_key(session_id)
        system_cache.delete(key)


class SessionEntityMemory:
    """
    Manages extracted entities and context variables, stored in the Redis memory cache.
    """
    def _get_key(self, session_id: str) -> str:
        return f"chat_entities:{session_id}"

    def save_entities(self, session_id: str, entities: dict):
        key = self._get_key(session_id)
        current = self.get_entities(session_id)
        # Update existing entities with new ones
        current.update(entities)
        try:
            system_cache.set(key, json.dumps(current))
        except Exception as e:
            logger.error(f"Failed to save entities to cache: {e}")

    def save_entity(self, session_id: str, name: str, value: str):
        self.save_entities(session_id, {name: value})

    def get_entities(self, session_id: str) -> dict:
        key = self._get_key(session_id)
        try:
            val = system_cache.get(key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.error(f"Failed to retrieve entities from cache: {e}")
        return {}

    def clear_entities(self, session_id: str):
        key = self._get_key(session_id)
        system_cache.delete(key)

    def find_entity_value(self, session_id: str, name: str) -> str:
        entities = self.get_entities(session_id)
        return entities.get(name)


# Instantiated memory models
session_history = SessionChatHistory()
session_entities = SessionEntityMemory()
