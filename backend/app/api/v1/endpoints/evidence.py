from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.auth import get_current_user, verify_student_access
from app.models.user import User
from app.models.evidence import Evidence
from app.schemas.evidence import EvidenceCreate, EvidenceUpdate, EvidenceResponse

router = APIRouter()


@router.get("", response_model=List[EvidenceResponse])
def list_evidence(
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by verification_status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List reusable evidence records in the student's Evidence Bank.
    Scoped strictly to the authenticated student.
    """
    q = db.query(Evidence).filter(Evidence.student_id == current_user.student_id)
    if category:
        q = q.filter(Evidence.category == category)
    if status:
        q = q.filter(Evidence.verification_status == status)

    return q.order_by(Evidence.created_at.desc()).all()


@router.post("", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
def create_evidence(
    req: EvidenceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a new reusable achievement or credential to the student's Evidence Bank.
    Defaults to USER_PROVIDED verification status.
    """
    ev = Evidence(
        student_id=current_user.student_id,
        title=req.title,
        category=req.category,
        description=req.description,
        date=req.date,
        organization=req.organization,
        evidence_text=req.evidence_text,
        source_document_id=req.source_document_id,
        source_type=req.source_type or "USER_PROVIDED",
        source_name=req.source_name or "User Provided",
        verification_status="USER_PROVIDED",
        confidence="HIGH_EVIDENCE_SUPPORT"
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@router.get("/{id}", response_model=EvidenceResponse)
def get_evidence(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve specific evidence item. Enforces student ownership check.
    """
    ev = db.query(Evidence).filter(Evidence.id == id).first()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence item not found")

    verify_student_access(current_user, ev.student_id)
    return ev


@router.patch("/{id}", response_model=EvidenceResponse)
def update_evidence(
    id: int,
    req: EvidenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update evidence item fields. Student approval is required for state transitions.
    """
    ev = db.query(Evidence).filter(Evidence.id == id).first()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence item not found")

    verify_student_access(current_user, ev.student_id)

    update_data = req.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ev, field, value)

    db.commit()
    db.refresh(ev)
    return ev


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_evidence(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove user-created evidence item.
    """
    ev = db.query(Evidence).filter(Evidence.id == id).first()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence item not found")

    verify_student_access(current_user, ev.student_id)

    db.delete(ev)
    db.commit()
    return None
