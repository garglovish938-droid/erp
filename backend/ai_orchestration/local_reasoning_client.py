import requests
import json
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
        "You are Nexora AI, Allure Living ERP Manager. Base responses on database context. Never hallucinate. "
        "For greetings (e.g. 'hello', 'helo', 'kya hal hai'), reply with a warm, brief (under 10 words) Hinglish greeting (e.g., 'Hello dost, kaise ho? How can I help you?')."
    )

    messages = [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": f"Database Context:\n{context}\n\nUser Query: {prompt}"}
    ]

    payload = {
        "model": model,
        "messages": messages,
        "stream": True
    }

    headers = {
        "Content-Type": "application/json",
        "Bypass-Tunnel-Reminder": "true"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=45, stream=True)
        if response.status_code == 200:
            full_response = ""
            for line in response.iter_lines():
                if line:
                    chunk = json.loads(line.decode('utf-8'))
                    content = chunk.get("message", {}).get("content", "")
                    full_response += content
            return full_response.strip()
        else:
            logger.warning(f"Local reasoning server returned status code {response.status_code}")
            return None
    except Exception as e:
        logger.warning(f"Local reasoning query failed: {e}")
        return None
