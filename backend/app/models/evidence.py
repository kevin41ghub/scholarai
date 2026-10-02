from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    
    title = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False, index=True)  # ACADEMIC, PROJECT, INTERNSHIP, WORK_EXPERIENCE, AWARD, CERTIFICATION, LEADERSHIP, VOLUNTEERING, EXTRACURRICULAR, FINANCIAL, CAREER_GOAL, PERSONAL, OTHER
    description = Column(Text, nullable=False)
    date = Column(String(100), nullable=True)
    organization = Column(String(255), nullable=True)
    evidence_text = Column(Text, nullable=True)
    
    source_document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    source_type = Column(String(50), default="USER_PROVIDED", nullable=False)  # STUDENT_PROFILE, DOCUMENT_METADATA, USER_PROVIDED, VERIFIED_ACADEMIC
    source_name = Column(String(255), default="User Provided", nullable=False)
    
    verification_status = Column(String(50), default="USER_PROVIDED", nullable=False, index=True)  # USER_PROVIDED, VERIFIED, NEEDS_VERIFICATION, REJECTED
    confidence = Column(String(50), default="HIGH_EVIDENCE_SUPPORT", nullable=False)  # HIGH_EVIDENCE_SUPPORT, PARTIAL_EVIDENCE, NEEDS_VERIFICATION
    used_in_applications = Column(Text, nullable=True)  # Comma-separated or descriptive usage

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    student = relationship("Student", back_populates="evidence_items")
    source_document = relationship("Document")
