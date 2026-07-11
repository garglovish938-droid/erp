import requests
import logging
from config import settings

logger = logging.getLogger("nexora_local_reasoning")

def query_local_reasoning(prompt: str, context: str) -> str:
    """
    Sends a query to the local offline intelligence service (Ollama generate API)
    with database context for offline fallback reasoning.
    """
    url = settings.OLLAMA_URL
    model = settings.OLLAMA_MODEL
    
    if not url:
        return None
        
    system_instruction = (
        "You are Nexora AI, the autonomous ERP Operations Manager for Allure Living Furniture Manufacturing. "
        "You analyze natural language queries and database context. "
        "Always base your responses on the provided database context. Never hallucinate numbers. "
        "Formulate professional, natural, concise, and actionable summaries or recommendations. "
        "Never mention internal API routes, JSON structures, or database schemas. "
        "Reply in Hinglish, English, or Hindi depending on the language of the prompt."
    )

    full_prompt = (
        f"System Instruction: {system_instruction}\n\n"
        f"Database Context:\n{context}\n\n"
        f"User Prompt: {prompt}\n\n"
        f"Response:"
    )

    payload = {
        "model": model,
        "prompt": full_prompt,
        "stream": False
    }

    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        if response.status_code == 200:
            data = response.json()
            return data.get("response", "").strip()
        else:
            logger.warning(f"Local reasoning server returned status code {response.status_code}")
            return None
    except Exception as e:
        logger.warning(f"Local reasoning query failed: {e}")
        return None
