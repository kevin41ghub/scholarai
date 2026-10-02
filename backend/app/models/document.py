from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    document_type = Column(String(100), nullable=False, index=True)
    status = Column(String(50), default="MISSING", nullable=False, index=True)  # MISSING, AVAILABLE, VERIFIED, NEEDS_VERIFICATION, EXPIRED
    uploaded_at = Column(DateTime(timezone=True), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    student = relationship("Student", back_populates="documents")
    application_requirements = relationship("ApplicationRequirement", back_populates="document")
