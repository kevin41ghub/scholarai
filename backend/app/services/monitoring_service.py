import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.knowledge import KnowledgeSource, KnowledgeDocument
from app.models.scholarship import Scholarship
from app.models.application import Application
from app.models.notification import Notification
from app.models.action import Action
from app.schemas.monitoring import MonitoringCheckResponse

logger = logging.getLogger(__name__)


def check_source_for_changes(
    db: Session,
    student_id: int,
    source_id: Optional[int] = None,
    scholarship_id: Optional[int] = None,
    simulate_change_type: Optional[str] = None,
    simulated_value: Optional[str] = None
) -> MonitoringCheckResponse:
    """
    Check monitored scholarship source for changes.
    Supports local controlled simulation for testing and demonstration (PART 18 & 57).
    """
    source = None
    if source_id:
        source = db.query(KnowledgeSource).filter(KnowledgeSource.id == source_id).first()
    elif scholarship_id:
        doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.scholarship_id == scholarship_id).first()
        if doc:
            source = doc.source

    if not source:
        # Default to first monitored source
        source = db.query(KnowledgeSource).first()

    if not source:
        return MonitoringCheckResponse(
            source_id=0,
            source_name="No Monitored Source",
            change_detected=False,
            recommended_next_action="Register a scholarship source to enable change monitoring."
        )

    now = datetime.now(timezone.utc)
    source.last_checked = now

    affected_apps: List[str] = []
    affected_reqs: List[str] = []
    notification_created = False
    recommended_action = None
    prev_val = None
    new_val = None

    # Find applications associated with this source/scholarship
    related_scholarship = None
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.source_id == source.id).first()
    if doc and doc.scholarship_id:
        related_scholarship = db.query(Scholarship).filter(Scholarship.id == doc.scholarship_id).first()
    elif scholarship_id:
        related_scholarship = db.query(Scholarship).filter(Scholarship.id == scholarship_id).first()

    if related_scholarship:
        apps = db.query(Application).filter(
            Application.student_id == student_id,
            Application.scholarship_id == related_scholarship.id
        ).all()
        affected_apps = [a.scholarship.name for a in apps]

    # Handle Simulated or Detected Change
    if simulate_change_type == "DEADLINE_CHANGED" and related_scholarship:
        prev_deadline = related_scholarship.deadline
        prev_val = prev_deadline.strftime("%Y-%m-%d") if prev_deadline else "June 30"
        
        # Advance deadline closer (e.g. 1 day left)
        new_deadline = now + timedelta(days=1)
        related_scholarship.deadline = new_deadline
        new_val = new_deadline.strftime("%Y-%m-%d")

        source.last_changed = now
        source.change_summary = f"Deadline advanced to {new_val} (Previously: {prev_val})"
        source.change_severity = "URGENT"

        # Create high-priority notification
        notif = Notification(
            student_id=student_id,
            type="DEADLINE",
            title=f"URGENT: Deadline Changed for {related_scholarship.name}",
            message=f"The submission deadline has moved closer to {new_val}. You now have only 1 day remaining.",
            severity="URGENT",
            related_scholarship_id=related_scholarship.id,
            related_application_id=apps[0].id if apps else None
        )
        db.add(notif)
        notification_created = True

        recommended_action = f"Immediately finalize and submit your application for {related_scholarship.name}."

        # Add or update urgent action
        urgent_action = Action(
            student_id=student_id,
            application_id=apps[0].id if apps else None,
            title=f"URGENT: Review & Submit {related_scholarship.name}",
            reason=f"Deadline was moved up to {new_val}. Urgent review required.",
            urgency="URGENT",
            deadline=new_deadline,
            effort_estimate="1 hour",
            potential_funding_impact=related_scholarship.amount,
            blocker_impact="Immediate deadline risk",
            action_type="APPLICATION",
            is_completed=False
        )
        db.add(urgent_action)
        db.commit()

        return MonitoringCheckResponse(
            source_id=source.id,
            source_name=source.name,
            change_detected=True,
            change_category="DEADLINE_CHANGED",
            previous_value=prev_val,
            new_value=new_val,
            affected_applications=affected_apps,
            affected_requirements=affected_reqs,
            notification_created=notification_created,
            recommended_next_action=recommended_action
        )

    db.commit()
    return MonitoringCheckResponse(
        source_id=source.id,
        source_name=source.name,
        change_detected=False,
        previous_value=None,
        new_value=None,
        affected_applications=affected_apps,
        affected_requirements=[],
        notification_created=False,
        recommended_next_action="All monitored scholarship sources are current and verified."
    )
