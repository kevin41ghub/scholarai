from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class EligibilityRuleResponse(BaseModel):
    id: int
    rule_type: str
    criteria_value: str
    operator: str
    description: str
    is_mandatory: bool

    model_config = ConfigDict(from_attributes=True)


class ScholarshipRequirementResponse(BaseModel):
    id: int
    name: str
    document_type: str
    type: str
    is_required: bool
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ScholarshipListItemResponse(BaseModel):
    id: int
    name: str
    provider: str
    description: str
    amount: float
    currency: str
    deadline: datetime
    verification_status: str
    eligibility_summary: Optional[str] = None
    application_effort: Optional[str] = None
    status: str

    # Tamil Nadu Specific Fields
    dossier_index: Optional[str] = None
    stream: Optional[str] = "BOTH"
    study_level: Optional[str] = "BOTH"
    category_tag: Optional[str] = "GOVERNMENT"
    institution_types: Optional[str] = None
    autonomous_compatibility: Optional[str] = None
    tn_residency_required: Optional[bool] = True
    community_category: Optional[str] = "ALL"
    income_ceiling: Optional[float] = None
    income_criteria_raw: Optional[str] = None
    award_type: Optional[str] = "VARIABLE_ASSISTANCE"
    award_display: Optional[str] = None
    official_portal_name: Optional[str] = None
    official_guideline_url: Optional[str] = None
    academic_year: Optional[str] = "2024-2025 / 2025-2026"
    source_verification_status: Optional[str] = "SOURCE_VERIFIED"
    application_window_status: Optional[str] = "OPEN"
    unresolved_questions: Optional[str] = None
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    application_url: Optional[str] = None
    last_verified_at: Optional[datetime] = None

    # Computed fields for student
    match_status: Optional[str] = None  # eligible, possibly_eligible, ineligible, needs_verification
    match_score: Optional[float] = None
    fit_reasons: Optional[List[str]] = None
    disqualification_reasons: Optional[List[str]] = None
    days_remaining: Optional[int] = None
    deadline_risk: Optional[str] = None
    application_status: Optional[str] = None  # NOT_STARTED, IN_PROGRESS, etc.
    application_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class FundingImpactAnalysis(BaseModel):
    current_funding_gap: float
    scholarship_amount: float
    potential_remaining_gap: float
    gap_coverage_percentage: float
    disclaimer: str


class ScholarshipDetailResponse(BaseModel):
    id: int
    name: str
    provider: str
    description: str
    amount: float
    currency: str
    deadline: datetime
    application_url: Optional[str] = None
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    verification_status: str
    last_verified_at: Optional[datetime] = None
    eligibility_summary: Optional[str] = None
    application_effort: Optional[str] = None
    status: str

    # Tamil Nadu Specific Fields
    dossier_index: Optional[str] = None
    stream: Optional[str] = "BOTH"
    study_level: Optional[str] = "BOTH"
    category_tag: Optional[str] = "GOVERNMENT"
    institution_types: Optional[str] = None
    autonomous_compatibility: Optional[str] = None
    tn_residency_required: Optional[bool] = True
    community_category: Optional[str] = "ALL"
    income_ceiling: Optional[float] = None
    income_criteria_raw: Optional[str] = None
    award_type: Optional[str] = "VARIABLE_ASSISTANCE"
    award_display: Optional[str] = None
    official_portal_name: Optional[str] = None
    official_guideline_url: Optional[str] = None
    academic_year: Optional[str] = "2024-2025 / 2025-2026"
    source_verification_status: Optional[str] = "SOURCE_VERIFIED"
    application_window_status: Optional[str] = "OPEN"
    unresolved_questions: Optional[str] = None

    eligibility_rules: List[EligibilityRuleResponse] = []
    requirements: List[ScholarshipRequirementResponse] = []

    # Student-specific intelligence
    eligibility: Optional[Dict[str, Any]] = None
    funding_impact: Optional[FundingImpactAnalysis] = None
    deadline_risk: Optional[Dict[str, Any]] = None
    current_application: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)
