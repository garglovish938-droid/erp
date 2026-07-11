import os
import sys
import pytest
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_orchestration.memory_cache import system_cache

def test_cache_basic_operations():
    # Clear cache first
    system_cache.clear()
    
    # Assert get on non-existent key is None
    assert system_cache.get("test_key") is None
    
    # Assert set works
    assert system_cache.set("test_key", "test_value") is True
    assert system_cache.get("test_key") == "test_value"
    
    # Assert delete works
    assert system_cache.delete("test_key") is True
    assert system_cache.get("test_key") is None

def test_cache_expiration():
    system_cache.clear()
    
    # Set with 1 second expiry
    assert system_cache.set("expire_key", "expire_value", expire=1) is True
    assert system_cache.get("expire_key") == "expire_value"
    
    # Wait for 1.5 seconds
    time.sleep(1.5)
    
    # Key should be expired now
    assert system_cache.get("expire_key") is None
