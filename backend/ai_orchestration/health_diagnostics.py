import logging
import requests
from sqlalchemy.orm import Session
from sqlalchemy import text
import redis

from config import settings

logger = logging.getLogger("nexora_health")

def check_database_health(db: Session) -> dict:
    """
    Checks relational ledger database connectivity status.
    """
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "details": "Relational database connection active."}
    except Exception as e:
        logger.error(f"Database health diagnostics check failed: {e}")
        return {"status": "unhealthy", "details": str(e)}

def check_redis_health() -> dict:
    """
    Checks cache memory buffer database connectivity status.
    """
    try:
        client = redis.from_url(settings.REDIS_URL, socket_timeout=3)
        client.ping()
        return {"status": "healthy", "details": "Redis memory cache server active."}
    except Exception as e:
        logger.error(f"Redis memory cache health diagnostics check failed: {e}")
        return {"status": "unhealthy", "details": str(e)}

def check_langflow_health() -> dict:
    """
    Checks Workflow Graph server health status.
    """
    if not settings.LANGFLOW_API_URL:
        return {"status": "unconfigured", "details": "Langflow API URL settings is blank."}
        
    try:
        # Resolve base URL from API URL
        base_url = settings.LANGFLOW_API_URL.split("/api")[0]
        # Common Langflow health check endpoint
        health_url = f"{base_url}/health"
        response = requests.get(health_url, timeout=3)
        if response.status_code == 200:
            return {"status": "healthy", "details": "Langflow Workflow Graph server active."}
        return {"status": "degraded", "details": f"Langflow server returned HTTP {response.status_code}."}
    except Exception as e:
        logger.error(f"Langflow server health diagnostics check failed: {e}")
        return {"status": "unhealthy", "details": str(e)}

def check_ollama_health() -> dict:
    """
    Checks Ollama local reasoning server connectivity.
    """
    if not settings.OLLAMA_URL:
        return {"status": "unconfigured", "details": "Ollama url setting is blank."}
    try:
        # Get base Ollama url
        base_url = settings.OLLAMA_URL.split("/api")[0]
        response = requests.get(base_url, timeout=3)
        if response.status_code == 200 or "Ollama is running" in response.text:
            return {"status": "healthy", "details": "Ollama local reasoning server active."}
        return {"status": "degraded", "details": f"Ollama base URL returned status code {response.status_code}."}
    except Exception as e:
        logger.error(f"Ollama health diagnostics check failed: {e}")
        return {"status": "unhealthy", "details": str(e)}

def check_n8n_health() -> dict:
    """
    Checks n8n automation webhook server connectivity.
    """
    if not settings.N8N_WEBHOOK_URL:
        return {"status": "unconfigured", "details": "n8n Webhook URL setting is blank."}
    try:
        response = requests.get(settings.N8N_WEBHOOK_URL, timeout=3)
        # Webhook GET might return 404/405 or 200, which confirms server is listening
        if response.status_code in [200, 404, 405]:
            return {"status": "healthy", "details": "n8n automation webhook server active."}
        return {"status": "degraded", "details": f"n8n server returned status code {response.status_code}."}
    except Exception as e:
        logger.error(f"n8n health diagnostics check failed: {e}")
        return {"status": "unhealthy", "details": str(e)}

def run_diagnostics_audit(db: Session) -> dict:
    """
    Runs unified system diagnostics audits.
    """
    db_status = check_database_health(db)
    redis_status = check_redis_health()
    langflow_status = check_langflow_health()
    ollama_status = check_ollama_health()
    n8n_status = check_n8n_health()
    
    overall_status = "healthy"
    if db_status["status"] == "unhealthy" or redis_status["status"] == "unhealthy":
        overall_status = "unhealthy"
        
    return {
        "status": overall_status,
        "database": db_status,
        "redis_cache": redis_status,
        "workflow_graph": langflow_status,
        "local_reasoning": ollama_status,
        "automation_webhook": n8n_status
    }
