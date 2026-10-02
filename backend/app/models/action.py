from sqlalchemy import Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class Action(Base):
    __tablename__ = "actions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    application_id = Column(
        Integer,
        ForeignKey("applications.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title = Column(String(255), nullable=False)
    reason = Column(Text, nullable=False)
    urgency = Column(String(50), default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, URGENT
    deadline = Column(DateTime(timezone=True), nullable=True)
    effort_estimate = Column(String(50), default="1 hour", nullable=False)
    potential_funding_impact = Column(Float, default=0.0, nullable=False)
    blocker_impact = Column(String(255), nullable=True)
    action_type = Column(String(50), default="GENERAL", nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    student = relationship("Student", back_populates="actions")
    application = relationship("Application")
