import logging
import requests
from config import settings

logger = logging.getLogger("langflow_service")

class LangflowService:
    @staticmethod
    def execute_workflow(flow_id: str, message: str) -> dict:
        """
        Executes a Langflow visual workflow using the Langflow REST client.
        Falls back to local resolvers if Langflow is offline.
        """
        payload = {
            "input_value": message,
            "output_type": "chat",
            "input_type": "chat"
        }
        
        langflow_url = getattr(settings, "LANGFLOW_API_URL", "http://127.0.0.1:7860")
        if not langflow_url:
            langflow_url = "http://127.0.0.1:7860"
        
        base_url = langflow_url.rstrip("/")
        if "/api/v1/run" in base_url:
            api_endpoint = f"{base_url}/{flow_id}"
        elif "/api/v1" in base_url:
            api_endpoint = f"{base_url}/run/{flow_id}"
        else:
            api_endpoint = f"{base_url}/api/v1/run/{flow_id}"
        
        try:
            logger.info(f"Posting request to Langflow API endpoint: {api_endpoint}")
            # Quick post with timeout to prevent blocking thread
            response = requests.post(api_endpoint, json=payload, timeout=3)
            if response.status_code == 200:
                logger.info(f"Langflow flow {flow_id} executed successfully.")
                return {
                    "status": "success",
                    "result": response.json().get("outputs", [{}])[0].get("outputs", [{}])[0].get("results", {}).get("message", {}).get("text", "")
                }
            else:
                logger.warning(f"Langflow returned status {response.status_code}: {response.text}")
        except Exception as e:
            logger.warning(f"Langflow HTTP request failed: {e}. Falling back to internal resolver engine.")

        # Fallback to local AIOrchestrator resolver
        try:
            from ai_orchestration.orchestrator import AIOrchestrator
            from database import SessionLocal
            db = SessionLocal()
            try:
                orch = AIOrchestrator(db, "admin", "System", "system")
                res = orch.resolve_locally(flow_id, message)
                return {"status": "success", "result": res.get("response") if isinstance(res, dict) else str(res)}
            finally:
                db.close()
        except Exception as ex:
            logger.error(f"Fallback workflow execution failed: {ex}")
            return {"status": "error", "message": str(ex)}
