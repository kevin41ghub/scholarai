from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    institution = Column(String(255), nullable=False)
    course = Column(String(255), nullable=False)
    year = Column(String(50), nullable=False)
    cgpa = Column(Float, nullable=False)
    twelfth_percentage = Column(Float, nullable=False)
    category = Column(String(50), nullable=False)
    state = Column(String(100), nullable=False)
    gender = Column(String(50), nullable=True, default="Male")

    # Institutional & Quota Attributes (Task 3)
    admission_quota = Column(String(50), nullable=True)  # GOVERNMENT_QUOTA | MANAGEMENT_QUOTA
    hosteller_status = Column(String(50), nullable=True)  # DAY_SCHOLAR | HOSTELLER
    is_first_graduate = Column(Boolean, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    student = relationship("Student", back_populates="profile")
