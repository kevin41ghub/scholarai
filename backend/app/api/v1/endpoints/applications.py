from typing import List, Dict, Any, Optional, Union
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.auth import get_current_user, get_current_student, verify_student_access
from app.models.user import User
from app.models.student import Student
from app.services.deadline_risk_service import deadline_risk_service
from app.services.dependency_service import dependency_service
from app.services.bottleneck_service import bottleneck_service
from app.services.next_best_action_service import next_best_action_service
from app.services.application_status_service import application_status_service
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.models.scholarship import Scholarship
from app.services.external_submission_service import external_submission_service
from app.services.application_assistant_service import application_assistant_service
from app.schemas.application import (
    ApplicationResponse,
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationRequirementResponse,
    ApplicationRequirementUpdate,
    PortfolioSummaryResponse,
    ApplicationWithdrawRequest,
    ApplicationReviewActionRequest,
    ApplicationAssistantWorkspaceResponse,
    UpdateApplicationFieldsRequest,
    StudentApproveApplicationRequest,
    RecordExternalSubmissionRequest,
    OfficialApiSubmissionRequest,
)
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

router = APIRouter()


def _format_application_response(app: Application) -> ApplicationResponse:
    risk_info = deadline_risk_service.calculate_risk(app.scholarship.deadline, app.progress)
    missing_reqs = [
        r.name for r in app.requirements
        if r.is_required and r.status not in ["AVAILABLE", "VERIFIED"]
    ]

    req_responses = []
    for r in app.requirements:
        req_dict = {
            "id": r.id,
            "application_id": r.application_id,
            "name": r.name,
            "document_type": r.document_type,
            "type": r.type,
            "is_required": r.is_required,
            "status": r.status,
            "document_id": r.document_id,
            "verification_status": r.document.verification_status if r.document else None,
            "document_name": r.document.name if r.document else None,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        }
        req_responses.append(ApplicationRequirementResponse(**req_dict))

    required_reqs = [r for r in app.requirements if r.is_required]
    completed_required = [
        r for r in required_reqs
        if r.status in ["AVAILABLE", "VERIFIED"]
    ]

    next_act = None
    if app.status == "READY":
        next_act = "Review and submit application."
    elif app.status == "SUBMITTED":
        next_act = "Application submitted. Awaiting authority review."
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
        status_reason=app.status_reason,
        status_history=app.status_history or [],
        reviewed_by=app.reviewed_by,
        reviewed_at=app.reviewed_at,
        required_documents_total=len(required_reqs),
        required_documents_completed=len(completed_required),
        is_ready_for_submission=(app.status == "READY"),
        preparation_status=app.preparation_status or ("READY_TO_SUBMIT" if app.status == "SUBMITTED" else ("READY_FOR_REVIEW" if app.status == "READY" else "IN_PROGRESS")),
        submission_status=app.submission_status or ("SUBMITTED_EXTERNALLY" if app.status == "SUBMITTED" else "NOT_SUBMITTED"),
        submission_mode=app.submission_mode or external_submission_service.classify_scholarship_integration(app.scholarship),
        external_application_id=app.external_application_id,
        external_submission_at=app.external_submission_at,
        external_receipt_document_id=app.external_receipt_document_id,
        student_consented_at=app.student_consented_at,
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
        official_portal_url=app.scholarship.application_url if app.scholarship else None,
        official_portal_name=app.scholarship.official_portal_name if app.scholarship else None,
        deadline_risk=risk_info,
        missing_requirements_count=len(missing_reqs),
        requirements=req_responses,
        blockers=missing_reqs,
        next_action=next_act,
    )


@router.get("", response_model=List[ApplicationResponse], summary="List Student Applications")
def list_applications(
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    student = current_student
    apps = (
        db.query(Application)
        .filter(Application.student_id == student.id)
        .order_by(Application.started_at.desc())
        .all()
    )
    for app in apps:
        application_status_service.reconcile_application_requirements(db, app)
    db.commit()
    return [_format_application_response(app) for app in apps]
    return [_format_application_response(app) for app in apps]


@router.get("/portfolio-summary", response_model=PortfolioSummaryResponse, summary="Get Portfolio Dashboard Summary")
def get_portfolio_summary(
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    student = current_student
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
def get_application(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    verify_student_access(current_user, app.student_id)
    application_status_service.reconcile_application_requirements(db, app)
    db.commit()
    db.refresh(app)
    return _format_application_response(app)


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED, summary="Create Application")
def create_application(
    payload: ApplicationCreate,
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    scholarship = db.query(Scholarship).filter(Scholarship.id == payload.scholarship_id).first()
    if not scholarship:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scholarship not found")

    student = current_student

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

    # Reconcile requirements and compute real initial readiness & status based on backend records
    application_status_service.reconcile_application_requirements(db, new_app)

    db.commit()
    db.refresh(new_app)
    return _format_application_response(new_app)


@router.patch("/{id}", response_model=ApplicationResponse, summary="Update Application Personal Statement")
def update_application(
    id: int,
    payload: ApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    verify_student_access(current_user, app.student_id)

    # Server-side security: Students cannot manually manipulate application status via generic update endpoint
    if payload.status is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Direct manual modification of application status is forbidden. "
                "Application status is automatically calculated by backend verification and workflow rules. "
                "To submit, use POST /api/v1/applications/{id}/submit. "
                "To withdraw, use POST /api/v1/applications/{id}/withdraw."
            ),
        )

    if payload.personal_statement is not None:
        app.personal_statement = payload.personal_statement

    db.commit()
    db.refresh(app)
    return _format_application_response(app)


@router.post("/{id}/submit", response_model=ApplicationResponse, summary="Submit Application")
def submit_application(
    id: int,
    current_student: Student = Depends(get_current_student),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Dedicated authorized student submission workflow.
    Requires application to have status READY (all required documents uploaded and verified).
    """
    app = application_status_service.submit_application(
        db=db,
        application_id=id,
        student_id=current_student.id,
        actor_email=current_user.email,
    )
    return _format_application_response(app)


@router.post("/{id}/withdraw", response_model=ApplicationResponse, summary="Withdraw Application")
def withdraw_application(
    id: int,
    payload: Optional[ApplicationWithdrawRequest] = None,
    current_student: Student = Depends(get_current_student),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Dedicated authorized withdrawal workflow.
    Allows student owner or administrator to explicitly withdraw an active application.
    """
    reason = payload.reason if payload else None
    app = application_status_service.withdraw_application(
        db=db,
        application_id=id,
        user=current_user,
        student_id=current_student.id,
        reason=reason,
    )
    return _format_application_response(app)


@router.post(
    "/{id}/review",
    response_model=Union[ApplicationReviewResponse, ApplicationResponse],
    summary="Review Application (Institutional Review or Student AI Draft Review)"
)
def review_application(
    id: int,
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Review endpoint supporting:
    1. Authorized institutional review when 'action' is provided (UNDER_REVIEW, APPROVE, REJECT).
       Restricted to REVIEWER or ADMIN roles.
    2. Student AI draft/statement review when 'answer_text' is provided.
       Requires student ownership of the application.
    """
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    # If payload contains 'action', treat as institutional administrative review
    if "action" in payload:
        user_role = getattr(current_user, "role", "STUDENT")
        if user_role not in ["ADMIN", "REVIEWER"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Reviewer or Administrator role required to review applications."
            )
        action_req = ApplicationReviewActionRequest(**payload)
        updated_app = application_status_service.review_application(
            db=db,
            application_id=id,
            reviewer_user=current_user,
            action=action_req.action,
            reason=action_req.reason,
        )
        return _format_application_response(updated_app)

    # Otherwise, treat as student AI draft / answer review
    verify_student_access(current_user, app.student_id)
    ai_req = ApplicationReviewRequest(**payload)
    return review_application_answer(
        db=db,
        student_id=app.student_id,
        request=ai_req
    )


@router.post("/{id}/reconcile", response_model=ApplicationResponse, summary="Reconcile Application Requirements")
def reconcile_application(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Triggers backend reconciliation of requirements and recalculates readiness.
    """
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    verify_student_access(current_user, app.student_id)
    application_status_service.reconcile_application_requirements(db, app)
    db.commit()
    db.refresh(app)
    return _format_application_response(app)


@router.get("/{id}/requirements", response_model=List[ApplicationRequirementResponse], summary="Get Application Requirements")
def get_application_requirements(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    verify_student_access(current_user, app.student_id)

    application_status_service.reconcile_application_requirements(db, app)
    db.commit()
    db.refresh(app)

    req_responses = []
    for r in app.requirements:
        req_dict = {
            "id": r.id,
            "application_id": r.application_id,
            "name": r.name,
            "document_type": r.document_type,
            "type": r.type,
            "is_required": r.is_required,
            "status": r.status,
            "document_id": r.document_id,
            "verification_status": r.document.verification_status if r.document else None,
            "document_name": r.document.name if r.document else None,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        }
        req_responses.append(ApplicationRequirementResponse(**req_dict))
    return req_responses


@router.patch("/{id}/requirements/{requirement_id}", response_model=ApplicationRequirementResponse, summary="Update Application Requirement")
def update_application_requirement(
    id: int,
    requirement_id: int,
    payload: ApplicationRequirementUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    verify_student_access(current_user, app.student_id)

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

    # Server-side security: Students cannot manually mark requirement availability
    if payload.status is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Direct manual modification of requirement availability status is forbidden. "
                "Document availability is determined automatically by the backend upon file upload."
            ),
        )

    if payload.document_id is not None:
        req.document_id = payload.document_id

    application_status_service.reconcile_application_requirements(db, app)
    db.commit()
    db.refresh(req)

    req_dict = {
        "id": req.id,
        "application_id": req.application_id,
        "name": req.name,
        "document_type": req.document_type,
        "type": req.type,
        "is_required": req.is_required,
        "status": req.status,
        "document_id": req.document_id,
        "verification_status": req.document.verification_status if req.document else None,
        "document_name": req.document.name if req.document else None,
        "created_at": req.created_at,
        "updated_at": req.updated_at,
    }
    return ApplicationRequirementResponse(**req_dict)


# ==================================================
# BLOCK 3: AI APPLICATION ASSISTANCE ENDPOINTS
# ==================================================


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
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    verify_student_access(current_user, app.student_id)

    return generate_application_draft(
        db=db,
        student_id=current_user.student_id,
        application_id=id,
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
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    verify_student_access(current_user, app.student_id)

    return check_unsupported_claims(
        db=db,
        student_id=current_user.student_id,
        request=req
    )


# ==============================================================================
# Real Application Assistant Workspace & External Submission Endpoints
# ==============================================================================

@router.get(
    "/{id}/assistant",
    response_model=ApplicationAssistantWorkspaceResponse,
    summary="Get Full Application Assistant Workspace",
)
def get_application_assistant_workspace(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves the complete Application Assistant workspace for preparing,
    validating, and submitting a scholarship application.
    Enforces student ownership or admin authorization.
    """
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    verify_student_access(current_user, app.student_id)

    return application_assistant_service.get_or_build_workspace(db, app)


@router.put(
    "/{id}/assistant/fields",
    response_model=ApplicationAssistantWorkspaceResponse,
    summary="Update Application Preparation Form Fields",
)
def update_application_form_fields(
    id: int,
    payload: UpdateApplicationFieldsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates student-confirmed answers in the application form checklist.
    Enforces ownership and recalculates preparation readiness.
    """
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    verify_student_access(current_user, app.student_id)

    return application_assistant_service.update_form_fields(
        db=db,
        application=app,
        payload=payload,
        actor_email=current_user.email,
    )


@router.post(
    "/{id}/assistant/approve",
    response_model=ApplicationAssistantWorkspaceResponse,
    summary="Student Review and Approval of Application",
)
def student_approve_application(
    id: int,
    payload: StudentApproveApplicationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Explicit student consent step authorizing the prepared application package.
    """
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    verify_student_access(current_user, app.student_id)

    return application_assistant_service.approve_and_consent(
        db=db,
        application=app,
        payload=payload,
        actor_email=current_user.email,
    )


@router.post(
    "/{id}/assistant/record-external-submission",
    response_model=ApplicationResponse,
    summary="Record Verified External Application Submission",
)
def record_external_submission(
    id: int,
    payload: RecordExternalSubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Records student-submitted proof of external statutory portal application
    (e.g., National Scholarship Portal, TN SSP, Pudhumai Penn).
    """
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    verify_student_access(current_user, app.student_id)

    updated_app = external_submission_service.record_student_external_submission(
        db=db,
        application=app,
        payload=payload,
        actor_email=current_user.email,
    )
    return _format_application_response(updated_app)


@router.post(
    "/{id}/assistant/submit-api",
    response_model=ApplicationResponse,
    summary="Execute Official Direct API Submission",
)
def submit_via_official_api(
    id: int,
    payload: OfficialApiSubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Executes a direct API submission to an authorized scholarship provider API.
    Enforces idempotency, timeout protection, and explicit student consent.
    """
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    verify_student_access(current_user, app.student_id)

    updated_app = external_submission_service.execute_official_api_submission(
        db=db,
        application=app,
        payload=payload,
        actor_email=current_user.email,
    )
    return _format_application_response(updated_app)


@router.get(
    "/{id}/assistant/export-dossier",
    summary="Export Structured Application Dossier for External Portal",
)
def export_application_dossier(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Exports a clean, structured JSON dossier containing all verified fields,
    personal statements, and document references to facilitate error-free
    copy-paste into statutory government portals.
    """
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    verify_student_access(current_user, app.student_id)

    workspace = application_assistant_service.get_or_build_workspace(db, app)
    field_dict = {f.key: {"label": f.label, "value": f.value, "source": f.source} for f in workspace.fields}

    return {
        "scholarship_name": workspace.scholarship_name,
        "official_portal": workspace.official_portal_name,
        "official_url": workspace.official_portal_url,
        "student_name": app.student.name if app.student else "",
        "application_id": app.id,
        "preparation_status": workspace.preparation_status,
        "fields": field_dict,
        "personal_statement": app.personal_statement,
        "export_timestamp": datetime.now(timezone.utc).isoformat(),
        "disclaimer": "AI assists. Official sources decide. Student approves.",
    }
