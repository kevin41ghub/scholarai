from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class AIInteractionLog(Base):
    __tablename__ = "ai_interaction_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    
    request_type = Column(String(100), nullable=False, index=True)  # chat, draft_answer, review_answer, evidence_check, voice_interpret
    model_provider = Column(String(100), nullable=False)
    tools_used = Column(Text, nullable=True)  # JSON array string
    sources_retrieved = Column(Text, nullable=True)  # JSON array string
    response_status = Column(String(50), default="SUCCESS", nullable=False)  # SUCCESS, FALLBACK, ERROR
    latency_ms = Column(Integer, default=0, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    student = relationship("Student", back_populates="ai_logs")
