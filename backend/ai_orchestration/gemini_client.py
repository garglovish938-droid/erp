import requests
from config import settings

def query_gemini_with_context(prompt: str, context: str) -> str:
    """
    Sends a query to the Google Gemini API (gemini-1.5-flash or gemini-2.5-flash)
    with database context for advanced reasoning, forecasting, and recommendations.
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return None

    # Use gemini-1.5-flash by default as it is standard and fast
    model = "gemini-1.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1/models/{model}:generateContent?key={api_key}"

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
        "contents": [
            {
                "parts": [
                    {
                        "text": full_prompt
                    }
                ]
            }
        ]
    }

    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        if response.status_code == 200:
            data = response.json()
            try:
                text_out = data["candidates"][0]["content"]["parts"][0]["text"]
                return text_out.strip()
            except (KeyError, IndexError) as ke:
                print(f"[Gemini Client] Failed to parse response JSON keys: {ke}. Data: {data}")
                return None
        else:
            print(f"[Gemini Client] Non-200 response returned: status {response.status_code}. Details: {response.text}")
            return None
    except Exception as e:
        print(f"[Gemini Client] Connection exception encountered: {e}")
        return None

