import sys
import os
import uvicorn
from fastapi import FastAPI, Depends, Body
from sqlalchemy.orm import Session

# Append current directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
import models
from ai_orchestration.orchestrator import AIOrchestrator
from ai_orchestration.session_memory import session_history

app = FastAPI(title="Nexora AI Langflow Emulator", version="1.0")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/api/v1/run/{flow_id}")
def run_flow(flow_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Emulates the Langflow graph execution endpoint.
    Runs the modular pipeline: Memory -> Intent -> Planner -> Capabilities Router -> Response.
    """
    input_value = payload.get("input_value", "")
    tweaks = payload.get("tweaks", {})
    flow_context = tweaks.get("FlowContext", {})
    
    user_role = flow_context.get("user_role", "worker")
    user_name = flow_context.get("user_name", "System User")
    session_id = flow_context.get("session_id", f"session_{user_name.replace(' ', '_').lower()}")
    
    # Initialize orchestrator to resolve capabilities locally
    orchestrator = AIOrchestrator(db, user_role=user_role, user_name=user_name)
    
    # Resolve capability tool locally or query fallback chains
    result = orchestrator.resolve_locally(flow_id, input_value)
    reply_text = result.get("response", "Execution completed.")
    
    # Update memory history
    session_history.add_message(session_id, "user", input_value)
    session_history.add_message(session_id, "ai", reply_text)
    
    # Return standard Langflow output envelope
    return {
        "outputs": [
            {
                "outputs": [
                    {
                        "results": {
                          "message": {
                            "text": reply_text
                          }
                        }
                    }
                ]
            }
        ]
    }

def main():
    print("Starting Langflow Runtime Emulator on http://localhost:7860...")
    uvicorn.run(app, host="127.0.0.1", port=7860)

if __name__ == "__main__":
    main()
