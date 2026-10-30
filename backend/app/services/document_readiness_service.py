import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.student import Student
from app.models.document import Document
from app.models.application import Application
from app.models.scholarship import Scholarship, KNOWN_FICTIONAL_DEMO_NAMES, RETIRED_DEMO_STATUSES
from app.schemas.document import (
    DocumentChecklistItem,
    ScholarshipReadinessItem,
    StudentDocumentsReadinessOverview,
)

logger = logging.getLogger("scholarai.document_readiness_service")

# Statutory and policy explanations for requested documents
WHY_REQUESTED_MAP: Dict[str, str] = {
    "INCOME_CERTIFICATE": (
        "Required under Tamil Nadu G.O. guidelines to verify that total parental/family "
        "annual income does not exceed the statutory ceiling (e.g. ₹2,50,000 for post-matric schemes)."
    ),
    "COMMUNITY_CERTIFICATE": (
        "Statutory community certificate issued by Revenue Tahsildar / E-Sevai portal "
        "required by welfare departments to substantiate quota eligibility (BC, MBC/DNC, SC, SCA, ST)."
    ),
    "BONAFIDE_CERTIFICATE": (
        "Institutional enrollment verification signed by the Principal or Head of Institution "
        "confirming full-time regular student status for the current academic year."
    ),
    "MARKSHEET": (
        "Academic record required to verify qualifying examination completion and satisfy "
        "minimum percentage or merit cutoff criteria."
    ),
    "10TH_MARKSHEET": (
        "Permanent statutory proof of date of birth, legal name, and secondary education completion."
    ),
    "12TH_MARKSHEET": (
        "Higher Secondary examination transcript used by scholarship authorities to compute "
        "merit eligibility and admission stream compliance."
    ),
    "ACADEMIC_TRANSCRIPT": (
        "Semester-wise college mark sheet demonstrating continuous academic progression with no standing arrears."
    ),
    "FEE_RECEIPT": (
        "Official institutional fee payment receipt required to determine exact tuition reimbursement "
        "and statutory special fee allowances."
    ),
    "DOMICILE_CERTIFICATE": (
        "Proof of permanent residence in Tamil Nadu, mandated for state-funded schemes."
    ),
    "DISABILITY_CERTIFICATE": (
        "Unique Disability ID (UDID) card or Medical Board certificate confirming benchmark disability "
        "(>= 40%) for accessible funding entitlements."
    ),
    "SPORTS_CERTIFICATE": (
        "SDAT or recognized sports federation merit certificate validating district, state, or national representation."
    ),
    "SPECIAL_CATEGORY_CERTIFICATE": (
        "Verification certificate for special quotas, including First Graduate, 7.5% Govt School reservation, or Ex-Servicemen."
    ),
    "ID_PROOF": (
        "Government-issued photo identification (Aadhaar / Voter ID) for KYC validation and Direct Benefit Transfer (DBT) bank seeding."
    ),
    "BANK_PASSBOOK": (
        "Bank passbook or cancelled cheque to ensure accurate bank account and IFSC details for Direct Benefit Transfer (DBT)."
    ),
    "OTHER": (
        "Supporting official documentation requested to substantiate application claims."
    ),
}

# Compatibility mapping between document types
DOCUMENT_TYPE_ALIASES: Dict[str, List[str]] = {
    "MARKSHEET": ["MARKSHEET", "ACADEMIC_TRANSCRIPT", "10TH_MARKSHEET", "12TH_MARKSHEET"],
    "ACADEMIC_TRANSCRIPT": ["ACADEMIC_TRANSCRIPT", "MARKSHEET", "12TH_MARKSHEET"],
    "10TH_MARKSHEET": ["10TH_MARKSHEET", "MARKSHEET"],
    "12TH_MARKSHEET": ["12TH_MARKSHEET", "MARKSHEET"],
    "ID_PROOF": ["ID_PROOF", "DOMICILE_CERTIFICATE"],
    "DOMICILE_CERTIFICATE": ["DOMICILE_CERTIFICATE", "ID_PROOF"],
    "SPECIAL_CATEGORY_CERTIFICATE": ["SPECIAL_CATEGORY_CERTIFICATE", "BONAFIDE_CERTIFICATE"],
}


class DocumentReadinessService:
    """
    Evaluates student uploaded documents against real scholarship requirements.
    Provides transparent readiness assessments, extraction summaries, and policy rationales.
    Core Principle: 'AI assists. Official sources decide. Student approves.'
    """

    @classmethod
    def get_why_requested(cls, document_type: str, requirement_name: Optional[str] = None) -> str:
        clean_type = (document_type or "").strip().upper()
        if clean_type in WHY_REQUESTED_MAP:
            return WHY_REQUESTED_MAP[clean_type]
        for key, text in WHY_REQUESTED_MAP.items():
            if key in clean_type:
                return text
        return "Mandatory evidentiary document required by the scholarship sanctioning authority to substantiate eligibility."

    def get_student_readiness_overview(
        self,
        db: Session,
        student: Student,
    ) -> StudentDocumentsReadinessOverview:
        # 1. Fetch student's uploaded documents
        documents = (
            db.query(Document)
            .filter(Document.student_id == student.id)
            .all()
        )
        docs_by_type: Dict[str, Document] = {d.document_type: d for d in documents}

        total_uploaded = sum(1 for d in documents if d.storage_key or d.status in ["AVAILABLE", "VERIFIED"])
        total_verified = sum(
            1 for d in documents
            if d.verification_status in ["AUTOMATED_CHECKS_PASSED", "OFFICIALLY_VERIFIED"] or d.status == "VERIFIED"
        )

        # 2. Fetch student's applications
        apps = (
            db.query(Application)
            .join(Scholarship)
            .filter(
                Application.student_id == student.id,
                Scholarship.status == "ACTIVE",
                Scholarship.verification_status.notin_(RETIRED_DEMO_STATUSES),
                ~Scholarship.name.in_(KNOWN_FICTIONAL_DEMO_NAMES),
                ~Scholarship.provider.ilike("%(Demo)%"),
            )
            .all()
        )
        app_by_scholarship_id: Dict[int, Application] = {a.scholarship_id: a for a in apps}

        # 3. Fetch active scholarships to evaluate
        scholarships = (
            db.query(Scholarship)
            .filter(
                Scholarship.status == "ACTIVE",
                Scholarship.verification_status.notin_(RETIRED_DEMO_STATUSES),
                ~Scholarship.name.in_(KNOWN_FICTIONAL_DEMO_NAMES),
                ~Scholarship.provider.ilike("%(Demo)%"),
            )
            .order_by(Scholarship.amount.desc())
            .all()
        )

        readiness_items: List[ScholarshipReadinessItem] = []
        ready_count = 0
        pending_count = 0

        for sch in scholarships:
            app = app_by_scholarship_id.get(sch.id)
            has_app = app is not None
            app_id = app.id if app else None

            # Get requirements list
            requirements_source = app.requirements if app and app.requirements else sch.requirements

            checklist: List[DocumentChecklistItem] = []
            for req in requirements_source:
                req_dtype = req.document_type
                matched_doc = docs_by_type.get(req_dtype)

                # Check aliases if no direct type match
                if not matched_doc or matched_doc.status == "MISSING":
                    aliases = DOCUMENT_TYPE_ALIASES.get(req_dtype, [])
                    for alias in aliases:
                        if alias in docs_by_type and docs_by_type[alias].status != "MISSING":
                            matched_doc = docs_by_type[alias]
                            break

                is_uploaded = bool(
                    matched_doc
                    and matched_doc.status in ["AVAILABLE", "VERIFIED"]
                    and (matched_doc.storage_key or matched_doc.file_size)
                )

                extracted_summary = None
                student_confirmed = False
                if matched_doc and matched_doc.extracted_data:
                    fields = matched_doc.extracted_data.get("extracted_fields", {})
                    extracted_summary = {
                        k: v for k, v in fields.items()
                        if k in ["student_name", "annual_income", "certificate_number", "issue_date", "expiry_date", "cgpa", "percentage", "issuing_authority"]
                    }
                    student_confirmed = bool(matched_doc.extracted_data.get("student_confirmed", False))

                item_status = "MISSING"
                if matched_doc:
                    if matched_doc.verification_status == "REJECTED":
                        item_status = "REJECTED"
                    elif matched_doc.verification_status in ["AUTOMATED_CHECKS_PASSED", "OFFICIALLY_VERIFIED"]:
                        item_status = "VERIFIED"
                    elif matched_doc.status in ["AVAILABLE", "VERIFIED"]:
                        item_status = "AVAILABLE"

                checklist.append(
                    DocumentChecklistItem(
                        id=req.id,
                        name=req.name,
                        document_type=req.document_type,
                        is_required=req.is_required,
                        description=getattr(req, "description", None),
                        why_requested=self.get_why_requested(req.document_type, req.name),
                        is_uploaded=is_uploaded,
                        document_id=matched_doc.id if matched_doc else None,
                        document_name=matched_doc.original_filename or matched_doc.name if matched_doc else None,
                        document_status=item_status,
                        verification_status=matched_doc.verification_status if matched_doc else None,
                        extracted_summary=extracted_summary,
                        student_confirmed=student_confirmed,
                    )
                )

            # Evaluate readiness
            required_items = [c for c in checklist if c.is_required]
            completed_required = [c for c in required_items if c.is_uploaded and c.document_status in ["AVAILABLE", "VERIFIED"]]
            missing_required = [c for c in required_items if not c.is_uploaded or c.document_status in ["MISSING", "REJECTED"]]
            review_required = [c for c in required_items if c.is_uploaded and (c.verification_status == "NEEDS_HUMAN_REVIEW" or not c.student_confirmed)]

            total_req = len(required_items)
            completed_req = len(completed_required)
            missing_req = len(missing_required)

            if total_req == 0:
                readiness_status = "READY"
                readiness_percentage = 100.0
            elif missing_req == 0:
                if len(review_required) > 0:
                    readiness_status = "NEEDS_REVIEW"
                else:
                    readiness_status = "READY"
                readiness_percentage = 100.0
            else:
                readiness_status = "MISSING_DOCUMENTS"
                readiness_percentage = round((completed_req / total_req) * 100.0, 1)

            if readiness_status == "READY":
                ready_count += 1
            else:
                pending_count += 1

            deadline_str = (
                sch.deadline.strftime("%Y-%m-%d")
                if isinstance(sch.deadline, datetime)
                else str(sch.deadline)
            )

            readiness_items.append(
                ScholarshipReadinessItem(
                    scholarship_id=sch.id,
                    scholarship_name=sch.name,
                    provider=sch.provider,
                    dossier_index=sch.dossier_index,
                    amount=float(sch.amount),
                    deadline=deadline_str,
                    academic_year=sch.academic_year,
                    official_portal_url=sch.application_url or sch.source_url,
                    official_portal_name=sch.official_portal_name or sch.source_name,
                    readiness_status=readiness_status,
                    readiness_percentage=readiness_percentage,
                    total_required=total_req,
                    completed_required=completed_req,
                    missing_count=missing_req,
                    has_application=has_app,
                    application_id=app_id,
                    checklist=checklist,
                )
            )

        # Prioritize: Scholarships with active applications first, then by readiness (READY > MISSING)
        readiness_items.sort(
            key=lambda x: (
                0 if x.has_application else 1,
                0 if x.readiness_status == "READY" else (1 if x.readiness_status == "NEEDS_REVIEW" else 2),
                -x.amount,
            )
        )

        privacy_guarantees = {
            "uploads_optional": True,
            "privacy_notice": (
                "Document uploads are completely optional. SCHOLARAi does not require uploads to explore schemes or "
                "check eligibility. Uploaded files are strictly isolated to your account."
            ),
            "official_submission_notice": (
                "Official Portal Submission Required: SCHOLARAi helps you prepare, verify, and organize your documentation. "
                "Final applications must be submitted directly by you on the scholarship provider's official portal. "
                "SCHOLARAi never auto-submits applications."
            ),
            "security_protections": [
                "Strict student ownership authorization (multi-tenant isolation)",
                "Cryptographic SHA-256 integrity verification",
                "Magic-byte format inspection (PDF, JPG, PNG only)",
                "10 MB per-file size limitation",
                "Private encrypted storage with unguessable storage keys",
            ],
        }

        return StudentDocumentsReadinessOverview(
            total_documents_uploaded=total_uploaded,
            total_verified_documents=total_verified,
            ready_scholarships_count=ready_count,
            pending_scholarships_count=pending_count,
            readiness_items=readiness_items,
            privacy_guarantees=privacy_guarantees,
        )


document_readiness_service = DocumentReadinessService()

