from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class AdminOverviewResponse(BaseModel):
    total_users: int
    total_students: int
    total_scholarships: int
    active_scholarships: int
    retired_scholarships: int
    verified_scholarships: Optional[int] = 0
    partially_verified_scholarships: Optional[int] = 0
    total_applications: int
    applications_by_status: Dict[str, int]
    pending_review_count: int
    ready_for_submission_count: int
    in_progress_count: int
    ai_status: Dict[str, Any]
    database_health: Optional[Dict[str, Any]] = None
    storage_health: Optional[Dict[str, Any]] = None
    recent_activity: List[Dict[str, Any]]

    model_config = ConfigDict(from_attributes=True)


class AdminScholarshipItem(BaseModel):
    id: int
    name: str
    provider: str
    amount: float
    deadline: Optional[str] = None
    status: str
    verification_status: str
    dossier_index: Optional[str] = None
    official_portal_url: Optional[str] = None
    official_guideline_source: Optional[str] = None
    applications_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class AdminScholarshipListResponse(BaseModel):
    total: int
    scholarships: List[AdminScholarshipItem]


class AdminApplicationItem(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_email: str
    scholarship_id: int
    scholarship_name: str
    status: str
    status_reason: Optional[str] = None
    readiness_score: float = 0.0
    is_ready_for_submission: bool = False
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    started_at: datetime
    submitted_at: Optional[datetime] = None
    requirements_met: int = 0
    requirements_total: int = 0

    model_config = ConfigDict(from_attributes=True)


class AdminApplicationListResponse(BaseModel):
    total: int
    applications: List[AdminApplicationItem]


class AdminApplicationReviewRequest(BaseModel):
    action: str = Field(..., description="Action: UNDER_REVIEW, APPROVE, or REJECT")
    reason: str = Field(..., min_length=3, description="Justification or official review notes")


class AIDiagnosticResponse(BaseModel):
    provider: str
    model: str
    base_url: Optional[str] = None
    configured: bool
    connectivity: str  # CONNECTED, FAILED, DEMO_MODE, NOT_CONFIGURED
    latency_ms: Optional[float] = None
    message: str
    error_details: Optional[str] = None
    catalog_rag_enabled: bool = True
    active_sources_count: int = 0


class AuditLogItem(BaseModel):
    id: str
    timestamp: str
    event_type: str
    actor: str
    target_type: str
    target_id: Optional[int] = None
    description: str
    details: Optional[Dict[str, Any]] = None


class AdminUserItem(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    is_demo: bool
    student_id: int
    student_name: str
    institution: Optional[str] = None
    course: Optional[str] = None
    category: Optional[str] = None
    cgpa: Optional[float] = None
    applications_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUserListResponse(BaseModel):
    total: int
    users: List[AdminUserItem]


class AdminDocumentItem(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_email: str
    document_type: str
    filename: str
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    sha256_hash: Optional[str] = None
    status: str
    verification_status: str
    uploaded_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AdminDocumentListResponse(BaseModel):
    total: int
    documents: List[AdminDocumentItem]
