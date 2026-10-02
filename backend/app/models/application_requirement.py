from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class ApplicationRequirement(Base):
    __tablename__ = "application_requirements"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    application_id = Column(
        Integer,
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    document_type = Column(String(100), nullable=False, index=True)
    type = Column(String(50), default="DOCUMENT", nullable=False)  # DOCUMENT, ESSAY, FORM
    is_required = Column(Boolean, default=True, nullable=False)
    status = Column(
        String(50),
        default="MISSING",
        nullable=False,
        index=True,
    )  # MISSING, AVAILABLE, VERIFIED, NOT_REQUIRED, NEEDS_VERIFICATION
    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    application = relationship("Application", back_populates="requirements")
    document = relationship("Document", back_populates="application_requirements")
