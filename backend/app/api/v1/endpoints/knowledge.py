from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.knowledge import KnowledgeSource, KnowledgeDocument
from app.schemas.knowledge import KnowledgeSourceResponse, KnowledgeSearchResponse
from app.services.ai.rag_service import search_knowledge_base

router = APIRouter()


@router.get("/sources", response_model=List[KnowledgeSourceResponse])
def list_knowledge_sources(db: Session = Depends(get_db)):
    """
    List indexed knowledge sources and their verification/monitoring status.
    """
    return db.query(KnowledgeSource).order_by(KnowledgeSource.id.asc()).all()


@router.get("/search", response_model=KnowledgeSearchResponse)
def search_knowledge(
    q: str = Query(..., min_length=2, description="Knowledge search query"),
    scholarship_id: Optional[int] = Query(None, description="Optional scholarship filter"),
    limit: int = Query(5, ge=1, le=10),
    db: Session = Depends(get_db)
):
    """
    Perform RAG retrieval against official scholarship documentation and guidelines.
    Returns matching chunks along with source verification metadata and citations.
    """
    return search_knowledge_base(db=db, query=q, scholarship_id=scholarship_id, limit=limit)


@router.get("/{id}", response_model=KnowledgeSourceResponse)
def get_knowledge_source(id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a knowledge source.
    """
    source = db.query(KnowledgeSource).filter(KnowledgeSource.id == id).first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge source not found")
    return source
