from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.student_service import student_service
from app.services.dependency_service import dependency_service
from app.models.document import Document
from app.schemas.document import DocumentResponse, DocumentCreate, DocumentUpdate

router = APIRouter()


@router.get("", response_model=List[DocumentResponse], summary="List Student Documents")
def list_documents(db: Session = Depends(get_db)):
    student = student_service.get_or_create_primary_student(db)
    docs = db.query(Document).filter(Document.student_id == student.id).all()

    # Retrieve dependency graph to enrich each document
    dep_data = dependency_service.get_dependency_graph(db, student.id)
    blockers_by_type = {b["document_type"]: b for b in dep_data.get("shared_blockers", [])}
    resolved_by_type = {r["document_type"]: r for r in dep_data.get("resolved_dependencies", [])}

    response_items = []
    for doc in docs:
        dtype = doc.document_type
        dep_info = blockers_by_type.get(dtype) or resolved_by_type.get(dtype)

        affected_count = len(dep_info["affected_applications"]) if dep_info else 0
        funding_affected = dep_info["potential_funding_affected"] if dep_info else 0.0
        is_blocker = dtype in blockers_by_type

        item = DocumentResponse(
            id=doc.id,
            student_id=doc.student_id,
            name=doc.name,
            document_type=doc.document_type,
            status=doc.status,
            uploaded_at=doc.uploaded_at,
            verified_at=doc.verified_at,
            expiry_date=doc.expiry_date,
            notes=doc.notes,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
            affected_applications_count=affected_count,
            potential_funding_affected=funding_affected,
            is_shared_blocker=is_blocker,
        )
        response_items.append(item)

    return response_items


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED, summary="Create Document")
def create_document(payload: DocumentCreate, db: Session = Depends(get_db)):
    student = student_service.get_or_create_primary_student(db)

    new_doc = Document(
        student_id=student.id,
        name=payload.name.strip(),
        document_type=payload.document_type.strip().upper(),
        status=payload.status,
        notes=payload.notes,
        uploaded_at=datetime.now(timezone.utc) if payload.status in ["AVAILABLE", "VERIFIED"] else None,
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # Run cascade update
    dependency_service.sync_document_to_requirements(db, student.id, new_doc)

    return DocumentResponse(
        id=new_doc.id,
        student_id=new_doc.student_id,
        name=new_doc.name,
        document_type=new_doc.document_type,
        status=new_doc.status,
        uploaded_at=new_doc.uploaded_at,
        verified_at=new_doc.verified_at,
        expiry_date=new_doc.expiry_date,
        notes=new_doc.notes,
        created_at=new_doc.created_at,
        updated_at=new_doc.updated_at,
        affected_applications_count=0,
        potential_funding_affected=0.0,
        is_shared_blocker=False,
    )


@router.patch("/{id}", response_model=DocumentResponse, summary="Update Document Status (Triggers Cascade Unblocking)")
def update_document(id: int, payload: DocumentUpdate, db: Session = Depends(get_db)):
    """
    Updates document status and triggers automatic cascade unblocking
    across all dependent application requirements.
    """
    student = student_service.get_or_create_primary_student(db)
    doc = db.query(Document).filter(Document.id == id, Document.student_id == student.id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    status_changed = False
    if payload.name is not None:
        doc.name = payload.name.strip()

    if payload.status is not None and payload.status != doc.status:
        doc.status = payload.status
        status_changed = True
        if payload.status in ["AVAILABLE", "VERIFIED"] and not doc.uploaded_at:
            doc.uploaded_at = datetime.now(timezone.utc)
        if payload.status == "VERIFIED" and not doc.verified_at:
            doc.verified_at = datetime.now(timezone.utc)

    if payload.notes is not None:
        doc.notes = payload.notes

    db.commit()
    db.refresh(doc)

    # Trigger cascade unblocking if status changed
    if status_changed:
        dependency_service.sync_document_to_requirements(db, student.id, doc)

    # Return updated document
    dep_data = dependency_service.get_dependency_graph(db, student.id)
    blockers_by_type = {b["document_type"]: b for b in dep_data.get("shared_blockers", [])}
    resolved_by_type = {r["document_type"]: r for r in dep_data.get("resolved_dependencies", [])}

    dep_info = blockers_by_type.get(doc.document_type) or resolved_by_type.get(doc.document_type)
    affected_count = len(dep_info["affected_applications"]) if dep_info else 0
    funding_affected = dep_info["potential_funding_affected"] if dep_info else 0.0

    return DocumentResponse(
        id=doc.id,
        student_id=doc.student_id,
        name=doc.name,
        document_type=doc.document_type,
        status=doc.status,
        uploaded_at=doc.uploaded_at,
        verified_at=doc.verified_at,
        expiry_date=doc.expiry_date,
        notes=doc.notes,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        affected_applications_count=affected_count,
        potential_funding_affected=funding_affected,
        is_shared_blocker=doc.document_type in blockers_by_type,
    )
