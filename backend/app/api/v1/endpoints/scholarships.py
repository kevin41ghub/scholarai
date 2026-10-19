from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.auth import get_current_student
from app.models.student import Student
from app.services.eligibility_service import eligibility_service
from app.services.deadline_risk_service import deadline_risk_service
from app.models.scholarship import Scholarship
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.schemas.scholarship import (
    ScholarshipListItemResponse,
    ScholarshipDetailResponse,
    FundingImpactAnalysis,
)
from app.schemas.application import ApplicationResponse

router = APIRouter()


@router.get("", response_model=List[ScholarshipListItemResponse], summary="List & Discover Scholarships")
def list_scholarships(
    query: Optional[str] = Query(None, description="Search keyword in title, provider, or description"),
    stream: Optional[str] = Query(None, description="Filter by stream: ARTS_SCIENCE, ENGINEERING, BOTH"),
    category_tag: Optional[str] = Query(None, description="Filter by scholarship category"),
    study_level: Optional[str] = Query(None, description="Filter by study level: UG, PG, BOTH"),
    eligibility_filter: Optional[str] = Query(None, description="Filter by: all, eligible, possibly_eligible, ineligible, needs_verification"),
    status_filter: Optional[str] = Query(None, description="Filter by: ACTIVE, CLOSED, etc."),
    source_status: Optional[str] = Query(None, description="Filter by source status: SOURCE_VERIFIED, PARTIALLY_VERIFIED, etc."),
    verification_filter: Optional[str] = Query(None, description="Filter by verification status"),
    sort_by: Optional[str] = Query("recommended", description="Sort by: recommended, deadline, amount_high, amount_low, best_match"),
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    student = current_student

    # Base query
    scholarships_query = db.query(Scholarship)

    if query:
        term = f"%{query.strip()}%"
        scholarships_query = scholarships_query.filter(
            (Scholarship.name.ilike(term)) |
            (Scholarship.provider.ilike(term)) |
            (Scholarship.description.ilike(term)) |
            (Scholarship.dossier_index.ilike(term))
        )

    if stream and stream.upper() != "ALL":
        s_val = stream.upper()
        scholarships_query = scholarships_query.filter(Scholarship.stream.in_([s_val, "BOTH"]))

    if category_tag and category_tag.upper() != "ALL":
        scholarships_query = scholarships_query.filter(Scholarship.category_tag.ilike(f"%{category_tag.strip()}%"))

    if study_level and study_level.upper() != "ALL":
        l_val = study_level.upper()
        scholarships_query = scholarships_query.filter(Scholarship.study_level.in_([l_val, "BOTH"]))

    if status_filter:
        scholarships_query = scholarships_query.filter(Scholarship.status == status_filter.upper())
    else:
        # Default: exclude inactive scholarships from normal discovery
        scholarships_query = scholarships_query.filter(Scholarship.status != "INACTIVE")

    if source_status:
        scholarships_query = scholarships_query.filter(
            (Scholarship.source_verification_status == source_status.upper()) |
            (Scholarship.verification_status == source_status.upper())
        )
    elif verification_filter:
        scholarships_query = scholarships_query.filter(Scholarship.verification_status == verification_filter.upper())
    else:
        # Default: exclude retired demo scholarships from normal discovery
        scholarships_query = scholarships_query.filter(Scholarship.verification_status != "RETIRED_DEMO")

    all_scholarships = scholarships_query.all()

    # Fetch active applications of this student to map application_status
    existing_apps = {
        app.scholarship_id: app
        for app in db.query(Application).filter(Application.student_id == student.id).all()
    }

    # Evaluate intelligence for each scholarship
    items = []
    funding_gap = student.funding_profile.funding_gap if student.funding_profile else 65000.0

    for s in all_scholarships:
        eval_res = eligibility_service.evaluate_scholarship(student, s)
        risk_info = deadline_risk_service.calculate_risk(s.deadline)
        linked_app = existing_apps.get(s.id)

        # Generate "Why this may fit" transparent bullets
        fit_reasons = []
        coverage_pct = round((s.amount / funding_gap * 100), 0) if funding_gap > 0 else 100
        if coverage_pct > 0:
            fit_reasons.append(f"Could cover approximately {int(coverage_pct)}% of your estimated ₹{int(funding_gap):,} funding gap")

        if eval_res["status"] == "eligible":
            fit_reasons.append("Your current profile meets verified academic, stream, and income criteria")
        elif eval_res["status"] == "needs_verification":
            fit_reasons.append("Potential match; college allotment or category documentation requires verification")
        elif eval_res["status"] == "ineligible":
            if eval_res["unmatched_rules"]:
                fit_reasons.append(f"Ineligible: {eval_res['unmatched_rules'][0]}")

        if risk_info["risk_level"] in ["URGENT", "HIGH"]:
            fit_reasons.append(f"Application cycle closing soon ({risk_info['days_remaining']} days remaining)")

        item = ScholarshipListItemResponse(
            id=s.id,
            name=s.name,
            provider=s.provider,
            description=s.description,
            amount=s.amount,
            currency=s.currency,
            deadline=s.deadline,
            verification_status=s.verification_status,
            eligibility_summary=s.eligibility_summary,
            application_effort=s.application_effort,
            status=s.status,
            match_status=eval_res["status"],
            match_score=eval_res["score"],
            fit_reasons=fit_reasons,
            days_remaining=risk_info["days_remaining"],
            deadline_risk=risk_info["risk_level"],
            application_status=linked_app.status if linked_app else "NOT_STARTED",
            application_id=linked_app.id if linked_app else None,
            dossier_index=s.dossier_index,
            stream=s.stream,
            study_level=s.study_level,
            category_tag=s.category_tag,
            institution_types=s.institution_types,
            autonomous_compatibility=s.autonomous_compatibility,
            tn_residency_required=s.tn_residency_required,
            community_category=s.community_category,
            income_ceiling=s.income_ceiling,
            income_criteria_raw=s.income_criteria_raw,
            award_type=s.award_type,
            award_display=s.award_display,
            official_portal_name=s.official_portal_name,
            official_guideline_url=s.official_guideline_url,
            academic_year=s.academic_year,
            source_verification_status=s.source_verification_status or s.verification_status,
            application_window_status=s.application_window_status,
            unresolved_questions=s.unresolved_questions,
            disqualification_reasons=eval_res["unmatched_rules"] if eval_res["status"] == "ineligible" else [],
        )
        items.append(item)

    # Filter by eligibility if requested
    if eligibility_filter and eligibility_filter != "all":
        items = [i for i in items if i.match_status == eligibility_filter.lower()]

    # Sort items
    if sort_by == "deadline":
        items.sort(key=lambda x: x.deadline)
    elif sort_by == "amount_high":
        items.sort(key=lambda x: x.amount, reverse=True)
    elif sort_by == "amount_low":
        items.sort(key=lambda x: x.amount)
    elif sort_by in ["recommended", "best_match"]:
        # Sort by match_score descending, then deadline ascending
        items.sort(key=lambda x: (x.match_score or 0.0, -x.amount), reverse=True)

    return items


@router.get("/recommended", response_model=List[ScholarshipListItemResponse], summary="Get Recommended Scholarships")
def get_recommended_scholarships(
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """
    Returns scholarships sorted by transparent deterministic recommendation score.
    """
    return list_scholarships(sort_by="recommended", current_student=current_student, db=db)


@router.get("/{id}", response_model=ScholarshipDetailResponse, summary="Get Scholarship Detail")
def get_scholarship_detail(
    id: int,
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    scholarship = db.query(Scholarship).filter(Scholarship.id == id).first()
    if not scholarship:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scholarship not found")

    student = current_student
    eval_res = eligibility_service.evaluate_scholarship(student, scholarship)
    risk_info = deadline_risk_service.calculate_risk(scholarship.deadline)

    # Funding Impact Analysis
    current_gap = student.funding_profile.funding_gap if student.funding_profile else 60000.0
    potential_rem_gap = max(0.0, current_gap - scholarship.amount)
    coverage_pct = round((scholarship.amount / current_gap * 100), 1) if current_gap > 0 else 100.0

    funding_impact = FundingImpactAnalysis(
        current_funding_gap=current_gap,
        scholarship_amount=scholarship.amount,
        potential_remaining_gap=potential_rem_gap,
        gap_coverage_percentage=coverage_pct,
        disclaimer="Potential funding impact only. Does not assume receipt of award. Awards are determined exclusively by official providers."
    )

    linked_app = (
        db.query(Application)
        .filter(Application.student_id == student.id, Application.scholarship_id == scholarship.id)
        .first()
    )

    current_app_data = None
    if linked_app:
        current_app_data = {
            "id": linked_app.id,
            "status": linked_app.status,
            "progress": linked_app.progress,
            "started_at": linked_app.started_at,
        }

    return ScholarshipDetailResponse(
        id=scholarship.id,
        name=scholarship.name,
        provider=scholarship.provider,
        description=scholarship.description,
        amount=scholarship.amount,
        currency=scholarship.currency,
        deadline=scholarship.deadline,
        application_url=scholarship.application_url,
        source_url=scholarship.source_url,
        source_name=scholarship.source_name,
        verification_status=scholarship.verification_status,
        last_verified_at=scholarship.last_verified_at,
        eligibility_summary=scholarship.eligibility_summary,
        application_effort=scholarship.application_effort,
        status=scholarship.status,
        eligibility_rules=scholarship.eligibility_rules,
        requirements=scholarship.requirements,
        eligibility=eval_res,
        funding_impact=funding_impact,
        deadline_risk=risk_info,
        current_application=current_app_data,
        dossier_index=scholarship.dossier_index,
        stream=scholarship.stream,
        study_level=scholarship.study_level,
        category_tag=scholarship.category_tag,
        institution_types=scholarship.institution_types,
        autonomous_compatibility=scholarship.autonomous_compatibility,
        tn_residency_required=scholarship.tn_residency_required,
        community_category=scholarship.community_category,
        income_ceiling=scholarship.income_ceiling,
        income_criteria_raw=scholarship.income_criteria_raw,
        award_type=scholarship.award_type,
        award_display=scholarship.award_display,
        official_portal_name=scholarship.official_portal_name,
        official_guideline_url=scholarship.official_guideline_url,
        academic_year=scholarship.academic_year,
        source_verification_status=scholarship.source_verification_status or scholarship.verification_status,
        application_window_status=scholarship.application_window_status,
        unresolved_questions=scholarship.unresolved_questions,
        disqualification_reasons=eval_res["unmatched_rules"] if eval_res["status"] == "ineligible" else [],
    )


@router.get("/{id}/eligibility", summary="Evaluate Scholarship Eligibility")
def check_scholarship_eligibility(
    id: int,
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    scholarship = db.query(Scholarship).filter(Scholarship.id == id).first()
    if not scholarship:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scholarship not found")

    student = current_student
    return eligibility_service.evaluate_scholarship(student, scholarship)


@router.post("/{id}/apply", summary="Start Application for Scholarship")
def apply_to_scholarship(
    id: int,
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """
    Starts an application for the specified scholarship.
    Prevents duplicate active applications.
    Populates application requirements linked to student's documents.
    """
    scholarship = db.query(Scholarship).filter(Scholarship.id == id).first()
    if not scholarship:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scholarship not found")

    if scholarship.status == "INACTIVE" or scholarship.verification_status == "RETIRED_DEMO":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This scholarship has been retired and is no longer accepting new applications."
        )

    student = current_student

    # Check for existing application
    existing = (
        db.query(Application)
        .filter(Application.student_id == student.id, Application.scholarship_id == scholarship.id)
        .first()
    )
    if existing:
        return {
            "message": "Application already exists for this scholarship.",
            "application_id": existing.id,
            "status": existing.status,
            "progress": existing.progress,
            "is_new": False,
        }

    # Create new application
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

    # Link requirements based on student's existing documents
    docs_by_type = {
        doc.document_type: doc
        for doc in student.documents
    }

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

    # Compute initial progress
    if total_reqs > 0:
        new_app.progress = round((completed_count / total_reqs) * 100.0, 1)
        if new_app.progress >= 99.9:
            new_app.status = "READY"
    else:
        new_app.progress = 100.0
        new_app.status = "READY"

    db.commit()
    db.refresh(new_app)

    return {
        "message": f"Successfully started application for {scholarship.name}.",
        "application_id": new_app.id,
        "status": new_app.status,
        "progress": new_app.progress,
        "is_new": True,
    }
