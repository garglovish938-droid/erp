import os
import sys
import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_orchestration.session_memory import session_history, session_entities
from ai_orchestration.memory_cache import system_cache

def test_session_chat_history():
    system_cache.clear()
    session_id = "test_user_session_1"
    
    # Empty history
    assert session_history.get_history(session_id) == []
    
    # Add messages
    session_history.add_message(session_id, "user", "Show stock levels")
    session_history.add_message(session_id, "ai", "Stock is optimal")
    
    history = session_history.get_history(session_id)
    assert len(history) == 2
    assert history[0]["sender"] == "user"
    assert history[0]["text"] == "Show stock levels"
    assert history[1]["sender"] == "ai"
    assert history[1]["text"] == "Stock is optimal"
    
    # Clear
    session_history.clear_history(session_id)
    assert session_history.get_history(session_id) == []

def test_session_entities():
    system_cache.clear()
    session_id = "test_user_session_2"
    
    # Empty entities
    assert session_entities.get_entities(session_id) == {}
    
    # Save entity
    session_entities.save_entity(session_id, "material", "HDHMR Plywood")
    assert session_entities.find_entity_value(session_id, "material") == "HDHMR Plywood"
    
    # Save multiple entities
    session_entities.save_entities(session_id, {"project": "Allure Living Main", "quantity": 100})
    
    entities = session_entities.get_entities(session_id)
    assert entities["material"] == "HDHMR Plywood"
    assert entities["project"] == "Allure Living Main"
    assert entities["quantity"] == 100
    
    # Clear
    session_entities.clear_entities(session_id)
    assert session_entities.get_entities(session_id) == {}
