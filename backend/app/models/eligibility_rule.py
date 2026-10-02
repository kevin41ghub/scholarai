from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class EligibilityRule(Base):
    __tablename__ = "eligibility_rules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    scholarship_id = Column(
        Integer,
        ForeignKey("scholarships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rule_type = Column(String(50), nullable=False)  # MIN_CGPA, MAX_INCOME, COURSE, etc.
    criteria_value = Column(String(255), nullable=False)
    operator = Column(String(20), default="EQUALS", nullable=False)  # GTE, LTE, EQUALS, IN, CONTAINS
    description = Column(String(255), nullable=False)
    is_mandatory = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    scholarship = relationship("Scholarship", back_populates="eligibility_rules")
