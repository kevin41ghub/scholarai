from sqlalchemy import Column, Integer, String, Float, Text, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base import Base


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
    application_effort = Column(String(50), default="Medium (3-5 hrs)", nullable=True)
    status = Column(String(50), default="ACTIVE", nullable=False, index=True)

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
