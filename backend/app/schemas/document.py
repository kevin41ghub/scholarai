from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class VerificationCheck(BaseModel):
    check_name: str
    passed: bool
    outcome: str  # PASSED, WARNING, FAILED
    reason: str
    verification_method: str  # FORMAT_SIGNATURE, INTEGRITY_HASH, EXPIRY_CHECK, PROFILE_MATCH, RULE_ENGINE, MANUAL_REVIEW
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class DocumentResponse(BaseModel):
    id: int
    student_id: int
    name: str
    document_type: str
    status: str
    uploaded_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None

    # Real storage & security fields
    storage_backend: Optional[str] = "local"
    storage_key: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    content_hash: Optional[str] = None
    original_filename: Optional[str] = None

    # Extraction and transparent verification
    extraction_status: Optional[str] = "PENDING"
    verification_status: Optional[str] = "UPLOADED"
    extracted_data: Optional[Dict[str, Any]] = None
    verification_results: Optional[List[Dict[str, Any]]] = None
    failure_reasons: Optional[List[str]] = None

    # Reviewer workflow & audit
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    audit_history: Optional[List[Dict[str, Any]]] = None

    created_at: datetime
    updated_at: datetime

    # Cross-application intelligence
    affected_applications_count: int = 0
    potential_funding_affected: float = 0.0
    is_shared_blocker: bool = False

    model_config = ConfigDict(from_attributes=True)


class DocumentCreate(BaseModel):
    name: str = Field(..., min_length=1)
    document_type: str = Field(..., min_length=1)
    status: str = Field("MISSING", pattern="^(MISSING|AVAILABLE|VERIFIED|NEEDS_VERIFICATION|EXPIRED)$")
    notes: Optional[str] = None


class DocumentUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(MISSING|AVAILABLE|VERIFIED|NEEDS_VERIFICATION|EXPIRED)$")
    notes: Optional[str] = None


class DocumentReviewRequest(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT|REQUEST_CHANGES)$")
    reason: str = Field(..., min_length=3)
