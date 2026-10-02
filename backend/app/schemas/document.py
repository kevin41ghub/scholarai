from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


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
