import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.knowledge import KnowledgeSource, KnowledgeDocument, KnowledgeChunk
from app.services.ai.prompt_guard import sanitize_untrusted_content, validate_safe_url
from app.schemas.knowledge import KnowledgeChunkResponse, KnowledgeSearchResponse


def ingest_knowledge_document(
    db: Session,
    source_id: int,
    title: str,
    content: str,
    document_url: str,
    scholarship_id: Optional[int] = None,
    section_name: str = "General",
    verification_status: str = "DEMO_DATA"
) -> KnowledgeDocument:
    """
    Ingest a knowledge document and partition into retrievable chunks.
    Calculates SHA-256 hash for version tracking and change monitoring.
    """
    safe_content = sanitize_untrusted_content(content)
    content_hash = hashlib.sha256(safe_content.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)

    doc = KnowledgeDocument(
        source_id=source_id,
        scholarship_id=scholarship_id,
        title=title,
        content=safe_content,
        document_url=document_url,
        content_hash=content_hash,
        retrieved_at=now,
        last_verified_at=now,
        verification_status=verification_status
    )
    db.add(doc)
    db.flush()

    # Split document into chunks (by paragraph or fixed size)
    paragraphs = [p.strip() for p in safe_content.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [safe_content]

    for idx, p in enumerate(paragraphs):
        chunk = KnowledgeChunk(
            document_id=doc.id,
            chunk_text=p,
            section=f"{section_name} - Part {idx + 1}" if len(paragraphs) > 1 else section_name,
            source_url=document_url,
            metadata_json=f'{{"source_id": {source_id}, "chunk_index": {idx}}}'
        )
        db.add(chunk)

    db.commit()
    db.refresh(doc)
    return doc


def search_knowledge_base(
    db: Session,
    query: str,
    scholarship_id: Optional[int] = None,
    limit: int = 5
) -> KnowledgeSearchResponse:
    """
    Search indexed knowledge base chunks using token-matching with source citation preservation.
    """
    query_clean = sanitize_untrusted_content(query.strip())
    query_words = [w.lower() for w in query_clean.split() if len(w) > 2]

    q = db.query(KnowledgeChunk).join(KnowledgeDocument)
    if scholarship_id:
        q = q.filter(KnowledgeDocument.scholarship_id == scholarship_id)

    chunks = q.all()
    scored_chunks = []

    for chunk in chunks:
        text_lower = chunk.chunk_text.lower()
        score = sum(text_lower.count(w) * 2 for w in query_words)
        if score > 0:
            scored_chunks.append((score, chunk))

    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    selected = scored_chunks[:limit]

    results: List[KnowledgeChunkResponse] = []
    sources_cited: List[str] = []

    for _, chunk in selected:
        doc = chunk.document
        source = doc.source
        source_cite = f"{source.name} [{source.verification_status}] (Verified: {source.last_verified_at.strftime('%Y-%m-%d') if source.last_verified_at else 'Needs Verification'})"
        if source_cite not in sources_cited:
            sources_cited.append(source_cite)

        results.append(
            KnowledgeChunkResponse(
                id=chunk.id,
                document_id=chunk.document_id,
                chunk_text=chunk.chunk_text,
                section=chunk.section,
                page_number=chunk.page_number,
                source_url=chunk.source_url,
                source_name=source.name,
                authority_level=source.authority_level,
                verification_status=source.verification_status,
                last_verified_at=source.last_verified_at.strftime("%Y-%m-%d") if source.last_verified_at else None
            )
        )

    return KnowledgeSearchResponse(
        query=query_clean,
        chunks=results,
        sources_cited=sources_cited,
        total_found=len(results)
    )
