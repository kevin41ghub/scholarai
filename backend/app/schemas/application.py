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
    status: str  # MISSING, AVAILABLE, VERIFIED, NOT_REQUIRED, NEEDS_VERIFICATION, REJECTED
    document_id: Optional[int] = None
    verification_status: Optional[str] = None
    document_name: Optional[str] = None
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

    # Automatic status engine & audit fields
    status_reason: Optional[str] = None
    status_history: Optional[List[Dict[str, Any]]] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    required_documents_total: int = 0
    required_documents_completed: int = 0
    is_ready_for_submission: bool = False

    # Real Application Lifecycle & External Submission Tracking
    preparation_status: Optional[str] = "IN_PROGRESS"
    submission_status: Optional[str] = "NOT_SUBMITTED"
    submission_mode: Optional[str] = "STUDENT_COMPLETED_EXTERNAL_SUBMISSION"
    external_application_id: Optional[str] = None
    external_submission_at: Optional[datetime] = None
    external_receipt_document_id: Optional[int] = None
    student_consented_at: Optional[datetime] = None

    # Linked scholarship data
    scholarship_name: str
    scholarship_provider: str
    scholarship_amount: float
    scholarship_deadline: datetime
    verification_status: str
    official_portal_url: Optional[str] = None
    official_portal_name: Optional[str] = None

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


class ApplicationWithdrawRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500, description="Reason for withdrawal")


class ApplicationReviewActionRequest(BaseModel):
    action: str = Field(..., pattern="^(UNDER_REVIEW|APPROVE|REJECT)$", description="Review action")
    reason: str = Field(..., min_length=3, max_length=1000, description="Audit justification for action")


class PortfolioSummaryResponse(BaseModel):
    active_applications_count: int
    at_risk_count: int
    blocked_count: int
    potential_funding_under_pursuit: float
    primary_shared_blocker: Optional[Dict[str, Any]] = None
    top_next_best_action: Optional[Dict[str, Any]] = None
    upcoming_deadlines: List[Dict[str, Any]] = []


# ==============================================================================
# Real Application Assistant Workspace Schemas
# ==============================================================================

class ApplicationFormFieldItem(BaseModel):
    key: str
    label: str
    field_group: str  # personal, academic, financial, eligibility, bank, statement
    value: Optional[Any] = None
    suggested_value: Optional[Any] = None
    source: str  # STUDENT_PROFILE, DOCUMENT_EXTRACTED, ACHIEVEMENTS_VAULT, MANUAL_ENTRY, SCHOLARSHIP_RULE
    verification_status: str  # OFFICIALLY_VERIFIED, STUDENT_PROVIDED, UNVERIFIED
    is_required: bool = True
    is_confirmed: bool = False
    guidance: Optional[str] = None
    warning: Optional[str] = None


class ApplicationAssistantWorkspaceResponse(BaseModel):
    application_id: int
    scholarship_id: int
    scholarship_name: str
    scholarship_provider: str
    official_portal_name: Optional[str] = None
    official_portal_url: Optional[str] = None
    official_guideline_url: Optional[str] = None
    scholarship_deadline: datetime
    award_display: Optional[str] = None
    eligibility_summary: Optional[str] = None

    submission_mode: str  # OFFICIAL_API, AUTHORIZED_BROWSER_AUTOMATION, STUDENT_COMPLETED_EXTERNAL_SUBMISSION, NOT_INTEGRATED
    preparation_status: str  # DRAFT, IN_PROGRESS, ACTION_REQUIRED, READY_FOR_REVIEW, READY_TO_SUBMIT
    submission_status: str  # NOT_SUBMITTED, MANUAL_SUBMISSION_REQUIRED, SUBMISSION_IN_PROGRESS, SUBMITTED_EXTERNALLY, SUBMISSION_FAILED, REQUIRES_CONFIRMATION
    status: str  # High-level state
    progress: float
    status_reason: Optional[str] = None

    student_consented: bool = False
    student_consented_at: Optional[datetime] = None
    external_application_id: Optional[str] = None
    external_submission_at: Optional[datetime] = None
    external_receipt_document_id: Optional[int] = None

    fields: List[ApplicationFormFieldItem] = []
    documents: List[ApplicationRequirementResponse] = []
    instructions: List[str] = []
    missing_mandatory_fields: List[str] = []
    unconfirmed_fields: List[str] = []
    discrepancies: List[str] = []

    is_ready_for_student_approval: bool = False
    is_ready_for_external_submission: bool = False
    status_history: List[Dict[str, Any]] = []


class UpdateApplicationFieldsRequest(BaseModel):
    fields: Dict[str, Any] = Field(..., description="Mapping of field key to either string value or object with value and is_confirmed")


class StudentApproveApplicationRequest(BaseModel):
    consent: bool = Field(True, description="Student confirmation that all information is truthful and verified")
    statement_confirmation: Optional[str] = None


class RecordExternalSubmissionRequest(BaseModel):
    confirmation_number: str = Field(..., min_length=2, max_length=255, description="Official external confirmation or acknowledgment number")
    submitted_at: Optional[datetime] = None
    receipt_document_id: Optional[int] = None
    submission_notes: Optional[str] = None


class OfficialApiSubmissionRequest(BaseModel):
    idempotency_key: Optional[str] = Field(None, max_length=128)
    confirm_accuracy: bool = Field(True, description="Explicit student authorization for transmitting payload")
