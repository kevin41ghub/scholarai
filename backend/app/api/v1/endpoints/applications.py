from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.student_service import student_service
from app.services.deadline_risk_service import deadline_risk_service
from app.services.dependency_service import dependency_service
from app.services.bottleneck_service import bottleneck_service
from app.services.next_best_action_service import next_best_action_service
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.models.scholarship import Scholarship
from app.schemas.application import (
    ApplicationResponse,
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationRequirementResponse,
    ApplicationRequirementUpdate,
    PortfolioSummaryResponse,
)

router = APIRouter()


def _format_application_response(app: Application) -> ApplicationResponse:
    risk_info = deadline_risk_service.calculate_risk(app.scholarship.deadline, app.progress)
    missing_reqs = [r.name for r in app.requirements if r.status in ["MISSING", "NEEDS_VERIFICATION"]]

    next_act = None
    if app.status == "READY" or app.progress >= 99.9:
        next_act = "Review and submit application."
    elif missing_reqs:
        next_act = f"Provide {missing_reqs[0]}."
    elif not app.personal_statement or len(app.personal_statement.strip()) < 20:
        next_act = "Draft personal statement."
    else:
        next_act = "Finalize application checklist."

    return ApplicationResponse(
        id=app.id,
        student_id=app.student_id,
        scholarship_id=app.scholarship_id,
        status=app.status,
        progress=app.progress,
        personal_statement=app.personal_statement,
        started_at=app.started_at,
        submitted_at=app.submitted_at,
        created_at=app.created_at,
        updated_at=app.updated_at,
        scholarship_name=app.scholarship.name,
        scholarship_provider=app.scholarship.provider,
        scholarship_amount=app.scholarship.amount,
        scholarship_deadline=app.scholarship.deadline,
        verification_status=app.scholarship.verification_status,
        deadline_risk=risk_info,
        missing_requirements_count=len(missing_reqs),
        requirements=[ApplicationRequirementResponse.model_validate(r) for r in app.requirements],
        blockers=missing_reqs,
        next_action=next_act,
    )


@router.get("", response_model=List[ApplicationResponse], summary="List Student Applications")
def list_applications(db: Session = Depends(get_db)):
    student = student_service.get_or_create_primary_student(db)
    apps = (
        db.query(Application)
        .filter(Application.student_id == student.id)
        .order_by(Application.started_at.desc())
        .all()
    )
    return [_format_application_response(app) for app in apps]


@router.get("/portfolio-summary", response_model=PortfolioSummaryResponse, summary="Get Portfolio Dashboard Summary")
def get_portfolio_summary(db: Session = Depends(get_db)):
    student = student_service.get_or_create_primary_student(db)
    apps = (
        db.query(Application)
        .filter(Application.student_id == student.id)
        .all()
    )

    active_apps = [a for a in apps if a.status in ["IN_PROGRESS", "READY", "NOT_STARTED"]]
    funding_pursuit = sum(float(a.scholarship.amount) for a in active_apps)

    # Check at-risk and blocked
    at_risk_count = 0
    blocked_count = 0
    upcoming_deadlines = []

    for a in active_apps:
        risk = deadline_risk_service.calculate_risk(a.scholarship.deadline, a.progress)
        if risk["risk_level"] in ["URGENT", "HIGH"]:
            at_risk_count += 1

        has_missing = any(r.status in ["MISSING", "NEEDS_VERIFICATION"] for r in a.requirements)
        if has_missing:
            blocked_count += 1

        upcoming_deadlines.append({
            "application_id": a.id,
            "scholarship_name": a.scholarship.name,
            "deadline": a.scholarship.deadline.isoformat(),
            "days_remaining": risk["days_remaining"],
            "risk_level": risk["risk_level"],
            "progress": a.progress,
            "amount": a.scholarship.amount,
        })

    upcoming_deadlines.sort(key=lambda d: d["days_remaining"])

    # Shared blocker & top next action
    dep_data = dependency_service.get_dependency_graph(db, student.id)
    primary_blocker = dep_data.get("primary_blocker")
    actions = next_best_action_service.generate_and_rank_actions(db, student.id)
    top_action = actions[0] if actions else None

    return PortfolioSummaryResponse(
        active_applications_count=len(active_apps),
        at_risk_count=at_risk_count,
        blocked_count=blocked_count,
        potential_funding_under_pursuit=funding_pursuit,
        primary_shared_blocker=primary_blocker,
        top_next_best_action=top_action,
        upcoming_deadlines=upcoming_deadlines[:5],
    )


@router.get("/{id}", response_model=ApplicationResponse, summary="Get Application Details")
def get_application(id: int, db: Session = Depends(get_db)):
    student = student_service.get_or_create_primary_student(db)
    app = (
        db.query(Application)
        .filter(Application.id == id, Application.student_id == student.id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return _format_application_response(app)


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED, summary="Create Application")
def create_application(payload: ApplicationCreate, db: Session = Depends(get_db)):
    scholarship = db.query(Scholarship).filter(Scholarship.id == payload.scholarship_id).first()
    if not scholarship:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scholarship not found")

    student = student_service.get_or_create_primary_student(db)

    # Check duplicate
    existing = (
        db.query(Application)
        .filter(Application.student_id == student.id, Application.scholarship_id == scholarship.id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An application for this scholarship already exists."
        )

    new_app = Application(
        student_id=student.id,
        scholarship_id=scholarship.id,
        status="IN_PROGRESS",
        progress=0.0,
        personal_statement="",
        started_at=datetime.now(timezone.utc),
    )
    db.add(new_app)
    db.flush()

    docs_by_type = {doc.document_type: doc for doc in student.documents}
    completed_count = 0
    total_reqs = len(scholarship.requirements)

    for req in scholarship.requirements:
        matched_doc = docs_by_type.get(req.document_type)
        req_status = matched_doc.status if matched_doc else "MISSING"
        doc_id = matched_doc.id if matched_doc else None

        if req_status in ["AVAILABLE", "VERIFIED"]:
            completed_count += 1

        app_req = ApplicationRequirement(
            application_id=new_app.id,
            name=req.name,
            document_type=req.document_type,
            type=req.type,
            is_required=req.is_required,
            status=req_status,
            document_id=doc_id,
        )
        db.add(app_req)

    if total_reqs > 0:
        new_app.progress = round((completed_count / total_reqs) * 100.0, 1)
        if new_app.progress >= 99.9:
            new_app.status = "READY"
    else:
        new_app.progress = 100.0
        new_app.status = "READY"

    db.commit()
    db.refresh(new_app)
    return _format_application_response(new_app)


@router.patch("/{id}", response_model=ApplicationResponse, summary="Update Application")
def update_application(id: int, payload: ApplicationUpdate, db: Session = Depends(get_db)):
    student = student_service.get_or_create_primary_student(db)
    app = (
        db.query(Application)
        .filter(Application.id == id, Application.student_id == student.id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if payload.status is not None:
        app.status = payload.status
        if payload.status == "SUBMITTED" and not app.submitted_at:
            app.submitted_at = datetime.now(timezone.utc)

    if payload.personal_statement is not None:
        app.personal_statement = payload.personal_statement

    db.commit()
    db.refresh(app)
    return _format_application_response(app)


@router.get("/{id}/requirements", response_model=List[ApplicationRequirementResponse], summary="Get Application Requirements")
def get_application_requirements(id: int, db: Session = Depends(get_db)):
    student = student_service.get_or_create_primary_student(db)
    app = (
        db.query(Application)
        .filter(Application.id == id, Application.student_id == student.id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    return [ApplicationRequirementResponse.model_validate(r) for r in app.requirements]


@router.patch("/{id}/requirements/{requirement_id}", response_model=ApplicationRequirementResponse, summary="Update Application Requirement")
def update_application_requirement(
    id: int,
    requirement_id: int,
    payload: ApplicationRequirementUpdate,
    db: Session = Depends(get_db),
):
    student = student_service.get_or_create_primary_student(db)
    app = (
        db.query(Application)
        .filter(Application.id == id, Application.student_id == student.id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    req = (
        db.query(ApplicationRequirement)
        .filter(
            ApplicationRequirement.id == requirement_id,
            ApplicationRequirement.application_id == app.id
        )
        .first()
    )
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found")

    if payload.status is not None:
        req.status = payload.status
    if payload.document_id is not None:
        req.document_id = payload.document_id

    # Recalculate application progress
    total_reqs = len(app.requirements)
    completed_reqs = sum(
        1 for r in app.requirements
        if r.status in ["AVAILABLE", "VERIFIED"]
    )
    if total_reqs > 0:
        app.progress = round((completed_reqs / total_reqs) * 100.0, 1)
        if app.progress >= 99.9 and app.status == "IN_PROGRESS":
            app.status = "READY"
        elif app.progress < 99.9 and app.status == "READY":
            app.status = "IN_PROGRESS"

    db.commit()
    db.refresh(req)
    return ApplicationRequirementResponse.model_validate(req)


# ==================================================
# BLOCK 3: AI APPLICATION ASSISTANCE ENDPOINTS
# ==================================================

from app.schemas.application_ai import (
    ApplicationDraftRequest,
    ApplicationDraftResponse,
    ApplicationReviewRequest,
    ApplicationReviewResponse,
    EvidenceCheckRequest,
    EvidenceCheckResponse,
)
from app.services.ai.application_ai_service import (
    generate_application_draft,
    review_application_answer,
    check_unsupported_claims,
)
from app.core.auth import get_current_user
from app.models.user import User


@router.post("/{id}/draft", response_model=ApplicationDraftResponse)
def create_application_draft(
    id: int,
    req: ApplicationDraftRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate an AI application response draft strictly grounded in approved student evidence.
    Tag: AI GENERATED DRAFT. Requires explicit student approval before saving.
    """
    return generate_application_draft(
        db=db,
        student_id=current_user.student_id,
        application_id=id,
        request=req
    )


@router.post("/{id}/review", response_model=ApplicationReviewResponse)
def review_application(
    id: int,
    req: ApplicationReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Review draft application answer for unsupported claims, vague statements, and completeness.
    """
    return review_application_answer(
        db=db,
        student_id=current_user.student_id,
        request=req
    )


@router.post("/{id}/evidence-check", response_model=EvidenceCheckResponse)
def check_application_claims(
    id: int,
    req: EvidenceCheckRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check draft for unsupported claims against Evidence Bank and Student Profile.
    """
    return check_unsupported_claims(
        db=db,
        student_id=current_user.student_id,
        request=req
    )
