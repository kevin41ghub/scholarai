from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class ScholarshipRequirement(Base):
    __tablename__ = "scholarship_requirements"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    scholarship_id = Column(
        Integer,
        ForeignKey("scholarships.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    document_type = Column(String(100), nullable=False)  # INCOME_CERTIFICATE, MARKSHEET, etc.
    type = Column(String(50), default="DOCUMENT", nullable=False)  # DOCUMENT, ESSAY, FORM
    is_required = Column(Boolean, default=True, nullable=False)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    scholarship = relationship("Scholarship", back_populates="requirements")
