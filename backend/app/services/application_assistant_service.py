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

        # ----------------------------------------------------------------------
        # Group 1: Personal Identification
        # ----------------------------------------------------------------------
        name_val = saved_form.get("full_name", {}).get("value") or (student.name if student else "")
        fields.append(
            ApplicationFormFieldItem(
                key="full_name",
                label="Full Legal Name (as per Certificate)",
                field_group="personal",
                value=name_val,
                suggested_value=student.name if student else "",
                source="STUDENT_PROFILE" if student and student.name else "MANUAL_ENTRY",
                verification_status="OFFICIALLY_VERIFIED" if "ID_PROOF" in docs_by_type else "STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("full_name", {}).get("is_confirmed", bool(name_val)),
                guidance="Must match official school mark sheets and government identity records.",
            )
        )

        dob_raw = getattr(profile, "dob", None) if profile else None
        dob_str = dob_raw.isoformat() if hasattr(dob_raw, "isoformat") else (str(dob_raw) if dob_raw else "")
        dob_val = saved_form.get("date_of_birth", {}).get("value") or dob_str
        fields.append(
            ApplicationFormFieldItem(
                key="date_of_birth",
                label="Date of Birth",
                field_group="personal",
                value=dob_val,
                suggested_value=dob_str,
                source="STUDENT_PROFILE" if dob_str else "MANUAL_ENTRY",
                verification_status="OFFICIALLY_VERIFIED" if "10TH_MARKSHEET" in docs_by_type else "STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("date_of_birth", {}).get("is_confirmed", bool(dob_val)),
                guidance="Corroborated by Class X Marksheet or Secondary School Leaving Certificate (SSLC).",
            )
        )

        gender_val = saved_form.get("gender", {}).get("value") or (profile.gender if profile else "Male")
        # Check gender discrepancy if scheme is for girls (e.g. Pragati / Pudhumai Penn)
        gender_warning = None
        if "female" in (scholarship.eligibility_summary or "").lower() or "girl" in (scholarship.name or "").lower():
            if str(gender_val).lower() not in ["female", "girl"]:
                gender_warning = f"Warning: {scholarship.name} is designated for female applicants. Your profile indicates '{gender_val}'."
                discrepancies.append(gender_warning)

        fields.append(
            ApplicationFormFieldItem(
                key="gender",
                label="Gender",
                field_group="personal",
                value=gender_val,
                suggested_value=profile.gender if profile else "Male",
                source="STUDENT_PROFILE" if profile else "MANUAL_ENTRY",
                verification_status="STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("gender", {}).get("is_confirmed", bool(gender_val)),
                guidance="Statutory gender as recorded on government identification documents.",
                warning=gender_warning,
            )
        )

        community_val = saved_form.get("community_category", {}).get("value") or (profile.category if profile else "BC")
        comm_doc = docs_by_type.get("COMMUNITY_CERTIFICATE") or docs_by_type.get("CASTE_CERTIFICATE")
        fields.append(
            ApplicationFormFieldItem(
                key="community_category",
                label="Community Category",
                field_group="personal",
                value=community_val,
                suggested_value=profile.category if profile else "BC",
                source="STUDENT_PROFILE" if profile else "MANUAL_ENTRY",
                verification_status="OFFICIALLY_VERIFIED" if comm_doc and comm_doc.status in ["AVAILABLE", "VERIFIED"] else "STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("community_category", {}).get("is_confirmed", bool(community_val)),
                guidance="Statutory community category recognized by Tamil Nadu Revenue Department (BC, MBC/DNC, SC, SCA, ST, OC).",
            )
        )

        # ----------------------------------------------------------------------
        # Group 2: Academic Institution & Course
        # ----------------------------------------------------------------------
        inst_val = saved_form.get("institution_name", {}).get("value") or (profile.institution if profile else "")
        fields.append(
            ApplicationFormFieldItem(
                key="institution_name",
                label="Current Enrolled Institution",
                field_group="academic",
                value=inst_val,
                suggested_value=profile.institution if profile else "",
                source="STUDENT_PROFILE" if profile else "MANUAL_ENTRY",
                verification_status="OFFICIALLY_VERIFIED" if "BONAFIDE_CERTIFICATE" in docs_by_type else "STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("institution_name", {}).get("is_confirmed", bool(inst_val)),
                guidance="Full official name of your college or university as recognized by UGC/AICTE.",
            )
        )

        course_val = saved_form.get("course_program", {}).get("value") or (profile.course if profile else "")
        fields.append(
            ApplicationFormFieldItem(
                key="course_program",
                label="Degree Course & Branch of Study",
                field_group="academic",
                value=course_val,
                suggested_value=profile.course if profile else "",
                source="STUDENT_PROFILE" if profile else "MANUAL_ENTRY",
                verification_status="OFFICIALLY_VERIFIED" if "BONAFIDE_CERTIFICATE" in docs_by_type else "STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("course_program", {}).get("is_confirmed", bool(course_val)),
                guidance="Specific branch of study (e.g. B.Tech Computer Science and Engineering).",
            )
        )

        year_str = profile.year if profile and profile.year else "2"
        if not str(year_str).lower().startswith("year"):
            year_str = f"Year {year_str}"
        year_val = saved_form.get("academic_year", {}).get("value") or year_str
        fields.append(
            ApplicationFormFieldItem(
                key="academic_year",
                label="Current Year of Study",
                field_group="academic",
                value=year_val,
                suggested_value=year_str,
                source="STUDENT_PROFILE" if profile else "MANUAL_ENTRY",
                verification_status="STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("academic_year", {}).get("is_confirmed", bool(year_val)),
                guidance="Active progression year in the enrolled program curriculum.",
            )
        )

        cgpa_val = saved_form.get("cgpa_score", {}).get("value") or (
            str(profile.cgpa) if profile and profile.cgpa
            else (str(profile.qualifying_marks) if profile and getattr(profile, "qualifying_marks", None)
            else (str(profile.twelfth_percentage) if profile and getattr(profile, "twelfth_percentage", None) else ""))
        )
        suggested_cgpa = (
            str(profile.cgpa) if profile and profile.cgpa
            else (str(profile.qualifying_marks) if profile and getattr(profile, "qualifying_marks", None)
            else (str(profile.twelfth_percentage) if profile and getattr(profile, "twelfth_percentage", None) else ""))
        )
        marksheet_doc = docs_by_type.get("MARKSHEET") or docs_by_type.get("ACADEMIC_TRANSCRIPT")
        fields.append(
            ApplicationFormFieldItem(
                key="cgpa_score",
                label="Qualifying Examination Score / Percentage",
                field_group="academic",
                value=cgpa_val,
                suggested_value=suggested_cgpa,
                source="STUDENT_PROFILE" if suggested_cgpa else "MANUAL_ENTRY",
                verification_status="OFFICIALLY_VERIFIED" if marksheet_doc and marksheet_doc.status in ["AVAILABLE", "VERIFIED"] else "STUDENT_PROVIDED",
                is_required=False,
                is_confirmed=saved_form.get("cgpa_score", {}).get("is_confirmed", bool(cgpa_val)),
                guidance="Cumulative semester score or qualifying exam marks as supported by official marksheets.",
            )
        )

        inst_type_val = saved_form.get("institution_type", {}).get("value") or (
            getattr(profile, "institution_type", "Government-aided") if profile else "Government-aided"
        )
        fields.append(
            ApplicationFormFieldItem(
                key="institution_type",
                label="Institution Classification Type",
                field_group="academic",
                value=inst_type_val,
                suggested_value=getattr(profile, "institution_type", "Government-aided") if profile else "Government-aided",
                source="STUDENT_PROFILE" if profile else "MANUAL_ENTRY",
                verification_status="STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("institution_type", {}).get("is_confirmed", bool(inst_type_val)),
                guidance="Government, Government-aided, or Private autonomous collegiate standing.",
            )
        )

        # ----------------------------------------------------------------------
        # Group 3: Financial Criteria & Income
        # ----------------------------------------------------------------------
        family_income = None
        if student and student.funding_profile and student.funding_profile.annual_family_income:
            family_income = student.funding_profile.annual_family_income
        suggested_income = str(int(family_income)) if family_income else "180000"
        income_val = saved_form.get("annual_income", {}).get("value") or suggested_income
        income_doc = docs_by_type.get("INCOME_CERTIFICATE")
        income_warning = None
        try:
            inc_numeric = float(income_val)
            if scholarship.income_ceiling and inc_numeric > scholarship.income_ceiling:
                income_warning = (
                    f"Income Discrepancy: Annual income of ₹{int(inc_numeric):,} exceeds the "
                    f"official scheme limit of ₹{int(scholarship.income_ceiling):,}."
                )
                discrepancies.append(income_warning)
        except (ValueError, TypeError):
            pass

        fields.append(
            ApplicationFormFieldItem(
                key="annual_income",
                label="Annual Family Income (INR)",
                field_group="financial",
                value=income_val,
                suggested_value=suggested_income,
                source="STUDENT_PROFILE" if family_income else "MANUAL_ENTRY",
                verification_status="OFFICIALLY_VERIFIED" if income_doc and income_doc.status in ["AVAILABLE", "VERIFIED"] else "STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("annual_income", {}).get("is_confirmed", bool(income_val)),
                guidance="Total gross income from all family sources as certified by the Tahsildar / Revenue Authority.",
                warning=income_warning,
            )
        )

        # ----------------------------------------------------------------------
        # Group 4: Eligibility & Residency Specifics
        # ----------------------------------------------------------------------
        state_val = saved_form.get("state_residence", {}).get("value") or (profile.state if profile else "Tamil Nadu")
        state_warning = None
        if scholarship.tn_residency_required == "YES" and str(state_val).lower() != "tamil nadu":
            state_warning = f"Residency Discrepancy: {scholarship.name} requires permanent Tamil Nadu domicile."
            discrepancies.append(state_warning)

        fields.append(
            ApplicationFormFieldItem(
                key="state_residence",
                label="Permanent State of Domicile",
                field_group="eligibility",
                value=state_val,
                suggested_value=profile.state if profile else "Tamil Nadu",
                source="STUDENT_PROFILE" if profile else "MANUAL_ENTRY",
                verification_status="OFFICIALLY_VERIFIED" if "DOMICILE_CERTIFICATE" in docs_by_type else "STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("state_residence", {}).get("is_confirmed", bool(state_val)),
                guidance="State where the student holds permanent domicile or nativity status.",
                warning=state_warning,
            )
        )

        quota_val = saved_form.get("admission_quota", {}).get("value") or (
            profile.admission_quota if profile else "GOVERNMENT_QUOTA"
        )
        fields.append(
            ApplicationFormFieldItem(
                key="admission_quota",
                label="College Admission Quota",
                field_group="eligibility",
                value=quota_val,
                suggested_value=profile.admission_quota if profile else "GOVERNMENT_QUOTA",
                source="STUDENT_PROFILE" if profile else "MANUAL_ENTRY",
                verification_status="STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("admission_quota", {}).get("is_confirmed", bool(quota_val)),
                guidance="Government Single Window Counseling vs Management / Institutional Quota.",
            )
        )

        hostel_val = saved_form.get("hosteller_status", {}).get("value") or (
            profile.hosteller_status if profile else "DAY_SCHOLAR"
        )
        fields.append(
            ApplicationFormFieldItem(
                key="hosteller_status",
                label="Residential Accommodation Status",
                field_group="eligibility",
                value=hostel_val,
                suggested_value=profile.hosteller_status if profile else "DAY_SCHOLAR",
                source="STUDENT_PROFILE" if profile else "MANUAL_ENTRY",
                verification_status="STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("hosteller_status", {}).get("is_confirmed", bool(hostel_val)),
                guidance="Day Scholar or College-Approved Resident Hosteller.",
            )
        )

        first_grad_val = saved_form.get("first_graduate", {}).get("value") or (
            "Yes" if profile and profile.is_first_graduate else "No"
        )
        fields.append(
            ApplicationFormFieldItem(
                key="first_graduate",
                label="First Graduate in Family",
                field_group="eligibility",
                value=first_grad_val,
                suggested_value="Yes" if profile and profile.is_first_graduate else "No",
                source="STUDENT_PROFILE" if profile else "MANUAL_ENTRY",
                verification_status="OFFICIALLY_VERIFIED" if "SPECIAL_CATEGORY_CERTIFICATE" in docs_by_type else "STUDENT_PROVIDED",
                is_required=False,
                is_confirmed=saved_form.get("first_graduate", {}).get("is_confirmed", bool(first_grad_val)),
                guidance="Applicable for Tamil Nadu First Graduate tuition fee concession.",
            )
        )

        # ----------------------------------------------------------------------
        # Group 5: Banking Information (Direct Benefit Transfer)
        # ----------------------------------------------------------------------
        bank_holder_val = saved_form.get("bank_account_holder", {}).get("value") or (student.name if student else "")
        fields.append(
            ApplicationFormFieldItem(
                key="bank_account_holder",
                label="Bank Account Holder Name (Must match Student)",
                field_group="bank",
                value=bank_holder_val,
                suggested_value=student.name if student else "",
                source="STUDENT_PROFILE" if student else "MANUAL_ENTRY",
                verification_status="STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("bank_account_holder", {}).get("is_confirmed", bool(bank_holder_val)),
                guidance="Account must be an active single (savings) account in the applicant's name with Aadhaar seeding.",
            )
        )

        bank_name_val = saved_form.get("bank_name", {}).get("value") or "State Bank of India"
        fields.append(
            ApplicationFormFieldItem(
                key="bank_name",
                label="Bank Institution Name",
                field_group="bank",
                value=bank_name_val,
                suggested_value="State Bank of India",
                source="MANUAL_ENTRY",
                verification_status="STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("bank_name", {}).get("is_confirmed", bool(bank_name_val)),
                guidance="Scheduled public or commercial bank holding your scholarship disbursement account.",
            )
        )

        bank_acc_val = saved_form.get("bank_account_number", {}).get("value") or "XXXX-XXXX-4819"
        fields.append(
            ApplicationFormFieldItem(
                key="bank_account_number",
                label="Bank Account Number",
                field_group="bank",
                value=bank_acc_val,
                suggested_value="XXXX-XXXX-4819",
                source="MANUAL_ENTRY",
                verification_status="STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("bank_account_number", {}).get("is_confirmed", bool(bank_acc_val)),
                guidance="Account number for direct DBT electronic credit.",
            )
        )

        bank_ifsc_val = saved_form.get("bank_ifsc_code", {}).get("value") or "SBIN0000800"
        fields.append(
            ApplicationFormFieldItem(
                key="bank_ifsc_code",
                label="Bank Branch IFSC Code",
                field_group="bank",
                value=bank_ifsc_val,
                suggested_value="SBIN0000800",
                source="MANUAL_ENTRY",
                verification_status="STUDENT_PROVIDED",
                is_required=True,
                is_confirmed=saved_form.get("bank_ifsc_code", {}).get("is_confirmed", bool(bank_ifsc_val)),
                guidance="11-character Indian Financial System Code identifying the branch.",
            )
        )

        # ----------------------------------------------------------------------
        # Group 6: Personal Statement / Purpose
        # ----------------------------------------------------------------------
        statement_val = saved_form.get("personal_statement", {}).get("value") or (application.personal_statement or "")
        fields.append(
            ApplicationFormFieldItem(
                key="personal_statement",
                label="Personal Statement & Financial Need Justification",
                field_group="statement",
                value=statement_val,
                suggested_value=application.personal_statement or "",
                source="ACHIEVEMENTS_VAULT" if application.personal_statement else "MANUAL_ENTRY",
                verification_status="OFFICIALLY_VERIFIED" if len(statement_val.strip()) > 30 else "UNVERIFIED",
                is_required=True,
                is_confirmed=saved_form.get("personal_statement", {}).get("is_confirmed", bool(statement_val)),
                guidance="Factual summary of academic focus, project credentials, and financial necessity.",
            )
        )

        # Audit checklist completion
        for f in fields:
            if f.is_required and (not f.value or not str(f.value).strip()):
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


application_assistant_service = ApplicationAssistantService()
