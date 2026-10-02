from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class ActionConfirmation(BaseModel):
    action_type: str  # e.g., "UPDATE_WEEKLY_HOURS", "VERIFY_EVIDENCE", "SET_GOAL_TARGET"
    description: str
    proposed_payload: Dict[str, Any]
    status: str = "PENDING"  # PENDING, CONFIRMED, CANCELLED


class ChatMessageRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = None
    application_id: Optional[int] = None
    confirmed_action: Optional[ActionConfirmation] = None


class ChatMessageResponse(BaseModel):
    reply: str
    trust_category: str = "AI ANALYSIS"  # FACTS FROM USER DATA, OFFICIAL SOURCE INFORMATION, AI ANALYSIS, AI SUGGESTIONS, UNKNOWN
    sources_cited: List[str] = []
    suggested_prompts: List[str] = []
    pending_action_confirmation: Optional[ActionConfirmation] = None
    tools_used: List[str] = []
    model_provider: str = "demo"
