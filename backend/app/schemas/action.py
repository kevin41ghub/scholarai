from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ActionResponse(BaseModel):
    id: int
    title: str
    reason: str
    urgency: str
    deadline: Optional[datetime] = None
    effort_estimate: str
    potential_funding_impact: float
    blocker_impact: Optional[str] = None
    action_type: str
    is_completed: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
