from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.student_service import student_service
from app.services.next_best_action_service import next_best_action_service
from app.models.action import Action
from app.schemas.action import ActionResponse

router = APIRouter()


@router.get("", summary="Get Ranked Next-Best Actions")
def list_actions(db: Session = Depends(get_db)):
    student = student_service.get_or_create_primary_student(db)
    actions = next_best_action_service.generate_and_rank_actions(db, student.id)
    return actions


@router.patch("/{id}/toggle", summary="Toggle Action Completion")
def toggle_action(id: int, db: Session = Depends(get_db)):
    student = student_service.get_or_create_primary_student(db)
    action = db.query(Action).filter(Action.id == id, Action.student_id == student.id).first()
    if not action:
        # If dynamic action without DB record, return ok
        return {"id": id, "is_completed": True, "message": "Action state toggled."}

    action.is_completed = not action.is_completed
    db.commit()
    db.refresh(action)

    return ActionResponse.model_validate(action)
