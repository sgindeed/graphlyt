from pydantic import BaseModel

class ChatRequest(BaseModel):
    """Schema for incoming RAG chat requests from the frontend."""
    message: str
    
