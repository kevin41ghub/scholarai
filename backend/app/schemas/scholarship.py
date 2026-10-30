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
    benefit_type: Optional[str] = "SCHOLARSHIP"
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
    recommendation_category: Optional[str] = None  # LIKELY_ELIGIBLE, POTENTIALLY_ELIGIBLE, CURRENTLY_INELIGIBLE, WINDOW_NEEDS_VERIFICATION
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


class OfficialDossierChunk(BaseModel):
    id: int
    document_id: int
    document_title: str
    section: str
    chunk_text: str
    source_name: str
    source_url: str
    source_type: str
    authority_level: str
    verification_status: str
    last_verified_at: Optional[datetime] = None
    retrieved_at: Optional[datetime] = None
    content_hash: Optional[str] = None
    page_number: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class OfficialDossierResponse(BaseModel):
    has_official_evidence: bool
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    official_portal_name: Optional[str] = None
    official_guideline_url: Optional[str] = None
    authority_level: Optional[str] = None
    verification_status: str
    source_verification_status: Optional[str] = None
    last_verified_at: Optional[datetime] = None
    dossier_index: Optional[str] = None
    chunks_count: int = 0
    chunks: List[OfficialDossierChunk] = []
    unresolved_questions: Optional[str] = None
    autonomous_compatibility: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


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
    benefit_type: Optional[str] = "SCHOLARSHIP"
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

    # Official Verification & Source Dossier
    official_dossier: Optional[OfficialDossierResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ScholarshipRecommendationItem(BaseModel):
    id: int
    name: str
    provider: str
    benefit_type: str = "SCHOLARSHIP"  # SCHOLARSHIP | FINANCIAL_ASSISTANCE | ADMISSION_BENEFIT | FEE_CONCESSION | ACCOMMODATION_ALLOWANCE
    amount: float
    currency: str = "INR"
    award_display: Optional[str] = None
    eligibility_summary: Optional[str] = None
    recommendation_category: str  # LIKELY_ELIGIBLE | POTENTIALLY_ELIGIBLE | CURRENTLY_INELIGIBLE | WINDOW_NEEDS_VERIFICATION
    match_score: float
    why_matched: List[str]
    satisfied_requirements: List[str]
    missing_information: List[str]
    requirements_needing_verification: List[str]
    required_documents: List[str] = []
    requirements: List[ScholarshipRequirementResponse] = []
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
    award_type: Optional[str] = None
    official_portal_name: Optional[str] = None
    unresolved_questions: Optional[str] = None
    deadline: datetime
    academic_year: Optional[str] = None
    official_source_url: Optional[str] = None
    official_application_portal_url: Optional[str] = None
    last_verified_at: Optional[datetime] = None
    days_remaining: Optional[int] = None
    disclaimer: str = "AI assists. Official sources decide. Student approves. Never guaranteed."

    model_config = ConfigDict(from_attributes=True)


class PersonalizedRecommendationsResponse(BaseModel):
    student_name: str
    student_profile_summary: Dict[str, Any]
    total_recommendations: int
    likely_eligible: List[ScholarshipRecommendationItem]
    potentially_eligible: List[ScholarshipRecommendationItem]
    currently_ineligible: List[ScholarshipRecommendationItem]
    window_needs_verification: List[ScholarshipRecommendationItem]
    disclaimer: str = "Recommendations are calculated deterministically against your saved student profile attributes. A recommendation is not an official decision."
