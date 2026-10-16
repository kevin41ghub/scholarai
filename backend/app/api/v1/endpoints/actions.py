from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.auth import get_current_user, get_current_student, verify_student_access
from app.models.user import User
from app.models.student import Student
from app.services.next_best_action_service import next_best_action_service
from app.models.action import Action
from app.schemas.action import ActionResponse

router = APIRouter()


@router.get("", summary="Get Ranked Next-Best Actions")
def list_actions(
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    student = current_student
    actions = next_best_action_service.generate_and_rank_actions(db, student.id)
    return actions


@router.patch("/{id}/toggle", summary="Toggle Action Completion")
def toggle_action(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    action = db.query(Action).filter(Action.id == id).first()
    if action:
        verify_student_access(current_user, action.student_id)
        action.is_completed = not action.is_completed
        db.commit()
        db.refresh(action)
        return ActionResponse.model_validate(action)

    # If dynamic action without DB record, return ok
    return {"id": id, "is_completed": True, "message": "Action state toggled."}
