from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.auth import get_current_user, verify_student_access
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse, NotificationSummary

router = APIRouter()


@router.get("", response_model=NotificationSummary)
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List relevant notifications for the student.
    Returns unread count and notification items ordered by recency.
    """
    notifs = (
        db.query(Notification)
        .filter(Notification.student_id == current_user.student_id)
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )
    unread_count = (
        db.query(Notification)
        .filter(Notification.student_id == current_user.student_id, Notification.read == False)
        .count()
    )
    return NotificationSummary(
        unread_count=unread_count,
        notifications=[NotificationResponse.model_validate(n) for n in notifs]
    )


@router.patch("/{id}/read", response_model=NotificationResponse)
def mark_notification_read(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark an individual notification as read.
    """
    notif = db.query(Notification).filter(Notification.id == id).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    verify_student_access(current_user, notif.student_id)

    notif.read = True
    db.commit()
    db.refresh(notif)
    return NotificationResponse.model_validate(notif)


@router.post("/mark-all-read")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark all unread notifications as read.
    """
    db.query(Notification).filter(
        Notification.student_id == current_user.student_id,
        Notification.read == False
    ).update({"read": True})
    db.commit()
    return {"message": "All notifications marked as read."}
