"""
SCHOLARAi Real Application Assistant Service
Extracts student profile data, auto-populates official application fields,
evaluates document readiness, detects contradictions, and manages the preparation lifecycle.

Core Principle: "AI assists. Official sources decide. Student approves."
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.models.scholarship import Scholarship
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.evidence import Evidence
from app.models.document import Document
from app.schemas.application import (
    ApplicationFormFieldItem,
    ApplicationAssistantWorkspaceResponse,
    ApplicationRequirementResponse,
    UpdateApplicationFieldsRequest,
    StudentApproveApplicationRequest,
)
from app.services.external_submission_service import external_submission_service
from app.services.application_status_service import application_status_service
from app.services.portal_mapping_service import portal_mapping_service

logger = logging.getLogger("scholarai.application_assistant")


class ApplicationAssistantService:
    """
    Manages structured, field-by-field application preparation, profile mapping,
    discrepancy detection, and student consent workflows.
    """

    def get_or_build_workspace(
        self,
        db: Session,
        application: Application,
    ) -> ApplicationAssistantWorkspaceResponse:
        """
        Builds the complete Application Assistant workspace for an application.
        Ensures requirements are reconciled with persistent documents.
        """
        # Ensure latest document and requirement reconciliation
        application_status_service.reconcile_application_requirements(db, application)
        db.commit()
        db.refresh(application)

        student = application.student
        profile = student.profile if student else None
        scholarship = application.scholarship

        # Determine integration mode
        submission_mode = external_submission_service.classify_scholarship_integration(scholarship)
        application.submission_mode = submission_mode

        # Fetch student's verified documents for field verification references
        docs = (
            db.query(Document)
            .filter(Document.student_id == application.student_id)
            .all()
        )
        docs_by_type = {d.document_type: d for d in docs}

        # Stored form answers (if any)
        saved_form = dict(application.form_data or {})

        # Build standardized application fields
        fields: List[ApplicationFormFieldItem] = []
        discrepancies: List[str] = []
        missing_mandatory: List[str] = []
        unconfirmed: List[str] = []

        def _make_field(
            key: str,
            label: str,
            field_group: str,
            profile_val: Optional[Any],
            matching_doc: Optional[Document] = None,
            is_required: bool = True,
            guidance: Optional[str] = None,
            warning: Optional[str] = None,
            placeholder: Optional[str] = None,
        ) -> ApplicationFormFieldItem:
            saved_entry = saved_form.get(key)
            saved_val = None
            saved_confirmed = None
            if isinstance(saved_entry, dict):
                saved_val = saved_entry.get("value")
                saved_confirmed = saved_entry.get("is_confirmed")
            elif saved_entry is not None:
                saved_val = saved_entry

            has_saved = saved_val is not None and str(saved_val).strip() != ""
            has_profile = profile_val is not None and str(profile_val).strip() != ""

            if has_saved:
                final_val = saved_val
                if has_profile and str(saved_val).strip() == str(profile_val).strip():
                    source = "STUDENT_PROFILE"
                else:
                    source = "STUDENT_ENTERED"
            elif has_profile:
                final_val = profile_val
                source = "STUDENT_PROFILE"
            else:
                final_val = None
                source = "NOT_PROVIDED"

            suggested_val = profile_val if has_profile else None

            # Confirmation:
            # An empty field can NEVER be confirmed.
            # Prefilled profile values start unconfirmed until student reviews & confirms.
            if final_val is None or str(final_val).strip() == "":
                is_confirmed = False
            elif saved_confirmed is not None:
                is_confirmed = bool(saved_confirmed)
            else:
                is_confirmed = False

            # Verification Status:
            # Distinguish between profile-provided, student-entered, document-verified, and unverified.
            # Merely uploading a document does NOT make it officially verified.
            if final_val is None or str(final_val).strip() == "":
                verification_status = "NOT_PROVIDED"
            elif matching_doc and (
                matching_doc.verification_status == "OFFICIALLY_VERIFIED"
                or matching_doc.status == "VERIFIED"
            ):
                verification_status = "DOCUMENT_VERIFIED"
            elif source == "STUDENT_PROFILE":
                verification_status = "PROFILE_PROVIDED"
            else:
                verification_status = "STUDENT_PROVIDED"

            item = ApplicationFormFieldItem(
                key=key,
                label=label,
                field_group=field_group,
                value=final_val,
                suggested_value=suggested_val,
                source=source,
                verification_status=verification_status,
                is_required=is_required,
                is_confirmed=is_confirmed,
                guidance=guidance,
                warning=warning,
                placeholder=placeholder,
            )
            fields.append(item)
            return item

        # ----------------------------------------------------------------------
        # Group 1: Personal Identification
        # ----------------------------------------------------------------------
        name_profile = student.name if student and student.name and str(student.name).strip() else None
        _make_field(
            key="full_name",
            label="Full Legal Name (as per Certificate)",
            field_group="personal",
            profile_val=name_profile,
            matching_doc=docs_by_type.get("ID_PROOF"),
            is_required=True,
            guidance="Must match official school mark sheets and government identity records.",
            placeholder="Enter your full legal name as per certificate",
        )

        dob_raw = getattr(profile, "dob", None) if profile else None
        dob_str = dob_raw.isoformat() if hasattr(dob_raw, "isoformat") else (str(dob_raw).strip() if dob_raw else None)
        if dob_str == "":
            dob_str = None
        _make_field(
            key="date_of_birth",
            label="Date of Birth",
            field_group="personal",
            profile_val=dob_str,
            matching_doc=docs_by_type.get("10TH_MARKSHEET"),
            is_required=True,
            guidance="Corroborated by Class X Marksheet or Secondary School Leaving Certificate (SSLC).",
            placeholder="YYYY-MM-DD",
        )

        # Gender: No fabricated fallback to 'Male'
        gender_profile = profile.gender.strip() if profile and profile.gender and str(profile.gender).strip() else None
        saved_gender_val = saved_form.get("gender", {}).get("value") if isinstance(saved_form.get("gender"), dict) else None
        current_gender_candidate = saved_gender_val or gender_profile
        gender_warning = None
        if "female" in (scholarship.eligibility_summary or "").lower() or "girl" in (scholarship.name or "").lower():
            if current_gender_candidate and str(current_gender_candidate).lower() not in ["female", "girl"]:
                gender_warning = f"Warning: {scholarship.name} is designated for female applicants. Your profile indicates '{current_gender_candidate}'."
                discrepancies.append(gender_warning)
            elif not current_gender_candidate:
                gender_warning = f"Notice: {scholarship.name} is designated for female applicants. Please provide your statutory gender."

        _make_field(
            key="gender",
            label="Gender",
            field_group="personal",
            profile_val=gender_profile,
            matching_doc=None,
            is_required=True,
            guidance="Statutory gender as recorded on government identification documents.",
            warning=gender_warning,
            placeholder="Select statutory gender (Male, Female, Transgender)",
        )

        # Community Category: No fabricated fallback to 'BC'
        community_profile = profile.category.strip() if profile and profile.category and str(profile.category).strip() else None
        comm_doc = docs_by_type.get("COMMUNITY_CERTIFICATE") or docs_by_type.get("CASTE_CERTIFICATE")
        _make_field(
            key="community_category",
            label="Community Category",
            field_group="personal",
            profile_val=community_profile,
            matching_doc=comm_doc,
            is_required=True,
            guidance="Statutory community category recognized by Tamil Nadu Revenue Department (BC, MBC/DNC, SC, SCA, ST, OC).",
            placeholder="Select statutory community category (BC, MBC/DNC, SC, SCA, ST, OC)",
        )

        # ----------------------------------------------------------------------
        # Group 2: Academic Institution & Course
        # ----------------------------------------------------------------------
        inst_profile = profile.institution.strip() if profile and profile.institution and str(profile.institution).strip() else None
        _make_field(
            key="institution_name",
            label="Current Enrolled Institution",
            field_group="academic",
            profile_val=inst_profile,
            matching_doc=docs_by_type.get("BONAFIDE_CERTIFICATE"),
            is_required=True,
            guidance="Full official name of your college or university as recognized by UGC/AICTE.",
            placeholder="Enter your enrolled institution name",
        )

        course_profile = profile.course.strip() if profile and profile.course and str(profile.course).strip() else None
        _make_field(
            key="course_program",
            label="Degree Course & Branch of Study",
            field_group="academic",
            profile_val=course_profile,
            matching_doc=docs_by_type.get("BONAFIDE_CERTIFICATE"),
            is_required=True,
            guidance="Specific branch of study (e.g. B.Tech Computer Science and Engineering).",
            placeholder="Enter your degree course and branch (e.g. B.Tech Mechanical)",
        )

        # Academic Year: No fabricated fallback to 'Year 2' or '2'
        year_raw = str(profile.year).strip() if profile and profile.year and str(profile.year).strip() else None
        year_profile = None
        if year_raw:
            year_profile = year_raw if year_raw.lower().startswith("year") else f"Year {year_raw}"
        _make_field(
            key="academic_year",
            label="Current Year of Study",
            field_group="academic",
            profile_val=year_profile,
            matching_doc=None,
            is_required=True,
            guidance="Active progression year in the enrolled program curriculum.",
            placeholder="Enter current year of study (e.g. Year 1, Year 2)",
        )

        # CGPA / Qualifying Marks: No fabricated fallback
        cgpa_profile = None
        if profile:
            if profile.cgpa is not None:
                cgpa_profile = str(profile.cgpa)
            elif getattr(profile, "qualifying_marks", None) is not None:
                cgpa_profile = str(profile.qualifying_marks)
            elif getattr(profile, "twelfth_percentage", None) is not None:
                cgpa_profile = str(profile.twelfth_percentage)
        marksheet_doc = docs_by_type.get("MARKSHEET") or docs_by_type.get("ACADEMIC_TRANSCRIPT")
        _make_field(
            key="cgpa_score",
            label="Qualifying Examination Score / Percentage",
            field_group="academic",
            profile_val=cgpa_profile,
            matching_doc=marksheet_doc,
            is_required=False,
            guidance="Cumulative semester score or qualifying exam marks as supported by official marksheets.",
            placeholder="Enter cumulative GPA or qualifying percentage score",
        )

        # Institution Classification Type: No fabricated fallback to 'Government-aided'
        inst_type_profile = getattr(profile, "institution_type", None)
        if inst_type_profile:
            inst_type_profile = str(inst_type_profile).strip() or None
        _make_field(
            key="institution_type",
            label="Institution Classification Type",
            field_group="academic",
            profile_val=inst_type_profile,
            matching_doc=None,
            is_required=True,
            guidance="Government, Government-aided, or Private autonomous collegiate standing.",
            placeholder="Select classification (Government, Government-aided, Private)",
        )

        # ----------------------------------------------------------------------
        # Group 3: Financial Criteria & Income
        # ----------------------------------------------------------------------
        # Annual Family Income: No fabricated fallback to '180000'
        family_income = None
        if student and student.funding_profile and student.funding_profile.annual_family_income is not None:
            family_income = student.funding_profile.annual_family_income
        income_profile = str(int(family_income)) if family_income is not None else None

        saved_inc_entry = saved_form.get("annual_income")
        saved_inc_val = saved_inc_entry.get("value") if isinstance(saved_inc_entry, dict) else None
        current_inc_candidate = saved_inc_val if (saved_inc_val is not None and str(saved_inc_val).strip() != "") else income_profile

        income_warning = None
        if current_inc_candidate:
            try:
                inc_numeric = float(current_inc_candidate)
                if scholarship.income_ceiling and inc_numeric > scholarship.income_ceiling:
                    income_warning = (
                        f"Income Discrepancy: Annual income of ₹{int(inc_numeric):,} exceeds the "
                        f"official scheme limit of ₹{int(scholarship.income_ceiling):,}."
                    )
                    discrepancies.append(income_warning)
            except (ValueError, TypeError):
                pass

        _make_field(
            key="annual_income",
            label="Annual Family Income (INR)",
            field_group="financial",
            profile_val=income_profile,
            matching_doc=docs_by_type.get("INCOME_CERTIFICATE"),
            is_required=True,
            guidance="Total gross income from all family sources as certified by the Tahsildar / Revenue Authority.",
            warning=income_warning,
            placeholder="Enter your annual family income in INR",
        )

        # ----------------------------------------------------------------------
        # Group 4: Eligibility & Residency Specifics
        # ----------------------------------------------------------------------
        # State Residence: No fabricated fallback to 'Tamil Nadu'
        state_profile = profile.state.strip() if profile and profile.state and str(profile.state).strip() else None
        saved_state_entry = saved_form.get("state_residence")
        saved_state_val = saved_state_entry.get("value") if isinstance(saved_state_entry, dict) else None
        current_state_candidate = saved_state_val if (saved_state_val is not None and str(saved_state_val).strip() != "") else state_profile

        state_warning = None
        if scholarship.tn_residency_required == "YES":
            if current_state_candidate and str(current_state_candidate).lower() != "tamil nadu":
                state_warning = f"Residency Discrepancy: {scholarship.name} requires permanent Tamil Nadu domicile. Your specified residence is '{current_state_candidate}'."
                discrepancies.append(state_warning)
            elif not current_state_candidate:
                state_warning = f"Notice: {scholarship.name} requires permanent Tamil Nadu domicile. Please provide your state of residence."

        _make_field(
            key="state_residence",
            label="Permanent State of Domicile",
            field_group="eligibility",
            profile_val=state_profile,
            matching_doc=docs_by_type.get("DOMICILE_CERTIFICATE"),
            is_required=True,
            guidance="State where the student holds permanent domicile or nativity status.",
            warning=state_warning,
            placeholder="Enter state of permanent domicile (e.g. Tamil Nadu)",
        )

        # Admission Quota: No fabricated fallback to 'GOVERNMENT_QUOTA'
        quota_profile = profile.admission_quota.strip() if profile and profile.admission_quota and str(profile.admission_quota).strip() else None
        _make_field(
            key="admission_quota",
            label="College Admission Quota",
            field_group="eligibility",
            profile_val=quota_profile,
            matching_doc=None,
            is_required=True,
            guidance="Government Single Window Counseling vs Management / Institutional Quota.",
            placeholder="Select admission quota (Government Quota / Management Quota)",
        )

        # Hosteller Status: No fabricated fallback to 'DAY_SCHOLAR'
        hostel_profile = profile.hosteller_status.strip() if profile and profile.hosteller_status and str(profile.hosteller_status).strip() else None
        _make_field(
            key="hosteller_status",
            label="Residential Accommodation Status",
            field_group="eligibility",
            profile_val=hostel_profile,
            matching_doc=None,
            is_required=True,
            guidance="Day Scholar or College-Approved Resident Hosteller.",
            placeholder="Select accommodation status (Day Scholar / Resident Hosteller)",
        )

        # First Graduate: No fabricated fallback to 'No'
        first_grad_profile = None
        if profile and profile.is_first_graduate is not None:
            first_grad_profile = "Yes" if profile.is_first_graduate is True else "No"
        _make_field(
            key="first_graduate",
            label="First Graduate in Family",
            field_group="eligibility",
            profile_val=first_grad_profile,
            matching_doc=docs_by_type.get("SPECIAL_CATEGORY_CERTIFICATE"),
            is_required=False,
            guidance="Applicable for Tamil Nadu First Graduate tuition fee concession.",
            placeholder="Select First Graduate status (Yes / No)",
        )

        # ----------------------------------------------------------------------
        # Group 5: Banking Information (Direct Benefit Transfer)
        # ----------------------------------------------------------------------
        # Bank Account Holder:
        holder_profile = getattr(profile, "account_holder_name", None) or (student.name if student and student.name and str(student.name).strip() else None)
        _make_field(
            key="bank_account_holder",
            label="Bank Account Holder Name (Must match Student)",
            field_group="bank",
            profile_val=holder_profile,
            matching_doc=None,
            is_required=True,
            guidance="Account must be an active single (savings) account in the applicant's name with Aadhaar seeding.",
            placeholder="Enter bank account holder name (must match student legal name)",
        )

        # Bank Name: No fabricated fallback to 'State Bank of India'
        bank_name_profile = getattr(profile, "bank_name", None)
        if bank_name_profile:
            bank_name_profile = str(bank_name_profile).strip() or None
        _make_field(
            key="bank_name",
            label="Bank Institution Name",
            field_group="bank",
            profile_val=bank_name_profile,
            matching_doc=None,
            is_required=True,
            guidance="Scheduled public or commercial bank holding your scholarship disbursement account.",
            placeholder="Enter bank institution name (e.g. State Bank of India, Canara Bank)",
        )

        # Bank Account Number: No fabricated fallback to 'XXXX-XXXX-4819'
        _make_field(
            key="bank_account_number",
            label="Bank Account Number",
            field_group="bank",
            profile_val=None,
            matching_doc=None,
            is_required=True,
            guidance="Account number for direct DBT electronic credit.",
            placeholder="Enter your bank account number for direct electronic credit",
        )

        # Bank IFSC Code: No fabricated fallback to 'SBIN0000800'
        _make_field(
            key="bank_ifsc_code",
            label="Bank Branch IFSC Code",
            field_group="bank",
            profile_val=None,
            matching_doc=None,
            is_required=True,
            guidance="11-character Indian Financial System Code identifying the branch.",
            placeholder="Enter 11-character Indian Financial System Code (e.g. SBIN0000800)",
        )

        # ----------------------------------------------------------------------
        # Group 6: Personal Statement / Purpose
        # ----------------------------------------------------------------------
        statement_val = None
        saved_stmt_entry = saved_form.get("personal_statement")
        if isinstance(saved_stmt_entry, dict):
            statement_val = saved_stmt_entry.get("value")
        elif saved_stmt_entry is not None:
            statement_val = saved_stmt_entry

        if not statement_val and application.personal_statement and application.personal_statement.strip():
            statement_val = application.personal_statement.strip()

        has_stmt = statement_val is not None and str(statement_val).strip() != ""
        stmt_confirmed = False
        if isinstance(saved_stmt_entry, dict) and saved_stmt_entry.get("is_confirmed") is not None:
            stmt_confirmed = bool(saved_stmt_entry.get("is_confirmed"))

        fields.append(
            ApplicationFormFieldItem(
                key="personal_statement",
                label="Personal Statement & Financial Need Justification",
                field_group="statement",
                value=statement_val if has_stmt else None,
                suggested_value=application.personal_statement if application.personal_statement else None,
                source="ACHIEVEMENTS_VAULT" if application.personal_statement else ("STUDENT_ENTERED" if has_stmt else "NOT_PROVIDED"),
                verification_status="STUDENT_PROVIDED" if has_stmt else "NOT_PROVIDED",
                is_required=True,
                is_confirmed=stmt_confirmed,
                guidance="Factual summary of academic focus, project credentials, and financial necessity.",
                placeholder="Write or generate your personal statement explaining your academic focus and financial need",
            )
        )

        # Audit checklist completion
        for f in fields:
            if f.is_required and (f.value is None or not str(f.value).strip()):
                missing_mandatory.append(f.label)
            if f.is_required and not f.is_confirmed:
                unconfirmed.append(f.label)

        # Document requirements formatting
        req_responses: List[ApplicationRequirementResponse] = []
        for r in application.requirements:
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

        missing_docs = [
            r.name for r in application.requirements
            if r.is_required and r.status not in ["AVAILABLE", "VERIFIED"]
        ]

        # Calculate preparation readiness
        docs_ready = len(missing_docs) == 0
        fields_ready = len(missing_mandatory) == 0
        all_confirmed = len(unconfirmed) == 0 and len(discrepancies) == 0
        student_consented = bool(application.student_consented_at)

        # Determine preparation status
        if not docs_ready or not fields_ready or discrepancies:
            prep_status = "ACTION_REQUIRED"
        elif not all_confirmed or not student_consented:
            prep_status = "READY_FOR_REVIEW"
        else:
            prep_status = "READY_TO_SUBMIT"

        application.preparation_status = prep_status

        # If application was not externally submitted yet
        if application.submission_status not in ["SUBMITTED_EXTERNALLY", "SUBMISSION_IN_PROGRESS"]:
            if submission_mode == "STUDENT_COMPLETED_EXTERNAL_SUBMISSION":
                application.submission_status = "MANUAL_SUBMISSION_REQUIRED"
            elif submission_mode == "NOT_INTEGRATED":
                application.submission_status = "NOT_SUBMITTED"

        # Determine instructions
        instructions = external_submission_service.get_submission_instructions(scholarship)

        # Detect portal type and build structured section mappings
        portal_type = portal_mapping_service.detect_portal_type(scholarship)
        portal_sections = portal_mapping_service.build_portal_mappings(
            scholarship=scholarship,
            fields=fields,
            requirements=application.requirements,
        )
        is_portal_supported = portal_type not in ["UNSUPPORTED"]
        portal_guidance_notes = [
            f"Statutory Portal Classification: {portal_type}",
            "AI assists with verified field mappings and one-click copy helpers. Form submission, OTP, and CAPTCHA must be completed by you on the official portal.",
            "Verify all prefilled answers against official certificates before completing portal submission.",
        ]

        return ApplicationAssistantWorkspaceResponse(
            application_id=application.id,
            scholarship_id=scholarship.id,
            scholarship_name=scholarship.name,
            scholarship_provider=scholarship.provider,
            official_portal_name=scholarship.official_portal_name or "Official Portal",
            official_portal_url=scholarship.application_url,
            official_guideline_url=scholarship.official_guideline_url,
            scholarship_deadline=scholarship.deadline,
            award_display=scholarship.award_display or f"₹{int(scholarship.amount):,}",
            eligibility_summary=scholarship.eligibility_summary,
            submission_mode=submission_mode,
            preparation_status=application.preparation_status,
            submission_status=application.submission_status,
            status=application.status,
            progress=application.progress,
            status_reason=application.status_reason,
            student_consented=student_consented,
            student_consented_at=application.student_consented_at,
            external_application_id=application.external_application_id,
            external_submission_at=application.external_submission_at,
            external_receipt_document_id=application.external_receipt_document_id,
            fields=fields,
            documents=req_responses,
            instructions=instructions,
            missing_mandatory_fields=missing_mandatory,
            unconfirmed_fields=unconfirmed,
            discrepancies=discrepancies,
            is_ready_for_student_approval=(docs_ready and fields_ready and not discrepancies),
            is_ready_for_external_submission=(docs_ready and fields_ready and all_confirmed and student_consented),
            status_history=list(application.status_history or []),
            portal_type=portal_type,
            is_portal_supported=is_portal_supported,
            portal_sections=portal_sections,
            portal_guidance_notes=portal_guidance_notes,
        )

    def update_form_fields(
        self,
        db: Session,
        application: Application,
        payload: UpdateApplicationFieldsRequest,
        actor_email: str,
    ) -> ApplicationAssistantWorkspaceResponse:
        """
        Saves student edits and confirmations for form fields.
        """
        current_data = dict(application.form_data or {})

        for key, item in payload.fields.items():
            if isinstance(item, dict):
                current_data[key] = {
                    "value": item.get("value"),
                    "is_confirmed": item.get("is_confirmed", True),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            else:
                current_data[key] = {
                    "value": str(item),
                    "is_confirmed": True,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }

            if key == "personal_statement" and item:
                val = item.get("value") if isinstance(item, dict) else str(item)
                application.personal_statement = val

        application.form_data = current_data

        # Record audit event if significant changes
        history = list(application.status_history or [])
        history.append({
            "event_type": "FORM_FIELDS_UPDATED",
            "actor": actor_email,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "updated_keys": list(payload.fields.keys()),
        })
        application.status_history = history

        db.commit()
        db.refresh(application)
        return self.get_or_build_workspace(db, application)

    def approve_and_consent(
        self,
        db: Session,
        application: Application,
        payload: StudentApproveApplicationRequest,
        actor_email: str,
    ) -> ApplicationAssistantWorkspaceResponse:
        """
        Records explicit student review and authorization of the application package.
        """
        if not payload.consent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Explicit student consent is required to authorize this application package.",
            )

        workspace = self.get_or_build_workspace(db, application)
        if not workspace.is_ready_for_student_approval:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Application cannot be approved yet. Missing fields: {', '.join(workspace.missing_mandatory_fields)}",
            )

        now = datetime.now(timezone.utc)
        application.student_consented_at = now
        application.preparation_status = "READY_TO_SUBMIT"

        # Record audit event
        history = list(application.status_history or [])
        history.append({
            "event_type": "STUDENT_APPLICATION_APPROVED",
            "actor": actor_email,
            "timestamp": now.isoformat(),
            "consent": True,
        })
        application.status_history = history

        db.commit()
        db.refresh(application)
        return self.get_or_build_workspace(db, application)


    def record_portal_launch(
        self,
        db: Session,
        application: Application,
        actor_email: str,
    ) -> ApplicationAssistantWorkspaceResponse:
        """
        Records that the student opened the official scholarship portal in an external tab.
        Transitions submission_status to SUBMISSION_IN_PROGRESS to reflect active portal engagement.
        """
        if application.submission_status not in ["SUBMITTED_EXTERNALLY", "SUBMISSION_IN_PROGRESS"]:
            application.submission_status = "SUBMISSION_IN_PROGRESS"

        history = list(application.status_history or [])
        history.append({
            "event_type": "OFFICIAL_PORTAL_LAUNCHED",
            "actor": actor_email,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "portal_url": application.scholarship.application_url if application.scholarship else None,
            "status": application.submission_status,
        })
        application.status_history = history

        db.commit()
        db.refresh(application)
        return self.get_or_build_workspace(db, application)


application_assistant_service = ApplicationAssistantService()
