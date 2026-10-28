from sqlalchemy import Column, Integer, String, Float, Text, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base import Base

KNOWN_FICTIONAL_DEMO_NAMES = {
    "Empower Future Scholarship",
    "NextGen Technology Grant",
    "National Merit-cum-Means Scholarship",
    "CSR STEM Bursary",
    "Regional Student Stipend",
    "State Welfare Fellowship",
    "Women in Technology Scholarship",
    "PG Excellence Fellowship",
}

RETIRED_DEMO_STATUSES = {"RETIRED_DEMO", "DEMO_DATA"}


class Scholarship(Base):
    __tablename__ = "scholarships"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    provider = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String(10), default="INR", nullable=False)
    deadline = Column(DateTime(timezone=True), nullable=False, index=True)
    application_url = Column(String(500), nullable=True)
    source_url = Column(String(500), nullable=True)
    source_name = Column(String(255), nullable=True)
    verification_status = Column(String(50), default="DEMO_DATA", nullable=False, index=True)
    last_verified_at = Column(DateTime(timezone=True), nullable=True)
    eligibility_summary = Column(Text, nullable=True)
    application_effort = Column(String(255), default="Medium (3-5 hrs)", nullable=True)
    status = Column(String(50), default="ACTIVE", nullable=False, index=True)

    # Specific Tamil Nadu Higher Education & Autonomous College Intelligence
    dossier_index = Column(String(50), nullable=True, index=True)
    stream = Column(String(50), default="BOTH", nullable=False, index=True)  # ARTS_SCIENCE, ENGINEERING, BOTH
    study_level = Column(String(50), default="BOTH", nullable=False, index=True)  # UG, PG, BOTH
    category_tag = Column(String(500), default="GOVERNMENT", nullable=False, index=True)
    institution_types = Column(String(255), nullable=True)
    autonomous_compatibility = Column(Text, nullable=True)
    tn_residency_required = Column(String(20), default="YES", nullable=False)
    community_category = Column(String(255), default="ALL", nullable=False)
    income_ceiling = Column(Float, nullable=True)
    income_criteria_raw = Column(String(500), nullable=True)
    award_type = Column(String(255), default="VARIABLE_ASSISTANCE", nullable=False)
    award_display = Column(String(500), nullable=True)
    official_portal_name = Column(String(255), nullable=True)
    official_guideline_url = Column(String(500), nullable=True)
    academic_year = Column(String(50), default="2024-2025 / 2025-2026", nullable=True)
    source_verification_status = Column(String(50), default="SOURCE_VERIFIED", nullable=False, index=True)  # SOURCE_VERIFIED, PARTIALLY_VERIFIED, ELIGIBILITY_CONFIRMATION_REQUIRED, EXPIRED_OR_CLOSED
    application_window_status = Column(String(50), default="OPEN", nullable=False, index=True)  # OPEN, CLOSED, ANNOUNCED_TENTATIVE, COLLEGE_OFFICE_COORDINATED
    unresolved_questions = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    eligibility_rules = relationship(
        "EligibilityRule",
        back_populates="scholarship",
        cascade="all, delete-orphan",
    )
    requirements = relationship(
        "ScholarshipRequirement",
        back_populates="scholarship",
        cascade="all, delete-orphan",
    )
    applications = relationship(
        "Application",
        back_populates="scholarship",
        cascade="all, delete-orphan",
    )
