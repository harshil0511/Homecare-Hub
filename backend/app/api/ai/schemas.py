from pydantic import BaseModel


class DiagnosticRequest(BaseModel):
    context: str
