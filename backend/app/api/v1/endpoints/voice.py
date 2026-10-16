from fastapi import APIRouter, Depends
from app.schemas.voice import VoiceInterpretRequest, VoiceInterpretResponse
from app.services.voice_service import interpret_voice_query
from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/interpret", response_model=VoiceInterpretResponse)
def interpret_voice(
    req: VoiceInterpretRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Voice Decoder endpoint.
    Converts speech or natural-language query to structured platform intents.
    Supports English, Tamil, and Tanglish.
    Always includes a confirmation request before mutating state.
    """
    return interpret_voice_query(req)
