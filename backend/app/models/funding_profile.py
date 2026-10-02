from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, func
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
    annual_education_cost = Column(Float, nullable=False, default=0.0)
    existing_support = Column(Float, nullable=False, default=0.0)
    annual_family_income = Column(Float, nullable=False, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    student = relationship("Student", back_populates="funding_profile")

    @property
    def funding_gap(self) -> float:
        """
        Calculated dynamically: max(0, annual education cost - existing support)
        Never hardcoded or stale.
        """
        return max(0.0, float(self.annual_education_cost) - float(self.existing_support))

    @property
    def funding_progress_percentage(self) -> float:
        """
        Percentage of annual education cost covered by existing support.
        """
        cost = float(self.annual_education_cost)
        if cost <= 0:
            return 100.0
        support = float(self.existing_support)
        return min(100.0, round((support / cost) * 100.0, 1))
