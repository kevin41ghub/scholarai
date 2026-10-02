from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class KnowledgeSource(Base):
    __tablename__ = "knowledge_sources"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    source_url = Column(String(500), nullable=False)
    source_type = Column(String(50), nullable=False, default="DEMO_SOURCE")  # OFFICIAL_WEBSITE, OFFICIAL_PDF, OFFICIAL_PORTAL, USER_PROVIDED, DEMO_SOURCE
    authority_level = Column(String(50), nullable=False, default="DEMO")  # OFFICIAL, USER_PROVIDED, DEMO, UNKNOWN
    verification_status = Column(String(50), nullable=False, default="DEMO_DATA")  # VERIFIED, RECENTLY_VERIFIED, STALE, NEEDS_VERIFICATION, DEMO_DATA
    last_verified_at = Column(DateTime(timezone=True), nullable=True)

    # Scholarship change monitoring attributes
    monitoring_status = Column(String(50), default="ACTIVE", nullable=False)
    last_checked = Column(DateTime(timezone=True), nullable=True)
    last_content_hash = Column(String(128), nullable=True)
    last_changed = Column(DateTime(timezone=True), nullable=True)
    change_summary = Column(Text, nullable=True)
    change_severity = Column(String(50), default="INFO", nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    documents = relationship("KnowledgeDocument", back_populates="source", cascade="all, delete-orphan")


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    source_id = Column(Integer, ForeignKey("knowledge_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    scholarship_id = Column(Integer, ForeignKey("scholarships.id", ondelete="SET NULL"), nullable=True, index=True)
    
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    document_url = Column(String(500), nullable=False)
    content_hash = Column(String(128), nullable=False)
    
    retrieved_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    last_verified_at = Column(DateTime(timezone=True), nullable=True)
    verification_status = Column(String(50), default="DEMO_DATA", nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    source = relationship("KnowledgeSource", back_populates="documents")
    scholarship = relationship("Scholarship")
    chunks = relationship("KnowledgeChunk", back_populates="document", cascade="all, delete-orphan")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    chunk_text = Column(Text, nullable=False)
    section = Column(String(255), nullable=False, default="General")
    page_number = Column(Integer, nullable=True)
    source_url = Column(String(500), nullable=False)
    metadata_json = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    document = relationship("KnowledgeDocument", back_populates="chunks")
