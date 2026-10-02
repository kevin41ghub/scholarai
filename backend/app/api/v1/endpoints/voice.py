from fastapi import APIRouter
from app.schemas.voice import VoiceInterpretRequest, VoiceInterpretResponse
from app.services.voice_service import interpret_voice_query

router = APIRouter()


@router.post("/interpret", response_model=VoiceInterpretResponse)
def interpret_voice(req: VoiceInterpretRequest):
    """
    Voice Decoder endpoint.
    Converts speech or natural-language query to structured platform intents.
    Supports English, Tamil, and Tanglish.
    Always includes a confirmation request before mutating state.
    """
    return interpret_voice_query(req)
