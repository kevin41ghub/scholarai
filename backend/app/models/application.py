from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON, func, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scholarship_id = Column(
        Integer,
        ForeignKey("scholarships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(
        String(50),
        default="IN_PROGRESS",
        nullable=False,
        index=True,
    )  # NOT_STARTED, IN_PROGRESS, READY, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, WITHDRAWN
    status_reason = Column(Text, nullable=True)
    status_history = Column(JSON, nullable=True)
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    progress = Column(Float, default=0.0, nullable=False)
    personal_statement = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    # Real Application Assistant & External Submission Tracking
    preparation_status = Column(
        String(50),
        default="IN_PROGRESS",
        nullable=False,
        index=True,
    )  # DRAFT, IN_PROGRESS, ACTION_REQUIRED, READY_FOR_REVIEW, READY_TO_SUBMIT
    submission_status = Column(
        String(50),
        default="NOT_SUBMITTED",
        nullable=False,
        index=True,
    )  # NOT_SUBMITTED, MANUAL_SUBMISSION_REQUIRED, SUBMISSION_IN_PROGRESS, SUBMITTED_EXTERNALLY, SUBMISSION_FAILED, REQUIRES_CONFIRMATION
    submission_mode = Column(
        String(50),
        default="STUDENT_COMPLETED_EXTERNAL_SUBMISSION",
        nullable=False,
        index=True,
    )  # OFFICIAL_API, AUTHORIZED_BROWSER_AUTOMATION, STUDENT_COMPLETED_EXTERNAL_SUBMISSION, NOT_INTEGRATED
    form_data = Column(JSON, nullable=True)
    external_application_id = Column(String(255), nullable=True, index=True)
    external_submission_at = Column(DateTime(timezone=True), nullable=True)
    external_receipt_document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    external_response_payload = Column(JSON, nullable=True)
    student_consented_at = Column(DateTime(timezone=True), nullable=True)
    submission_notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("student_id", "scholarship_id", name="uq_student_scholarship_application"),
    )

    student = relationship("Student", back_populates="applications")
    scholarship = relationship("Scholarship", back_populates="applications")
    requirements = relationship(
        "ApplicationRequirement",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    external_receipt_document = relationship("Document", foreign_keys=[external_receipt_document_id])
