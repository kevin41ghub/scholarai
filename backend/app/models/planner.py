from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class PlannerGoal(Base):
    __tablename__ = "planner_goals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    target_funding = Column(Float, default=60000.0, nullable=False)
    purpose = Column(String(255), default="Tuition & Academic Expenses", nullable=False)
    timeline = Column(String(100), default="Current Academic Year", nullable=False)
    available_hours_per_week = Column(Float, default=5.0, nullable=False)
    priorities = Column(String(255), default="High-impact & Deadline-urgent", nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    student = relationship("Student", back_populates="planner_goal")
