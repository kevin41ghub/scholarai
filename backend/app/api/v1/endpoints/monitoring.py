from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.knowledge import KnowledgeSource
from app.schemas.knowledge import KnowledgeSourceResponse
from app.schemas.monitoring import MonitoringCheckRequest, MonitoringCheckResponse
from app.services.monitoring_service import check_source_for_changes

router = APIRouter()


@router.get("", response_model=List[KnowledgeSourceResponse])
def get_monitored_sources(db: Session = Depends(get_db)):
    """
    Get all monitored scholarship sources and their current snapshot statuses.
    """
    return db.query(KnowledgeSource).filter(KnowledgeSource.monitoring_status == "ACTIVE").all()


@router.post("/check", response_model=MonitoringCheckResponse)
def run_monitoring_check(
    req: MonitoringCheckRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Run monitoring check for a source or simulate a change event (e.g. deadline advance).
    Generates notifications, recalculates affected applications, and recommends actions.
    """
    return check_source_for_changes(
        db=db,
        student_id=current_user.student_id,
        source_id=req.source_id,
        scholarship_id=req.scholarship_id,
        simulate_change_type=req.simulate_change_type,
        simulated_value=req.simulated_value
    )
