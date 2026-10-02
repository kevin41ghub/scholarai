from typing import Optional, Dict, Any
from pydantic import BaseModel


class VoiceInterpretRequest(BaseModel):
    transcription: str
    audio_b64: Optional[str] = None
    language: Optional[str] = "en"  # en, ta (Tamil), ta-Latn (Tanglish)


class VoiceInterpretResponse(BaseModel):
    interpreted_text: str
    detected_language: str
    intent: str  # funding_goal, weekly_available_hours, scholarship_search, blocker_inquiry, general_question
    extracted_params: Dict[str, Any]
    requires_confirmation: bool = True
    confirmation_message: str
    action_payload: Optional[Dict[str, Any]] = None
