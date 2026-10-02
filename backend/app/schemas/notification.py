from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    id: int
    student_id: int
    type: str
    title: str
    message: str
    severity: str
    related_application_id: Optional[int] = None
    related_scholarship_id: Optional[int] = None
    read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationSummary(BaseModel):
    unread_count: int
    notifications: list[NotificationResponse]
