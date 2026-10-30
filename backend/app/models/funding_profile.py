from typing import Optional
from sqlalchemy import Column, Integer, Float, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class FundingProfile(Base):
    __tablename__ = "funding_profiles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    annual_education_cost = Column(Float, nullable=True)
    existing_support = Column(Float, nullable=True)
    annual_family_income = Column(Float, nullable=True)

    # Extended Financial Attributes for My Profile Dashboard
    income_range = Column(String(50), nullable=True)  # e.g. "Below ₹2.5 Lakhs", "₹2.5L - ₹4.5L", "₹4.5L - ₹8.0L"
    income_certificate_status = Column(String(50), nullable=True, default="NOT_UPLOADED")  # NOT_UPLOADED | UPLOADED | VERIFIED
    financial_circumstances_notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    student = relationship("Student", back_populates="funding_profile")

    @property
    def funding_gap(self) -> Optional[float]:
        """
        Calculated dynamically: max(0, annual education cost - existing support)
        Returns None when annual education cost has not been specified by the student.
        """
        if self.annual_education_cost is None:
            return None
        cost = float(self.annual_education_cost)
        support = float(self.existing_support or 0.0)
        return max(0.0, cost - support)

    @property
    def funding_progress_percentage(self) -> Optional[float]:
        """
        Percentage of annual education cost covered by existing support.
        Returns None when annual education cost is unspecified.
        """
        if self.annual_education_cost is None or self.annual_education_cost <= 0:
            return None
        cost = float(self.annual_education_cost)
        support = float(self.existing_support or 0.0)
        return min(100.0, round((support / cost) * 100.0, 1))
