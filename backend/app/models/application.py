from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, func, UniqueConstraint
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
    progress = Column(Float, default=0.0, nullable=False)
    personal_statement = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)

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
