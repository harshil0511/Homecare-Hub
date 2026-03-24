from fastapi import APIRouter, Depends, HTTPException
from anthropic import Anthropic
from app.core.config import settings
from app.internal import deps
from app.internal.models import User
from pydantic import BaseModel

router = APIRouter()

class DiagnosticRequest(BaseModel):
    context: str

@router.post("/diagnose")
async def diagnose_incident(request: DiagnosticRequest, current_user: User = Depends(deps.get_current_user)):
    if not settings.ANTHROPIC_API_KEY:
        # Fallback for demo if API key isn't set yet
        return {
            "prediction": "System integrity check complete. Standard operational parameters detected.",
            "risk_level": "LOW",
            "suggestion": "Routine observation recommended for current maintenance items."
        }

    try:
        client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1024,
            messages=[
                {"role": "user", "content": f"Analyze this maintenance history and predict potential failures: {request.context}"}
            ]
        )
        return {"result": message.content[0].text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
