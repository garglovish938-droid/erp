import requests
import logging
from config import settings

logger = logging.getLogger("nexora_local_reasoning")

def query_local_reasoning(prompt: str, context: str) -> str:
    """
    Sends a query to the local offline intelligence service (Ollama chat API)
    with database context for offline fallback reasoning.
    """
    url = settings.OLLAMA_URL
    if url and url.endswith("/api/generate"):
        url = url.replace("/api/generate", "/api/chat")
    elif url and not url.endswith("/api/chat"):
        url = f"{url.rstrip('/')}/api/chat"
        
    model = settings.OLLAMA_MODEL
    
    if not url:
        return None
        
    system_instruction = (
        "You are Nexora AI, the autonomous ERP Operations Manager for Allure Living Furniture Manufacturing. "
        "You analyze natural language queries and database context. "
        "Always base your responses on the provided database context. Never hallucinate numbers. "
        "Formulate professional, natural, concise, and actionable summaries or recommendations. "
        "If the user query is a simple greeting or general inquiry (e.g. 'hello', 'helo', 'kya hal hai'), respond with a warm, extremely brief (under 15 words) Hinglish greeting. "
        "Never mention internal API routes, JSON structures, or database schemas. "
        "CRITICAL: Always reply in English, Hinglish, or Hindi. Never output responses in Chinese."
    )

    messages = [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": f"Database Context:\n{context}\n\nUser Query: {prompt}"}
    ]

    payload = {
        "model": model,
        "messages": messages,
        "stream": False
    }

    headers = {
        "Content-Type": "application/json",
        "Bypass-Tunnel-Reminder": "true"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=45)
        if response.status_code == 200:
            data = response.json()
            return data.get("message", {}).get("content", "").strip()
        else:
            logger.warning(f"Local reasoning server returned status code {response.status_code}")
            return None
    except Exception as e:
        logger.warning(f"Local reasoning query failed: {e}")
        return None
