from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.auth import get_current_student
from app.models.student import Student
from app.services.planner_service import planner_service
from app.schemas.planner import PlannerGoalUpdate, PlannerOverviewResponse

router = APIRouter()


@router.get("", response_model=PlannerOverviewResponse, summary="Get Funding Goal & Suggested Weekly Plan")
def get_planner(
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    student = current_student
    return planner_service.generate_plan(db, student)


@router.post("", response_model=PlannerOverviewResponse, summary="Update Planner Goal & Re-allocate Plan")
def update_planner(
    payload: PlannerGoalUpdate,
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    student = current_student
    goal = planner_service.get_or_create_goal(db, student.id)

    if payload.target_funding is not None:
        goal.target_funding = float(payload.target_funding)
    if payload.purpose is not None:
        goal.purpose = payload.purpose.strip()
    if payload.timeline is not None:
        goal.timeline = payload.timeline.strip()
    if payload.available_hours_per_week is not None:
        goal.available_hours_per_week = float(payload.available_hours_per_week)
    if payload.priorities is not None:
        goal.priorities = payload.priorities.strip()

    db.commit()
    db.refresh(goal)

    return planner_service.generate_plan(db, student)
