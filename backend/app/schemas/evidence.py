from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class EvidenceBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    category: str = Field(..., description="ACADEMIC, PROJECT, INTERNSHIP, WORK_EXPERIENCE, AWARD, CERTIFICATION, LEADERSHIP, VOLUNTEERING, EXTRACURRICULAR, FINANCIAL, CAREER_GOAL, PERSONAL, OTHER")
    description: str = Field(..., min_length=5)
    date: Optional[str] = None
    organization: Optional[str] = None
    evidence_text: Optional[str] = None
    source_document_id: Optional[int] = None
    source_type: Optional[str] = "USER_PROVIDED"
    source_name: Optional[str] = "User Provided"


class EvidenceCreate(EvidenceBase):
    pass


class EvidenceUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    organization: Optional[str] = None
    evidence_text: Optional[str] = None
    source_document_id: Optional[int] = None
    source_type: Optional[str] = None
    source_name: Optional[str] = None
    verification_status: Optional[str] = None
    confidence: Optional[str] = None
    used_in_applications: Optional[str] = None


class EvidenceResponse(EvidenceBase):
    id: int
    student_id: int
    verification_status: str
    confidence: str
    used_in_applications: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
