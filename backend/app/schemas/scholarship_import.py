from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict
import re


def _validate_optional_url(val: Optional[str]) -> Optional[str]:
    if not val:
        return None
    val = val.strip()
    if not val:
        return None
    if not (val.startswith("http://") or val.startswith("https://")):
        raise ValueError(f"Invalid URL '{val}': Must start with http:// or https://")
    return val


class ScholarshipRuleImport(BaseModel):
    rule_type: str = Field(..., min_length=2, description="Rule category e.g. ANNUAL_INCOME, CATEGORY, CGPA, RESIDENCY")
    criteria_value: str = Field(..., description="Target criteria threshold or value")
    operator: str = Field(default="EQ", description="Operator e.g. EQ, LTE, GTE, IN, CONTAINS")
    description: Optional[str] = Field(default=None, description="Human readable explanation")
    is_mandatory: bool = Field(default=True, description="Whether passing is mandatory")

    model_config = ConfigDict(from_attributes=True)


class ScholarshipRequirementImport(BaseModel):
    name: str = Field(..., min_length=2, description="Requirement name")
    document_type: str = Field(default="OTHER", description="Document type tag e.g. COMMUNITY_CERTIFICATE, INCOME_CERTIFICATE")
    type: str = Field(default="DOCUMENT", description="Requirement type e.g. DOCUMENT, APPLICATION_FORM")
    is_required: bool = Field(default=True, description="Whether document is strictly required")
    description: Optional[str] = Field(default=None, description="Requirement guidance")

    model_config = ConfigDict(from_attributes=True)


class ScholarshipKnowledgeChunkImport(BaseModel):
    chunk_text: str = Field(..., min_length=5, description="Exact authoritative source excerpt text")
    section: str = Field(default="General", description="Guideline section or clause header")
    page_number: Optional[int] = Field(default=None, description="Official PDF page number if applicable")
    source_url: Optional[str] = Field(default=None, description="Direct URL to source document or clause")
    metadata_json: Optional[str] = Field(default=None, description="JSON metadata")

    @field_validator("source_url")
    @classmethod
    def check_source_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_optional_url(v)

    model_config = ConfigDict(from_attributes=True)


class ScholarshipKnowledgeDocImport(BaseModel):
    title: str = Field(..., min_length=3, description="Official notification or guideline document title")
    source_url: str = Field(..., min_length=5, description="Direct URL of the official document or portal")
    content: Optional[str] = Field(default=None, description="Document body content or text")
    authority_level: Optional[str] = Field(default=None, description="OFFICIAL or USER_PROVIDED")
    verification_status: Optional[str] = Field(default=None, description="VERIFIED, NEEDS_VERIFICATION, etc.")
    chunks: List[ScholarshipKnowledgeChunkImport] = Field(default_factory=list, description="Authoritative excerpts")

    @field_validator("source_url")
    @classmethod
    def check_source_url(cls, v: str) -> str:
        validated = _validate_optional_url(v)
        if not validated:
            raise ValueError("source_url cannot be empty")
        return validated

    model_config = ConfigDict(from_attributes=True)


class ScholarshipImportItem(BaseModel):
    name: str = Field(..., min_length=2, description="Full official title of scholarship scheme")
    provider: str = Field(..., min_length=2, description="Issuing government department or organization")
    description: str = Field(..., min_length=5, description="Objective and scope of the scholarship")
    amount: float = Field(..., ge=0.0, description="Annual or total grant amount in currency")
    currency: str = Field(default="INR", min_length=3, max_length=10)
    deadline: datetime = Field(..., description="Application deadline timestamp")

    application_url: Optional[str] = Field(default=None, description="Official portal link to apply")
    source_url: Optional[str] = Field(default=None, description="Direct link to official notification or guideline")
    source_name: Optional[str] = Field(default=None, description="Name of issuing source or agency")
    verification_status: Optional[str] = Field(default=None, description="Verification status e.g. SOURCE_VERIFIED, PARTIALLY_VERIFIED")
    source_verification_status: Optional[str] = Field(default=None, description="Source verification status")
    last_verified_at: Optional[datetime] = Field(default=None, description="Timestamp when officially verified")

    eligibility_summary: Optional[str] = None
    application_effort: Optional[str] = "Medium (3-5 hrs)"
    status: str = Field(default="ACTIVE", description="ACTIVE, INACTIVE, etc.")

    # Higher Education & Autonomous College Intelligence Fields
    dossier_index: Optional[str] = Field(default=None, description="Official dossier catalog code e.g. № TN-ADW-2025-01")
    stream: str = Field(default="BOTH", description="ARTS_SCIENCE, ENGINEERING, or BOTH")
    study_level: str = Field(default="BOTH", description="UG, PG, or BOTH")
    category_tag: str = Field(default="GOVERNMENT", description="Classification tag")
    institution_types: Optional[str] = Field(default=None, description="Eligible institution types")
    autonomous_compatibility: Optional[str] = Field(default=None, description="Rules for autonomous/aided/self-financing colleges")
    tn_residency_required: bool = Field(default=True, description="Whether state residency is required")
    community_category: str = Field(default="ALL", description="Eligible community categories")
    income_ceiling: Optional[float] = Field(default=None, ge=0.0, description="Annual parental income ceiling")
    income_criteria_raw: Optional[str] = None
    award_type: str = Field(default="VARIABLE_ASSISTANCE")
    award_display: Optional[str] = None
    official_portal_name: Optional[str] = None
    official_guideline_url: Optional[str] = None
    academic_year: Optional[str] = Field(default="2024-2025 / 2025-2026")
    application_window_status: str = Field(default="OPEN")
    unresolved_questions: Optional[str] = None

    eligibility_rules: List[ScholarshipRuleImport] = Field(default_factory=list)
    requirements: List[ScholarshipRequirementImport] = Field(default_factory=list)
    knowledge_docs: List[ScholarshipKnowledgeDocImport] = Field(default_factory=list)

    @field_validator("application_url", "source_url", "official_guideline_url")
    @classmethod
    def validate_urls(cls, v: Optional[str]) -> Optional[str]:
        return _validate_optional_url(v)

    model_config = ConfigDict(from_attributes=True)


class ScholarshipImportRequest(BaseModel):
    items: List[ScholarshipImportItem] = Field(..., min_length=1, description="List of scholarship records to import")
    dry_run: bool = Field(default=False, description="Simulate import without committing changes to database")


class ImportItemResult(BaseModel):
    index: int
    name: str
    dossier_index: Optional[str] = None
    action: str  # CREATED, UPDATED, SKIPPED, REJECTED, WOULD_CREATE, WOULD_UPDATE
    status: str  # SUCCESS, WARNING, ERROR
    details: Optional[str] = None
    source_verification_applied: Optional[str] = None
    official_source_detected: bool = False
    errors: List[str] = []


class ScholarshipImportSummary(BaseModel):
    total: int
    created: int
    updated: int
    skipped: int
    rejected: int
    dry_run: bool
    errors: List[str] = []
    items: List[ImportItemResult] = []
