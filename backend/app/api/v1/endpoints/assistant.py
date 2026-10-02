from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.schemas.assistant import ChatMessageRequest, ChatMessageResponse
from app.services.ai.assistant_service import process_assistant_chat

router = APIRouter()


@router.post("/chat", response_model=ChatMessageResponse)
def assistant_chat(
    req: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Conversational endpoint for the SCHOLARAi Assistant.
    Retrieves live portfolio context, respects Trust Principles,
    and requires user confirmation before mutating data.
    """
    return process_assistant_chat(
        db=db,
        student_id=current_user.student_id,
        request=req
    )
