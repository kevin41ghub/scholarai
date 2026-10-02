from typing import Optional, List
from pydantic import BaseModel


class MonitoringCheckRequest(BaseModel):
    source_id: Optional[int] = None
    scholarship_id: Optional[int] = None
    simulate_change_type: Optional[str] = None  # DEADLINE_CHANGED, ELIGIBILITY_CHANGED, AMOUNT_CHANGED
    simulated_value: Optional[str] = None


class MonitoringCheckResponse(BaseModel):
    source_id: int
    source_name: str
    change_detected: bool
    change_category: Optional[str] = None
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    affected_applications: List[str] = []
    affected_requirements: List[str] = []
    notification_created: bool = False
    recommended_next_action: Optional[str] = None
