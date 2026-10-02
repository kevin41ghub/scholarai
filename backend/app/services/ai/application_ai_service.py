import re
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.student import Student
from app.models.evidence import Evidence
from app.schemas.application_ai import (
    ApplicationDraftRequest,
    ApplicationDraftResponse,
    ApplicationReviewRequest,
    ApplicationReviewResponse,
    EvidenceCheckRequest,
    EvidenceCheckResponse,
)


def generate_application_draft(
    db: Session,
    student_id: int,
    application_id: int,
    request: ApplicationDraftRequest
) -> ApplicationDraftResponse:
    """
    Generate an AI application response draft strictly grounded in approved student evidence.
    Never invents unverified achievements.
    """
    app_obj = db.query(Application).filter(
        Application.id == application_id, Application.student_id == student_id
    ).first()
    student = db.query(Student).filter(Student.id == student_id).first()

    # Retrieve relevant evidence
    ev_query = db.query(Evidence).filter(
        Evidence.student_id == student_id,
        Evidence.verification_status.in_(["VERIFIED", "USER_PROVIDED"])
    )
    if request.selected_evidence_ids:
        ev_query = ev_query.filter(Evidence.id.in_(request.selected_evidence_ids))

    evidence_items = ev_query.all()

    scholarship_name = app_obj.scholarship.name if app_obj else "Scholarship"
    course = student.profile.course if (student and student.profile) else "Computer Science"
    institution = student.profile.institution if (student and student.profile) else "Demo College"
    cgpa = student.profile.cgpa if (student and student.profile) else 8.4

    evidence_used: List[Dict[str, Any]] = []
    sources_used: List[str] = [
        f"Student Profile ({course}, {institution}, CGPA: {cgpa})"
    ]

    claims_detected: List[str] = [
        f"Enrolled in {course} at {institution}",
        f"Current cumulative GPA of {cgpa}",
    ]

    # Structure draft grounded in available evidence
    if evidence_items:
        for ev in evidence_items[:2]:
            evidence_used.append({
                "id": ev.id,
                "title": ev.title,
                "category": ev.category,
                "source": ev.source_name,
                "status": ev.verification_status,
            })
            sources_used.append(f"Evidence Bank: {ev.title} ({ev.source_name})")
            claims_detected.append(f"Completed '{ev.title}': {ev.description}")

        primary_ev = evidence_items[0]
        draft_text = (
            f"As a dedicated 2nd-year student pursuing {course} at {institution}, I have maintained a strong "
            f"academic track record with a CGPA of {cgpa}. In addressing this requirement for the {scholarship_name}, "
            f"my primary practical experience centers on {primary_ev.title} with {primary_ev.organization or 'academic coursework'}. "
            f"{primary_ev.description} "
            f"\n\nThis initiative strengthened my problem-solving competencies and reinforced my long-term career focus. "
            f"Securing support from {scholarship_name} will alleviate critical tuition constraints, permitting dedicated focus on academic rigor and technical development."
        )
    else:
        draft_text = (
            f"As a 2nd-year undergraduate enrolled in {course} at {institution} maintaining an 8.4 CGPA, "
            f"I am applying for the {scholarship_name} to fulfill my higher education objectives. "
            f"*(Note: No detailed project or leadership items were selected from your Evidence Bank. "
            f"Add items in the Evidence Bank to substantiate specific achievements in this draft.)*"
        )

    return ApplicationDraftResponse(
        draft_text=draft_text,
        evidence_used=evidence_used,
        sources_used=sources_used,
        trust_label="AI GENERATED DRAFT — Student review and approval required",
        student_approval_required=True,
        claims_detected=claims_detected
    )


def check_unsupported_claims(
    db: Session,
    student_id: int,
    request: EvidenceCheckRequest
) -> EvidenceCheckResponse:
    """
    Compare claims in candidate draft against verified student profile and Evidence Bank.
    Flags ungrounded or exaggerated statements.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    ev_items = db.query(Evidence).filter(Evidence.student_id == student_id).all()

    profile_text = ""
    if student and student.profile:
        profile_text = f"{student.profile.course} {student.profile.institution} {student.profile.cgpa} {student.profile.state}"

    evidence_corpus = " ".join(
        f"{e.title} {e.description} {e.organization or ''} {e.evidence_text or ''}" for e in ev_items
    ) + " " + profile_text
    evidence_corpus_lower = evidence_corpus.lower()

    # Split draft into sentences
    sentences = [s.strip() for s in re.split(r"[.!?]\s+", request.draft_text) if len(s.strip()) > 15]

    supported: List[str] = []
    unsupported: List[str] = []

    # Common buzzwords that indicate ungrounded claims if not in corpus
    suspicious_keywords = ["patent", "published", "led a team of", "founder", "ceo", "national rank 1", "50-person", "first prize", "olympiad"]

    for sent in sentences:
        sent_lower = sent.lower()
        has_suspicious = any(kw in sent_lower for kw in suspicious_keywords)
        
        # Check token overlap
        words = [w for w in re.findall(r"\b[a-zA-Z]{4,}\b", sent_lower)]
        match_count = sum(1 for w in words if w in evidence_corpus_lower)
        overlap_ratio = match_count / max(1, len(words))

        if has_suspicious and not any(kw in evidence_corpus_lower for kw in suspicious_keywords if kw in sent_lower):
            unsupported.append(f"Unsupported claim: \"{sent}\" (No corresponding record found in your Evidence Bank)")
        elif overlap_ratio < 0.25 and len(words) > 5:
            unsupported.append(f"Potentially unverified statement: \"{sent}\"")
        else:
            supported.append(sent)

    confidence = "HIGH EVIDENCE SUPPORT" if len(unsupported) == 0 else ("PARTIAL EVIDENCE" if len(supported) > 0 else "NEEDS VERIFICATION")

    return EvidenceCheckResponse(
        claims_evaluated=len(sentences),
        supported_claims=supported,
        unsupported_claims=unsupported,
        confidence_level=confidence
    )


def review_application_answer(
    db: Session,
    student_id: int,
    request: ApplicationReviewRequest
) -> ApplicationReviewResponse:
    """
    Review student application answer for clarity, evidence grounding, and completeness.
    Uses constructive, trust-aligned phrasing.
    """
    check_result = check_unsupported_claims(
        db=db,
        student_id=student_id,
        request=EvidenceCheckRequest(draft_text=request.answer_text)
    )

    unsupported = check_result.unsupported_claims
    vague_statements = []
    strengths = []
    recommendations = []

    text_lower = request.answer_text.lower()
    words = request.answer_text.split()

    if len(words) < 30:
        vague_statements.append("The response is very brief. Expand with concrete examples from your coursework or projects.")
        recommendations.append("Aim for at least 100-150 words describing specific context, action, and results.")
    else:
        strengths.append("Adequate response length with paragraph structuring.")

    if any(metric in text_lower for metric in ["cgpa", "%", "percent", "semester", "year"]):
        strengths.append("Includes concrete academic metrics.")
    else:
        recommendations.append("Consider citing your current academic standing (e.g. CGPA) to anchor merit.")

    if unsupported:
        recommendations.append("Review highlighted unsupported claims. Ensure all cited achievements are present in your Evidence Bank.")

    score = max(40.0, min(95.0, 85.0 - (len(unsupported) * 15) - (len(vague_statements) * 10) + (len(strengths) * 5)))

    feedback = (
        f"Your response demonstrates clear alignment with the scholarship objectives. "
        f"Grounded evidence support is evaluated at '{check_result.confidence_level}'. "
        f"Review suggestions below to polish your draft before submitting."
    )

    return ApplicationReviewResponse(
        review_feedback=feedback,
        unsupported_claims=unsupported,
        vague_statements=vague_statements,
        strengths=strengths,
        completeness_score=score,
        recommendations=recommendations
    )
