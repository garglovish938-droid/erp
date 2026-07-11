# Nexora AI - ERP Integration Guide
This guide explains how to connect Nexora AI (the ERP Orchestrator) in real-time to Google Gemini, Langflow, and n8n automations.

---

## 1. Google Gemini API Setup (Advanced Reasoning)

Gemini is used for forecasting, complex trend analyses, root-cause analysis, and generating recommendations.

### Setup Instructions:
1. Obtain a Gemini API Key from the Google AI Studio: [https://aistudio.google.com/](https://aistudio.google.com/)(https://aistudio.google.com/).
2. Set the environment variable in your server configuration (or Railway variables tab, or local `.env` configuration file):
   ```env
   GEMINI_API_KEY=your_google_gemini_api_key_here
   ```
3. Restart the FastAPI backend.
4. **Validation:** Any queries asking for predictions, forecasts, or optimization recommendations (e.g., *"HDHMR sheet ka shortage predict karo"* or *"Expenses optimize karne ke suggestions do"*) will automatically query Gemini using the live database context.

---

## 2. Langflow Configuration (Intent Classifier Flow)

Langflow operates as the modular Workflow Orchestrator. 

### Local / Cloud Setup:
1. Run Langflow locally via Docker:
   ```bash
   docker run -p 7860:7860 langflowai/langflow:latest
   ```
   Or use Langflow Cloud.
2. Define a Flow where:
   - **Input:** Takes the raw user message.
   - **Intent Classifier:** Parses the intent and tags it into one of the 15 flows (`flow_1_inventory` through `flow_15_audit`).
   - **Output:** Returns a structured payload or chat message.
3. Configure the following environment variables in the ERP backend to route messages through Langflow:
   ```env
   LANGFLOW_API_URL=http://localhost:7860/api/v1/run
   LANGFLOW_FLOW_ID=your-registered-flow-uuid
   LANGFLOW_API_KEY=your-langflow-api-token-if-authenticated
   ```
4. If Langflow is offline or unconfigured, the system automatically runs the local SQLA Intent Resolver as a fallback.

---

## 3. n8n Automation Setup (Actions Engine)

n8n performs transactional execution tasks (sending emails, Google Sheets syncing, WhatsApp notifications, PDF invoice exports).

### Integration Steps:
1. Run n8n locally:
   ```bash
   docker run -d --name n8n -p 5678:5678 n8nio/n8n:latest
   ```
2. Create a new Workflow in n8n starting with a **Webhook node**:
   - **Method:** `POST`
   - **Path:** `/erp-webhook`
3. Add router branches inside n8n depending on the incoming `flow_id` and action:
   - **Branch 1 (flow_9_notification):** Sends WhatsApp/Email messages.
   - **Branch 2 (flow_8_reporting):** Triggers PDF or Excel compilation and stores it to Google Drive.
4. Set the webhook url in the ERP backend:
   ```env
   N8N_WEBHOOK_URL=http://localhost:5678/webhook/erp-webhook
   ```
5. When a user requests an automation task, the FastAPI backend will post the following payload to n8n:
   ```json
   {
     "flow_id": "flow_9_notification",
     "user_name": "Orch Admin",
     "user_role": "admin",
     "message": "Send notification to Amit Vendor about delayed invoice",
     "context": "Amit Vendor payment is overdue. Total balance: ₹50,000",
     "timestamp": "2026-07-09"
   }
   ```

---

## 4. Unified Container Orchestration (Production Setup)

For production deployment or to bypass local Python environment and dependency issues, use the integrated container orchestration configuration.

### Stack Definition:
1. **Core Database:** PostgreSQL 15 (relational ledger store).
2. **Memory Cache:** Redis 7 (stores chat sequences and entity variables).
3. **Core Server Engine:** FastAPI application (exposed on port `8000`).
4. **Operations Interface:** Next.js application (exposed on port `3000`).
5. **Gateway Routing:** Nginx proxy (exposed on port `80`).
6. **Workflow Orchestrator:** Langflow (exposed on port `7860`).
7. **Local Intelligence Server:** Ollama (exposed on port `11434`).
8. **Automation Engine:** n8n (exposed on port `5678`).

### Launching the Stack:
Execute the orchestration launch command:
```bash
docker-compose up --build -d
```
All system interface linkages (Gemini keys, local model URLs, webhook routing, flow IDs) are automatically connected inside the container network.
