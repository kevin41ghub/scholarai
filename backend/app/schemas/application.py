from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ApplicationRequirementResponse(BaseModel):
    id: int
    application_id: int
    name: str
    document_type: str
    type: str
    is_required: bool
    status: str  # MISSING, AVAILABLE, VERIFIED, NOT_REQUIRED, NEEDS_VERIFICATION
    document_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApplicationRequirementUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(MISSING|AVAILABLE|VERIFIED|NOT_REQUIRED|NEEDS_VERIFICATION)$")
    document_id: Optional[int] = None


class ApplicationResponse(BaseModel):
    id: int
    student_id: int
    scholarship_id: int
    status: str
    progress: float
    personal_statement: Optional[str] = None
    started_at: datetime
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Linked scholarship data
    scholarship_name: str
    scholarship_provider: str
    scholarship_amount: float
    scholarship_deadline: datetime
    verification_status: str

    # Computed intelligence
    deadline_risk: Dict[str, Any]
    missing_requirements_count: int
    requirements: List[ApplicationRequirementResponse] = []
    blockers: List[str] = []
    next_action: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ApplicationCreate(BaseModel):
    scholarship_id: int


class ApplicationUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(NOT_STARTED|IN_PROGRESS|READY|SUBMITTED|UNDER_REVIEW|APPROVED|REJECTED|WITHDRAWN)$")
    personal_statement: Optional[str] = None


class PortfolioSummaryResponse(BaseModel):
    active_applications_count: int
    at_risk_count: int
    blocked_count: int
    potential_funding_under_pursuit: float
    primary_shared_blocker: Optional[Dict[str, Any]] = None
    top_next_best_action: Optional[Dict[str, Any]] = None
    upcoming_deadlines: List[Dict[str, Any]] = []
