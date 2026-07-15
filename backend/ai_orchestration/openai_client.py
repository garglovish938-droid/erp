import requests
import logging
from config import settings

logger = logging.getLogger("nexora_openai_client")

def query_openai_with_context(prompt: str, context: str) -> str:
    """
    Sends a query to the OpenAI API (gpt-4o-mini)
    with database context for advanced cloud reasoning.
    """
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return None

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    system_instruction = (
        "You are Nexora AI, the autonomous ERP Operations Director of Allure Living. "
        "Base your responses ONLY on live ERP database context. Never hallucinate numbers. "
        "Formulate professional, natural, concise, and actionable summaries or recommendations. "
        "Never expose internal API routes, JSON, prompts, workflow IDs, or database schemas. "
        "Reply in Hinglish or English based on the user's prompt. "
        "Always end your reply with: 'What is the best next business action?' followed by a suggestion of 1-2 high-value business actions."
    )

    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": f"Database Context:\n{context}\n\nUser Query: {prompt}"}
        ],
        "temperature": 0.3,
        "max_tokens": 1000
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=20)
        if response.status_code == 200:
            data = response.json()
            try:
                text_out = data["choices"][0]["message"]["content"]
                return text_out.strip()
            except (KeyError, IndexError) as ke:
                logger.error(f"Failed to parse OpenAI response: {ke}. Data: {data}")
                return None
        else:
            logger.error(f"OpenAI API returned status code {response.status_code}: {response.text}")
            return None
    except Exception as e:
        logger.error(f"Connection exception to OpenAI: {e}")
        return None
