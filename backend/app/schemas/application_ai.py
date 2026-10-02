from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class ApplicationDraftRequest(BaseModel):
    question: str
    field_type: Optional[str] = "ESSAY"
    selected_evidence_ids: Optional[List[int]] = None


class ApplicationDraftResponse(BaseModel):
    draft_text: str
    evidence_used: List[Dict[str, Any]]
    sources_used: List[str]
    trust_label: str = "AI GENERATED DRAFT"
    student_approval_required: bool = True
    claims_detected: List[str]


class ApplicationReviewRequest(BaseModel):
    question: str
    answer_text: str


class ApplicationReviewResponse(BaseModel):
    review_feedback: str
    unsupported_claims: List[str]
    vague_statements: List[str]
    strengths: List[str]
    completeness_score: float  # 0 to 100
    recommendations: List[str]


class EvidenceCheckRequest(BaseModel):
    draft_text: str


class EvidenceCheckResponse(BaseModel):
    claims_evaluated: int
    supported_claims: List[str]
    unsupported_claims: List[str]
    confidence_level: str  # HIGH EVIDENCE SUPPORT, PARTIAL EVIDENCE, NEEDS VERIFICATION
