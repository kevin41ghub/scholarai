from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.auth import get_current_student, get_current_admin_user
from app.models.student import Student
from app.models.user import User
from app.services.eligibility_service import eligibility_service
from app.services.deadline_risk_service import deadline_risk_service
from app.services.scholarship_import_service import scholarship_import_service
from app.services.application_status_service import application_status_service
from app.models.scholarship import Scholarship, KNOWN_FICTIONAL_DEMO_NAMES, RETIRED_DEMO_STATUSES
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.models.knowledge import KnowledgeDocument
from app.schemas.scholarship import (
    ScholarshipListItemResponse,
    ScholarshipDetailResponse,
    FundingImpactAnalysis,
    OfficialDossierChunk,
    OfficialDossierResponse,
    ScholarshipRecommendationItem,
    ScholarshipRequirementResponse,
    PersonalizedRecommendationsResponse,
)
from app.schemas.scholarship_import import (
    ScholarshipImportRequest,
    ScholarshipImportSummary,
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

    # Base query: Exclude retired/demo/test records unconditionally from student discovery
    scholarships_query = db.query(Scholarship).filter(
        Scholarship.status != "INACTIVE",
        Scholarship.verification_status.notin_(RETIRED_DEMO_STATUSES),
        ~Scholarship.name.in_(KNOWN_FICTIONAL_DEMO_NAMES),
        ~Scholarship.provider.ilike("%(Demo)%"),
    )

    # Unwrap string query params in case called directly as a Python function
    q_str = query if isinstance(query, str) else None
    stream_str = stream if isinstance(stream, str) else None
    cat_str = category_tag if isinstance(category_tag, str) else None
    level_str = study_level if isinstance(study_level, str) else None
    status_str = status_filter if isinstance(status_filter, str) else None
    source_str = source_status if isinstance(source_status, str) else None
    verif_str = verification_filter if isinstance(verification_filter, str) else None

    if q_str and q_str.strip():
        term = f"%{q_str.strip()}%"
        scholarships_query = scholarships_query.filter(
            (Scholarship.name.ilike(term)) |
            (Scholarship.provider.ilike(term)) |
            (Scholarship.description.ilike(term)) |
            (Scholarship.dossier_index.ilike(term))
        )

    if stream_str and stream_str.upper() != "ALL":
        s_val = stream_str.upper()
        scholarships_query = scholarships_query.filter(Scholarship.stream.in_([s_val, "BOTH"]))

    if cat_str and cat_str.upper() != "ALL":
        scholarships_query = scholarships_query.filter(Scholarship.category_tag.ilike(f"%{cat_str.strip()}%"))

    if level_str and level_str.upper() != "ALL":
        l_val = level_str.upper()
        scholarships_query = scholarships_query.filter(Scholarship.study_level.in_([l_val, "BOTH"]))

    if status_str and status_str.upper() != "ALL":
        scholarships_query = scholarships_query.filter(Scholarship.status == status_str.upper())
    else:
        # Default: only active scholarships
        scholarships_query = scholarships_query.filter(Scholarship.status == "ACTIVE")

    if source_str and source_str.upper() != "ALL":
        scholarships_query = scholarships_query.filter(
            (Scholarship.source_verification_status == source_str.upper()) |
            (Scholarship.verification_status == source_str.upper())
        )
    elif verif_str and verif_str.upper() != "ALL":
        scholarships_query = scholarships_query.filter(Scholarship.verification_status == verif_str.upper())

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
            recommendation_category=eval_res.get("recommendation_category", "POTENTIALLY_ELIGIBLE"),
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

    # Filter by eligibility or recommendation category if requested
    elig_str = eligibility_filter if isinstance(eligibility_filter, str) else None
    sort_str = sort_by if isinstance(sort_by, str) else "recommended"

    if elig_str and elig_str != "all":
        elig_upper = elig_str.upper()
        if elig_upper in ["LIKELY_ELIGIBLE", "POTENTIALLY_ELIGIBLE", "CURRENTLY_INELIGIBLE", "WINDOW_NEEDS_VERIFICATION"]:
            items = [i for i in items if i.recommendation_category == elig_upper]
        else:
            items = [i for i in items if i.match_status == elig_str.lower()]

    # Sort items
    if sort_str == "deadline":
        items.sort(key=lambda x: x.deadline)
    elif sort_str == "amount_high":
        items.sort(key=lambda x: x.amount, reverse=True)
    elif sort_str == "amount_low":
        items.sort(key=lambda x: x.amount)
    elif sort_str in ["recommended", "best_match"]:
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
    return list_scholarships(
        query=None,
        stream=None,
        category_tag=None,
        study_level=None,
        eligibility_filter=None,
        status_filter="ACTIVE",
        source_status=None,
        verification_filter=None,
        sort_by="recommended",
        current_student=current_student,
        db=db,
    )


@router.get("/recommendations", response_model=PersonalizedRecommendationsResponse, summary="Get Categorized Personalized Recommendations")
def get_personalized_recommendations(
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """
    Evaluates active scholarships deterministically against student's saved profile.
    Classifies results into 4 explicit categories:
    1. Likely Eligible
    2. Potentially Eligible — More Information Required
    3. Currently Ineligible — Explain Why
    4. Deadline or Application Window Needs Verification
    """
    scholarships = db.query(Scholarship).filter(
        Scholarship.status == "ACTIVE",
        Scholarship.verification_status.notin_(RETIRED_DEMO_STATUSES),
        ~Scholarship.name.in_(KNOWN_FICTIONAL_DEMO_NAMES),
        ~Scholarship.provider.ilike("%(Demo)%"),
    ).all()

    likely_eligible = []
    potentially_eligible = []
    currently_ineligible = []
    window_needs_verification = []

    for s in scholarships:
        eval_res = eligibility_service.evaluate_scholarship(current_student, s)
        risk_info = deadline_risk_service.calculate_risk(s.deadline)

        category = eval_res.get("recommendation_category", "POTENTIALLY_ELIGIBLE")

        item = ScholarshipRecommendationItem(
            id=s.id,
            name=s.name,
            provider=s.provider,
            benefit_type=getattr(s, "benefit_type", "SCHOLARSHIP") or "SCHOLARSHIP",
            amount=s.amount,
            currency=s.currency,
            award_display=s.award_display or f"Up to ₹{int(s.amount):,} funding",
            eligibility_summary=s.eligibility_summary or "Official guidelines specify criteria for this scheme.",
            recommendation_category=category,
            match_score=eval_res["score"],
            why_matched=eval_res["matched_rules"],
            satisfied_requirements=eval_res["matched_rules"],
            missing_information=eval_res.get("missing_information", []),
            requirements_needing_verification=eval_res.get("requirements_needing_verification", []),
            required_documents=[r.name for r in (s.requirements or [])],
            requirements=[
                ScholarshipRequirementResponse.model_validate(r) for r in (s.requirements or [])
            ],
            dossier_index=s.dossier_index,
            stream=s.stream or "BOTH",
            study_level=s.study_level or "BOTH",
            category_tag=s.category_tag or "GOVERNMENT",
            institution_types=s.institution_types,
            autonomous_compatibility=s.autonomous_compatibility,
            tn_residency_required=s.tn_residency_required in [True, "YES", "yes", "1", 1] if s.tn_residency_required is not None else True,
            community_category=s.community_category or "ALL",
            income_ceiling=s.income_ceiling,
            income_criteria_raw=s.income_criteria_raw,
            award_type=s.award_type or "VARIABLE_ASSISTANCE",
            official_portal_name=s.official_portal_name,
            unresolved_questions=s.unresolved_questions,
            deadline=s.deadline,
            academic_year=s.academic_year or "2024-2025 / 2025-2026",
            official_source_url=s.source_url or s.official_guideline_url,
            official_application_portal_url=s.application_url,
            last_verified_at=s.last_verified_at or s.updated_at,
            days_remaining=risk_info["days_remaining"],
            disclaimer="AI assists. Official sources decide. Student approves. Never guaranteed."
        )

        if category == "LIKELY_ELIGIBLE":
            likely_eligible.append(item)
        elif category == "CURRENTLY_INELIGIBLE":
            currently_ineligible.append(item)
        elif category == "WINDOW_NEEDS_VERIFICATION":
            window_needs_verification.append(item)
        else:
            potentially_eligible.append(item)

    # Sort within categories
    likely_eligible.sort(key=lambda x: (x.match_score, x.amount), reverse=True)
    potentially_eligible.sort(key=lambda x: (x.match_score, x.amount), reverse=True)
    window_needs_verification.sort(key=lambda x: x.deadline)

    prof = current_student.profile
    fund = current_student.funding_profile

    return PersonalizedRecommendationsResponse(
        student_name=current_student.name,
        student_profile_summary={
            "course": prof.course if prof else "Not declared",
            "stream": getattr(prof, "stream", "Engineering & Technology") if prof else "Not declared",
            "year": prof.year if prof else "Not declared",
            "category": prof.category if prof else "BC",
            "state": prof.state if prof else "Tamil Nadu",
            "annual_family_income": fund.annual_family_income if fund else 0.0,
            "funding_gap": fund.funding_gap if fund else 0.0,
        },
        total_recommendations=len(likely_eligible) + len(potentially_eligible) + len(currently_ineligible) + len(window_needs_verification),
        likely_eligible=likely_eligible,
        potentially_eligible=potentially_eligible,
        currently_ineligible=currently_ineligible,
        window_needs_verification=window_needs_verification,
    )


def _build_official_dossier(db: Session, scholarship: Scholarship) -> OfficialDossierResponse:
    kdocs = (
        db.query(KnowledgeDocument)
        .filter(KnowledgeDocument.scholarship_id == scholarship.id)
        .all()
    )

    dossier_chunks: List[OfficialDossierChunk] = []
    primary_source = None
    primary_doc = None

    for doc in kdocs:
        if not primary_doc:
            primary_doc = doc
        source = doc.source
        if source and not primary_source:
            primary_source = source
        for c in doc.chunks:
            dossier_chunks.append(
                OfficialDossierChunk(
                    id=c.id,
                    document_id=doc.id,
                    document_title=doc.title,
                    section=c.section,
                    chunk_text=c.chunk_text,
                    source_name=source.name if source else (scholarship.source_name or "Official Statutory Source"),
                    source_url=c.source_url or (source.source_url if source else scholarship.source_url or ""),
                    source_type=source.source_type if source else "OFFICIAL_PORTAL",
                    authority_level=source.authority_level if source else ("STATUTORY_STATE" if scholarship.tn_residency_required else "STATUTORY_CENTRAL"),
                    verification_status=doc.verification_status or (source.verification_status if source else scholarship.verification_status),
                    last_verified_at=doc.last_verified_at or (source.last_verified_at if source else scholarship.last_verified_at),
                    retrieved_at=doc.retrieved_at,
                    content_hash=doc.content_hash,
                    page_number=c.page_number,
                )
            )

    has_evidence = len(dossier_chunks) > 0

    return OfficialDossierResponse(
        has_official_evidence=has_evidence,
        source_name=(primary_source.name if primary_source else scholarship.source_name) or scholarship.provider,
        source_url=(primary_source.source_url if primary_source else scholarship.source_url),
        official_portal_name=scholarship.official_portal_name or (primary_source.name if primary_source else None),
        official_guideline_url=scholarship.official_guideline_url or (primary_source.source_url if primary_source else None),
        authority_level=primary_source.authority_level if primary_source else ("STATUTORY_STATE" if scholarship.tn_residency_required else "STATUTORY_CENTRAL"),
        verification_status=scholarship.verification_status,
        source_verification_status=scholarship.source_verification_status or scholarship.verification_status,
        last_verified_at=(primary_doc.last_verified_at if primary_doc else (primary_source.last_verified_at if primary_source else scholarship.last_verified_at)),
        dossier_index=scholarship.dossier_index,
        chunks_count=len(dossier_chunks),
        chunks=dossier_chunks,
        unresolved_questions=scholarship.unresolved_questions,
        autonomous_compatibility=scholarship.autonomous_compatibility,
    )


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
    linked_app = (
        db.query(Application)
        .filter(Application.student_id == student.id, Application.scholarship_id == scholarship.id)
        .first()
    )

    # Evaluate deterministic eligibility (retired/inactive schemes return ineligible with score 0)
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

    current_app_data = None
    if linked_app:
        current_app_data = {
            "id": linked_app.id,
            "status": linked_app.status,
            "progress": linked_app.progress,
            "started_at": linked_app.started_at,
        }

    official_dossier = _build_official_dossier(db, scholarship)

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
        official_dossier=official_dossier,
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


@router.get("/{id}/dossier", response_model=OfficialDossierResponse, summary="Get Official Verification Dossier")
def get_scholarship_dossier(
    id: int,
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    scholarship = db.query(Scholarship).filter(Scholarship.id == id).first()
    if not scholarship:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scholarship not found")
    return _build_official_dossier(db, scholarship)



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

    # Centralized requirement reconciliation and readiness engine
    application_status_service.reconcile_application_requirements(db, new_app)

    db.commit()
    db.refresh(new_app)

    return {
        "message": f"Successfully started application for {scholarship.name}.",
        "application_id": new_app.id,
        "status": new_app.status,
        "progress": new_app.progress,
        "is_new": True,
    }


@router.post(
    "/import",
    response_model=ScholarshipImportSummary,
    summary="Import or Refresh Verified Scholarships (Admin Only)",
    status_code=status.HTTP_200_OK,
)
def import_scholarships(
    request: ScholarshipImportRequest,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Administrative endpoint to import, update, and refresh scholarships from official sources.

    Access Control:
    - Strictly restricted to authenticated users with role == 'ADMIN'.
    - Ordinary students (role == 'STUDENT') are rejected with HTTP 403 Forbidden.

    Guarantees:
    - Safe idempotent matching by dossier_index or official scheme name.
    - Preserves existing student applications and document attachments intact.
    - Official government domain validation (.gov.in, .nic.in, .ac.in).
    - Source verification safeguard: non-government sources cannot claim SOURCE_VERIFIED.
    - Dry-run mode previews additions/updates without persisting database changes.
    """
    return scholarship_import_service.process_import(
        db=db,
        request=request,
        admin_user=current_admin,
    )
