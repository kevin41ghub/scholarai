from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Response, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.auth import get_current_user, get_current_student, verify_student_access
from app.models.user import User
from app.models.student import Student
from app.models.document import Document
from app.models.application_requirement import ApplicationRequirement
from app.services.dependency_service import dependency_service
from app.services.storage_service import storage_service
from app.services.extraction_service import extraction_service
from app.services.verification_service import verification_service
from app.schemas.document import (
    DocumentResponse,
    DocumentCreate,
    DocumentUpdate,
    DocumentReviewRequest,
)

router = APIRouter()


def _enrich_document_response(
    doc: Document,
    blockers_by_type: dict,
    resolved_by_type: dict,
) -> DocumentResponse:
    dtype = doc.document_type
    dep_info = blockers_by_type.get(dtype) or resolved_by_type.get(dtype)

    affected_count = len(dep_info["affected_applications"]) if dep_info else 0
    funding_affected = dep_info["potential_funding_affected"] if dep_info else 0.0
    is_blocker = dtype in blockers_by_type

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
        storage_backend=doc.storage_backend,
        storage_key=doc.storage_key,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        content_hash=doc.content_hash,
        original_filename=doc.original_filename,
        extraction_status=doc.extraction_status,
        verification_status=doc.verification_status,
        extracted_data=doc.extracted_data,
        verification_results=doc.verification_results,
        failure_reasons=doc.failure_reasons,
        reviewed_by=doc.reviewed_by,
        reviewed_at=doc.reviewed_at,
        audit_history=doc.audit_history,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        affected_applications_count=affected_count,
        potential_funding_affected=funding_affected,
        is_shared_blocker=is_blocker,
    )


@router.get("", response_model=List[DocumentResponse], summary="List Student Documents")
def list_documents(
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    student = current_student
    docs = db.query(Document).filter(Document.student_id == student.id).all()

    # Retrieve dependency graph to enrich each document
    dep_data = dependency_service.get_dependency_graph(db, student.id)
    blockers_by_type = {b["document_type"]: b for b in dep_data.get("shared_blockers", [])}
    resolved_by_type = {r["document_type"]: r for r in dep_data.get("resolved_dependencies", [])}

    return [_enrich_document_response(doc, blockers_by_type, resolved_by_type) for doc in docs]


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED, summary="Upload Real Document File")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    notes: Optional[str] = Form(None),
    current_student: Student = Depends(get_current_student),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Production binary document upload:
    - Enforces file size (max 10MB) and format whitelist (PDF, JPG, PNG)
    - Validates magic byte signatures to prevent spoofed MIME types
    - Saves to secure private storage (Local or Cloudflare R2 / S3) with unpredictable keys
    - Extracts structured data (PDF text and OCR metadata)
    - Runs rule-based transparent verification engine
    - Unblocks dependent applications and records tamper-evident audit history
    """
    student = current_student
    content = await file.read()
    now = datetime.now(timezone.utc)
    clean_type = document_type.strip().upper()

    # 1. Validate & Store binary file
    storage_meta = storage_service.store_document(
        student_id=student.id,
        content=content,
        filename=file.filename or "uploaded_file",
        category=clean_type,
        declared_mime=file.content_type,
    )

    # 2. Extract structured fields
    extraction_res = extraction_service.extract_document(
        raw_bytes=content,
        mime_type=storage_meta["mime_type"],
        document_type=clean_type,
    )

    # 3. Check for existing document of this type for this student
    existing_doc = (
        db.query(Document)
        .filter(Document.student_id == student.id, Document.document_type == clean_type)
        .first()
    )

    # 4. Run rule-based verification suite
    verif_res = verification_service.verify_document(
        db=db,
        student=student,
        document_type=clean_type,
        file_size=storage_meta["file_size"],
        mime_type=storage_meta["mime_type"],
        content_hash=storage_meta["content_hash"],
        extracted_fields=extraction_res.get("extracted_fields", {}),
        extraction_status=extraction_res.get("extraction_status", "PENDING"),
        existing_doc_id=existing_doc.id if existing_doc else None,
    )

    # 5. Build or update audit log
    audit_event = {
        "action": "UPLOAD",
        "actor": current_user.email,
        "filename": storage_meta["clean_filename"],
        "file_size": storage_meta["file_size"],
        "content_hash": storage_meta["content_hash"],
        "verification_status": verif_res["verification_status"],
        "timestamp": now.isoformat(),
    }

    if existing_doc:
        # If replacing an existing file, clean up old storage key if different
        if existing_doc.storage_key and existing_doc.storage_key != storage_meta["storage_key"]:
            try:
                storage_service.delete_document(existing_doc.storage_key)
            except Exception:
                pass

        doc = existing_doc
        doc.name = storage_meta["clean_filename"]
        doc.storage_key = storage_meta["storage_key"]
        doc.storage_backend = storage_meta["storage_backend"]
        doc.file_size = storage_meta["file_size"]
        doc.mime_type = storage_meta["mime_type"]
        doc.content_hash = storage_meta["content_hash"]
        doc.original_filename = file.filename or "uploaded_file"
        doc.status = verif_res["status"]
        doc.verification_status = verif_res["verification_status"]
        doc.extraction_status = extraction_res["extraction_status"]
        doc.extracted_data = extraction_res
        doc.verification_results = verif_res["verification_results"]
        doc.failure_reasons = verif_res["failure_reasons"]
        doc.uploaded_at = now
        if verif_res.get("expiry_date"):
            doc.expiry_date = verif_res["expiry_date"]
        if notes:
            doc.notes = notes

        history = list(doc.audit_history or [])
        history.append(audit_event)
        doc.audit_history = history
    else:
        doc = Document(
            student_id=student.id,
            name=storage_meta["clean_filename"],
            document_type=clean_type,
            status=verif_res["status"],
            storage_key=storage_meta["storage_key"],
            storage_backend=storage_meta["storage_backend"],
            file_size=storage_meta["file_size"],
            mime_type=storage_meta["mime_type"],
            content_hash=storage_meta["content_hash"],
            original_filename=file.filename or "uploaded_file",
            extraction_status=extraction_res["extraction_status"],
            verification_status=verif_res["verification_status"],
            extracted_data=extraction_res,
            verification_results=verif_res["verification_results"],
            failure_reasons=verif_res["failure_reasons"],
            uploaded_at=now,
            expiry_date=verif_res.get("expiry_date"),
            notes=notes,
            audit_history=[audit_event],
        )
        db.add(doc)

    db.commit()
    db.refresh(doc)

    # 6. Cascade unblocking
    dependency_service.sync_document_to_requirements(db, student.id, doc)

    # Return enriched response
    dep_data = dependency_service.get_dependency_graph(db, student.id)
    blockers_by_type = {b["document_type"]: b for b in dep_data.get("shared_blockers", [])}
    resolved_by_type = {r["document_type"]: r for r in dep_data.get("resolved_dependencies", [])}

    return _enrich_document_response(doc, blockers_by_type, resolved_by_type)


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED, summary="Create Document Record")
def create_document(
    payload: DocumentCreate,
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    student = current_student

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

    dep_data = dependency_service.get_dependency_graph(db, student.id)
    blockers_by_type = {b["document_type"]: b for b in dep_data.get("shared_blockers", [])}
    resolved_by_type = {r["document_type"]: r for r in dep_data.get("resolved_dependencies", [])}

    return _enrich_document_response(new_doc, blockers_by_type, resolved_by_type)


@router.get("/{id}", response_model=DocumentResponse, summary="Get Document Details")
def get_document(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    verify_student_access(current_user, doc.student_id)

    dep_data = dependency_service.get_dependency_graph(db, doc.student_id)
    blockers_by_type = {b["document_type"]: b for b in dep_data.get("shared_blockers", [])}
    resolved_by_type = {r["document_type"]: r for r in dep_data.get("resolved_dependencies", [])}

    return _enrich_document_response(doc, blockers_by_type, resolved_by_type)


@router.get("/{id}/download", summary="Securely Preview or Download Document")
def download_document(
    id: int,
    inline: bool = Query(False, description="Preview document inline if True, otherwise download as attachment"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Secure document stream.
    Enforces strict ownership authorization. Prevents path traversal and insecure direct object access.
    """
    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    verify_student_access(current_user, doc.student_id)

    if not doc.storage_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No binary file stored for this document record.",
        )

    try:
        file_bytes = storage_service.retrieve_document(doc.storage_key)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage backend unavailable: {str(e)}",
        )

    disposition = "inline" if inline else "attachment"
    filename = doc.original_filename or f"{doc.name}.{doc.mime_type.split('/')[-1] if doc.mime_type else 'bin'}"
    # Sanitize header filename
    safe_filename = filename.replace('"', '').replace('\n', '').replace('\r', '')

    headers = {
        "Content-Disposition": f'{disposition}; filename="{safe_filename}"',
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
    }

    return Response(
        content=file_bytes,
        media_type=doc.mime_type or "application/octet-stream",
        headers=headers,
    )


@router.post("/{id}/re-extract", response_model=DocumentResponse, summary="Re-run Extraction & Verification")
def re_extract_document(
    id: int,
    current_user: User = Depends(get_current_user),
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    verify_student_access(current_user, doc.student_id)

    if not doc.storage_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No stored binary file to re-extract.")

    file_bytes = storage_service.retrieve_document(doc.storage_key)

    extraction_res = extraction_service.extract_document(
        raw_bytes=file_bytes,
        mime_type=doc.mime_type or "application/pdf",
        document_type=doc.document_type,
    )

    verif_res = verification_service.verify_document(
        db=db,
        student=current_student,
        document_type=doc.document_type,
        file_size=doc.file_size or len(file_bytes),
        mime_type=doc.mime_type or "application/pdf",
        content_hash=doc.content_hash or "unknown",
        extracted_fields=extraction_res.get("extracted_fields", {}),
        extraction_status=extraction_res.get("extraction_status", "PENDING"),
        existing_doc_id=doc.id,
    )

    now = datetime.now(timezone.utc)
    doc.extraction_status = extraction_res["extraction_status"]
    doc.extracted_data = extraction_res
    doc.verification_status = verif_res["verification_status"]
    doc.status = verif_res["status"]
    doc.verification_results = verif_res["verification_results"]
    doc.failure_reasons = verif_res["failure_reasons"]
    if verif_res.get("expiry_date"):
        doc.expiry_date = verif_res["expiry_date"]

    history = list(doc.audit_history or [])
    history.append({
        "action": "RE_EXTRACT",
        "actor": current_user.email,
        "verification_status": verif_res["verification_status"],
        "timestamp": now.isoformat(),
    })
    doc.audit_history = history

    db.commit()
    db.refresh(doc)

    dependency_service.sync_document_to_requirements(db, doc.student_id, doc)

    dep_data = dependency_service.get_dependency_graph(db, doc.student_id)
    blockers_by_type = {b["document_type"]: b for b in dep_data.get("shared_blockers", [])}
    resolved_by_type = {r["document_type"]: r for r in dep_data.get("resolved_dependencies", [])}

    return _enrich_document_response(doc, blockers_by_type, resolved_by_type)


@router.patch("/{id}", response_model=DocumentResponse, summary="Update Document Status")
def update_document(
    id: int,
    payload: DocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    verify_student_access(current_user, doc.student_id)

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

    if status_changed:
        dependency_service.sync_document_to_requirements(db, doc.student_id, doc)

    dep_data = dependency_service.get_dependency_graph(db, doc.student_id)
    blockers_by_type = {b["document_type"]: b for b in dep_data.get("shared_blockers", [])}
    resolved_by_type = {r["document_type"]: r for r in dep_data.get("resolved_dependencies", [])}

    return _enrich_document_response(doc, blockers_by_type, resolved_by_type)


@router.delete("/{id}", summary="Delete Document and Associated Binary File")
def delete_document(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Safely deletes document from persistent storage and database,
    and updates dependent application requirements.
    """
    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    verify_student_access(current_user, doc.student_id)

    student_id = doc.student_id
    document_type = doc.document_type

    # 1. Delete physical/cloud file
    if doc.storage_key:
        try:
            storage_service.delete_document(doc.storage_key)
        except Exception as e:
            # Continue even if storage deletion fails to avoid orphaned database state
            pass

    # 2. Unlink from application requirements
    reqs = (
        db.query(ApplicationRequirement)
        .filter(ApplicationRequirement.document_id == doc.id)
        .all()
    )
    for req in reqs:
        req.document_id = None
        req.status = "MISSING"

    # 3. Delete database record
    db.delete(doc)
    db.commit()

    # 4. Trigger cascade update
    # Create a temporary dummy doc to re-evaluate requirements
    dummy_doc = Document(student_id=student_id, document_type=document_type, status="MISSING")
    dependency_service.sync_document_to_requirements(db, student_id, dummy_doc)

    return {"message": "Document deleted successfully", "id": id}


@router.post("/{id}/review", response_model=DocumentResponse, summary="Authorized Human Reviewer Action")
def review_document(
    id: int,
    payload: DocumentReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Authorized human review:
    Requires REVIEWER or ADMIN user role. Non-reviewer requests are rejected with 403.
    """
    user_role = getattr(current_user, "role", "STUDENT")
    if user_role not in ["REVIEWER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authorized human reviewer role required to perform official document review.",
        )

    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    now = datetime.now(timezone.utc)
    prev_status = doc.verification_status

    if payload.action == "APPROVE":
        doc.verification_status = "OFFICIALLY_VERIFIED"
        doc.status = "VERIFIED"
        doc.verified_at = now
    elif payload.action == "REJECT":
        doc.verification_status = "REJECTED"
        doc.status = "NEEDS_VERIFICATION"
    elif payload.action == "REQUEST_CHANGES":
        doc.verification_status = "NEEDS_HUMAN_REVIEW"

    doc.reviewed_by = current_user.email
    doc.reviewed_at = now

    history = list(doc.audit_history or [])
    history.append({
        "action": f"REVIEW_{payload.action}",
        "actor": current_user.email,
        "role": user_role,
        "previous_status": prev_status,
        "new_status": doc.verification_status,
        "reason": payload.reason,
        "timestamp": now.isoformat(),
    })
    doc.audit_history = history

    db.commit()
    db.refresh(doc)

    dependency_service.sync_document_to_requirements(db, doc.student_id, doc)

    dep_data = dependency_service.get_dependency_graph(db, doc.student_id)
    blockers_by_type = {b["document_type"]: b for b in dep_data.get("shared_blockers", [])}
    resolved_by_type = {r["document_type"]: r for r in dep_data.get("resolved_dependencies", [])}

    return _enrich_document_response(doc, blockers_by_type, resolved_by_type)
