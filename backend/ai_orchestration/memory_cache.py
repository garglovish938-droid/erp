import time
import logging
from config import settings

logger = logging.getLogger("nexora_cache")

class MemoryCache:
    """
    Production-ready memory cache client.
    Connects to Redis based on REDIS_URL configuration,
    and falls back to local dictionary caching if Redis is offline or unconfigured.
    """
    def __init__(self):
        self._local_cache = {}
        self._redis_client = None
        self._redis_enabled = False
        
        redis_url = settings.REDIS_URL
        if redis_url:
            try:
                import redis
                # Parse connections
                self._redis_client = redis.Redis.from_url(
                    redis_url, 
                    decode_responses=True,
                    socket_connect_timeout=2.0,
                    socket_timeout=2.0
                )
                # Test connection (ping)
                self._redis_client.ping()
                self._redis_enabled = True
                logger.info("Successfully connected to Redis cache database.")
            except Exception as e:
                logger.warning(f"Redis cache connection failed: {e}. Falling back to in-memory cache.")
                self._redis_client = None
                self._redis_enabled = False

    def get(self, key: str) -> str:
        if self._redis_enabled and self._redis_client:
            try:
                return self._redis_client.get(key)
            except Exception as e:
                logger.warning(f"Redis get operation failed: {e}. Falling back to local cache.")
                # Fallback to local cache read
                
        # Read from local dictionary
        val, expiry = self._local_cache.get(key, (None, None))
        if expiry and time.time() > expiry:
            # Expired
            self._local_cache.pop(key, None)
            return None
        return val

    def set(self, key: str, value: str, expire: int = None) -> bool:
        if self._redis_enabled and self._redis_client:
            try:
                if expire:
                    self._redis_client.setex(key, expire, value)
                else:
                    self._redis_client.set(key, value)
                return True
            except Exception as e:
                logger.warning(f"Redis set operation failed: {e}. Falling back to local cache.")
                
        # Write to local dictionary
        expiry = time.time() + expire if expire else None
        self._local_cache[key] = (value, expiry)
        return True

    def delete(self, key: str) -> bool:
        if self._redis_enabled and self._redis_client:
            try:
                self._redis_client.delete(key)
                return True
            except Exception as e:
                logger.warning(f"Redis delete operation failed: {e}. Falling back to local cache.")
                
        if key in self._local_cache:
            del self._local_cache[key]
            return True
        return False

    def clear(self) -> bool:
        if self._redis_enabled and self._redis_client:
            try:
                self._redis_client.flushdb()
                return True
            except Exception as e:
                logger.warning(f"Redis clear operation failed: {e}. Falling back to local cache.")
                
        self._local_cache.clear()
        return True

# Singleton cache instance
system_cache = MemoryCache()
