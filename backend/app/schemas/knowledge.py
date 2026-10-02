from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class KnowledgeSourceResponse(BaseModel):
    id: int
    name: str
    source_url: str
    source_type: str
    authority_level: str
    verification_status: str
    last_verified_at: Optional[datetime] = None
    monitoring_status: str
    last_checked: Optional[datetime] = None
    last_changed: Optional[datetime] = None
    change_summary: Optional[str] = None
    change_severity: str

    model_config = ConfigDict(from_attributes=True)


class KnowledgeChunkResponse(BaseModel):
    id: int
    document_id: int
    chunk_text: str
    section: str
    page_number: Optional[int] = None
    source_url: str
    source_name: Optional[str] = None
    authority_level: Optional[str] = "OFFICIAL"
    verification_status: Optional[str] = "VERIFIED"
    last_verified_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class KnowledgeDocumentResponse(BaseModel):
    id: int
    source_id: int
    scholarship_id: Optional[int] = None
    title: str
    content: str
    document_url: str
    retrieved_at: datetime
    last_verified_at: Optional[datetime] = None
    verification_status: str

    model_config = ConfigDict(from_attributes=True)


class KnowledgeSearchResponse(BaseModel):
    query: str
    chunks: List[KnowledgeChunkResponse]
    sources_cited: List[str]
    total_found: int
