from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    
    type = Column(String(50), nullable=False, index=True)  # DEADLINE, DOCUMENT, ELIGIBILITY, SCHOLARSHIP_CHANGE, APPLICATION, FUNDING, SYSTEM
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(50), default="INFO", nullable=False)  # INFO, LOW, MEDIUM, HIGH, URGENT
    
    related_application_id = Column(Integer, ForeignKey("applications.id", ondelete="SET NULL"), nullable=True)
    related_scholarship_id = Column(Integer, ForeignKey("scholarships.id", ondelete="SET NULL"), nullable=True)
    
    read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    student = relationship("Student", back_populates="notifications")
    related_application = relationship("Application")
    related_scholarship = relationship("Scholarship")
