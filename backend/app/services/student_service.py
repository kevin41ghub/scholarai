from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.funding_profile import FundingProfile
from app.models.document import Document
from app.schemas.student import StudentUpdate, ProfileCompletionResponse, ProfileCompletionSection
from app.db.init_db import init_db, DEMO_STUDENT_EMAIL


class StudentService:
    @staticmethod
    def get_or_create_primary_student(db: Session) -> Student:
        """
        Retrieves the primary student (demo student for Phase 1).
        If database is unseeded, seeds it automatically.
        """
        student = db.query(Student).filter(Student.email == DEMO_STUDENT_EMAIL).first()
        if not student:
            # Fallback check for any student
            student = db.query(Student).first()

        if not student:
            init_db(db)
            student = db.query(Student).filter(Student.email == DEMO_STUDENT_EMAIL).first()

        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found",
            )
        return student

    @staticmethod
    def update_student(db: Session, student: Student, update_data: StudentUpdate) -> Student:
        """
        Updates personal, academic, community, financial, bank, and identity details.
        Guarantees that updating one section does not accidentally erase fields from other sections.
        """
        # Personal updates
        if update_data.name is not None:
            student.name = update_data.name.strip()
        if update_data.email is not None:
            # Check email uniqueness if changed
            existing_email = (
                db.query(Student)
                .filter(Student.email == update_data.email.strip(), Student.id != student.id)
                .first()
            )
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email is already in use by another student",
                )
            student.email = update_data.email.strip()
        if update_data.phone is not None:
            student.phone = update_data.phone.strip() if update_data.phone else None

        # Profile updates
        profile = student.profile
        if not profile:
            profile = StudentProfile(student_id=student.id)
            db.add(profile)

        # Personal details in profile
        if update_data.dob is not None:
            profile.dob = update_data.dob.strip() if update_data.dob else None
        if update_data.district is not None:
            profile.district = update_data.district.strip() if update_data.district else None
        if update_data.native_state is not None:
            profile.native_state = update_data.native_state.strip() if update_data.native_state else "Tamil Nadu"
        if update_data.domicile_status is not None:
            profile.domicile_status = update_data.domicile_status.strip() if update_data.domicile_status else "Tamil Nadu Domicile"
        if update_data.state is not None:
            profile.state = "Tamil Nadu"
        else:
            profile.state = "Tamil Nadu"
        if update_data.gender is not None:
            profile.gender = update_data.gender.strip()

        # Academic details
        if update_data.institution is not None:
            profile.institution = update_data.institution.strip()
        if update_data.course is not None:
            profile.course = update_data.course.strip()
        if update_data.year is not None:
            profile.year = update_data.year.strip()
        if update_data.education_level is not None:
            profile.education_level = update_data.education_level.strip()
        if update_data.stream is not None:
            profile.stream = update_data.stream.strip()
        if update_data.university is not None:
            profile.university = update_data.university.strip() if update_data.university else None
        if update_data.admission_year is not None:
            profile.admission_year = update_data.admission_year.strip() if update_data.admission_year else None
        if update_data.current_semester is not None:
            profile.current_semester = update_data.current_semester.strip() if update_data.current_semester else None
        if update_data.qualifying_exam is not None:
            profile.qualifying_exam = update_data.qualifying_exam.strip() if update_data.qualifying_exam else None
        if update_data.qualifying_marks is not None:
            profile.qualifying_marks = float(update_data.qualifying_marks)
        if update_data.institution_type is not None:
            profile.institution_type = update_data.institution_type.strip()
        if update_data.admission_quota is not None:
            profile.admission_quota = update_data.admission_quota.strip()
        if update_data.hosteller_status is not None:
            profile.hosteller_status = update_data.hosteller_status.strip()
        if update_data.mode_of_study is not None:
            profile.mode_of_study = update_data.mode_of_study.strip() if update_data.mode_of_study else "Regular / Full-Time"
        if update_data.studied_govt_school_6_to_12 is not None:
            profile.studied_govt_school_6_to_12 = bool(update_data.studied_govt_school_6_to_12)
            if profile.studied_govt_school_6_to_12 and not profile.school_type:
                profile.school_type = "Government School (Classes 6-12)"
        if update_data.board_of_education is not None:
            profile.board_of_education = update_data.board_of_education.strip() if update_data.board_of_education else "Tamil Nadu State Board"
        if update_data.is_first_graduate is not None:
            profile.is_first_graduate = bool(update_data.is_first_graduate)
        if update_data.school_type is not None:
            profile.school_type = update_data.school_type.strip() if update_data.school_type else None
        if update_data.school_study_history is not None:
            profile.school_study_history = update_data.school_study_history.strip() if update_data.school_study_history else None

        # Legacy optional academic scores
        if update_data.cgpa is not None:
            profile.cgpa = float(update_data.cgpa)
        if update_data.twelfth_percentage is not None:
            profile.twelfth_percentage = float(update_data.twelfth_percentage)

        # Community & Sensitive Reservation
        if update_data.category is not None:
            profile.category = update_data.category.strip()
        if update_data.community_subcategory is not None:
            profile.community_subcategory = update_data.community_subcategory.strip() if update_data.community_subcategory else None
        if update_data.minority_status is not None:
            profile.minority_status = update_data.minority_status.strip() if update_data.minority_status else "None"
        if update_data.special_category is not None:
            profile.special_category = update_data.special_category.strip() if update_data.special_category else "None"

        # Bank and Benefit
        if update_data.bank_readiness is not None:
            profile.bank_readiness = update_data.bank_readiness.strip()
        if update_data.account_holder_name is not None:
            profile.account_holder_name = update_data.account_holder_name.strip() if update_data.account_holder_name else None
        if update_data.dbt_enabled is not None:
            profile.dbt_enabled = bool(update_data.dbt_enabled)
        if update_data.dbt_seeding_status is not None:
            profile.dbt_seeding_status = update_data.dbt_seeding_status.strip() if update_data.dbt_seeding_status else "Don't Know"
            if profile.dbt_seeding_status in ["Yes", "YES", "Ready", "Seeded"]:
                profile.dbt_enabled = True
            elif profile.dbt_seeding_status in ["No", "NO"]:
                profile.dbt_enabled = False
        if update_data.ration_card_type is not None:
            profile.ration_card_type = update_data.ration_card_type.strip() if update_data.ration_card_type else "Not Available / Don't Know"
        if update_data.bank_name is not None:
            profile.bank_name = update_data.bank_name.strip() if update_data.bank_name else None
        if update_data.bank_branch is not None:
            profile.bank_branch = update_data.bank_branch.strip() if update_data.bank_branch else None

        # Identity & Aadhaar
        if update_data.aadhaar_verification_status is not None:
            profile.aadhaar_verification_status = update_data.aadhaar_verification_status.strip()
        if update_data.aadhaar_masked is not None:
            # Mask format guarantee
            raw_val = update_data.aadhaar_masked.strip().replace(" ", "").replace("-", "")
            if len(raw_val) >= 4:
                profile.aadhaar_masked = f"XXXX-XXXX-{raw_val[-4:]}"
            else:
                profile.aadhaar_masked = update_data.aadhaar_masked.strip()
        if update_data.aadhaar_consent_given is not None:
            profile.aadhaar_consent_given = bool(update_data.aadhaar_consent_given)

        # Financial updates
        funding = student.funding_profile
        if not funding:
            funding = FundingProfile(student_id=student.id)
            db.add(funding)

        if update_data.annual_family_income is not None:
            funding.annual_family_income = float(update_data.annual_family_income)
        if update_data.income_range is not None:
            funding.income_range = update_data.income_range.strip() if update_data.income_range else None
        if update_data.financial_circumstances_notes is not None:
            funding.financial_circumstances_notes = update_data.financial_circumstances_notes.strip() if update_data.financial_circumstances_notes else None
        if update_data.income_certificate_status is not None:
            funding.income_certificate_status = update_data.income_certificate_status.strip()

        # Handle education cost, support, and direct funding gap updates
        if update_data.annual_education_cost is not None:
            funding.annual_education_cost = float(update_data.annual_education_cost)
        if update_data.existing_support is not None:
            funding.existing_support = float(update_data.existing_support)

        # If user explicitly updated funding_gap, synchronize annual_education_cost to match: cost = support + gap
        if update_data.funding_gap is not None and update_data.annual_education_cost is None:
            gap = max(0.0, float(update_data.funding_gap))
            funding.annual_education_cost = float(funding.existing_support) + gap

        db.commit()
        db.refresh(student)
        return student

    @staticmethod
    def get_profile_completion(db: Session, student: Student) -> ProfileCompletionResponse:
        """
        Calculates profile completion objectively based on meaningful required fields.
        Returns clear section-by-section breakdown.
        """
        profile = student.profile
        funding = student.funding_profile

        # Check document vault for income certificate and ID proof
        income_doc = (
            db.query(Document)
            .filter(Document.student_id == student.id, Document.document_type == "INCOME_CERTIFICATE")
            .first()
        )
        id_doc = (
            db.query(Document)
            .filter(Document.student_id == student.id, Document.document_type == "ID_PROOF")
            .first()
        )

        sections: Dict[str, ProfileCompletionSection] = {}

        # 1. Personal Information
        personal_missing = []
        if not student.name or len(student.name.strip()) < 2:
            personal_missing.append("Legal Full Name")
        if not student.email:
            personal_missing.append("Email Address")
        if not getattr(profile, "dob", None):
            personal_missing.append("Date of Birth")
        if not getattr(profile, "district", None):
            personal_missing.append("District of Residence")
        if not getattr(profile, "gender", None):
            personal_missing.append("Gender")

        personal_pct = max(0, int((5 - len(personal_missing)) / 5 * 100))
        sections["personal"] = ProfileCompletionSection(
            status="COMPLETE" if len(personal_missing) == 0 else "INCOMPLETE",
            percentage=personal_pct,
            missing_fields=personal_missing,
            summary="Personal identification, contact, and domicile details." if len(personal_missing) == 0 else f"Missing: {', '.join(personal_missing)}"
        )

        # 2. Academic Information
        academic_missing = []
        if not getattr(profile, "institution", None):
            academic_missing.append("College/Institution Name")
        if not getattr(profile, "course", None):
            academic_missing.append("Course / Program Name")
        if not getattr(profile, "year", None):
            academic_missing.append("Current Year of Study")
        if not getattr(profile, "stream", None):
            academic_missing.append("Academic Stream")
        if not getattr(profile, "institution_type", None):
            academic_missing.append("Institution Type")

        academic_pct = max(0, int((5 - len(academic_missing)) / 5 * 100))
        sections["academic"] = ProfileCompletionSection(
            status="COMPLETE" if len(academic_missing) == 0 else "INCOMPLETE",
            percentage=academic_pct,
            missing_fields=academic_missing,
            summary="Degree program, institution, and study level." if len(academic_missing) == 0 else f"Missing: {', '.join(academic_missing)}"
        )

        # 3. Community Information
        comm_missing = []
        cat = getattr(profile, "category", None)
        if not cat or cat in ["", "Not specified"]:
            comm_missing.append("Community Category (BC/MBC/SC/ST/OC)")

        comm_pct = 100 if len(comm_missing) == 0 else 0
        sections["community"] = ProfileCompletionSection(
            status="COMPLETE" if len(comm_missing) == 0 else "INCOMPLETE",
            percentage=comm_pct,
            missing_fields=comm_missing,
            summary=f"Community Category ({cat}) recorded." if len(comm_missing) == 0 else "Community Category not selected."
        )

        # 4. Financial Information
        fin_missing = []
        income_val = funding.annual_family_income if funding else 0.0
        if income_val <= 0 and not (funding and funding.income_range):
            fin_missing.append("Annual Family Income")
        if not funding or funding.annual_education_cost <= 0:
            fin_missing.append("Annual Education Cost / Need")

        has_income_doc = income_doc and income_doc.status == "AVAILABLE"
        fin_pct = max(0, int((2 - len(fin_missing)) / 2 * 100))
        fin_status = "COMPLETE" if len(fin_missing) == 0 else "NEEDS_UPDATING"
        sections["financial"] = ProfileCompletionSection(
            status=fin_status,
            percentage=fin_pct,
            missing_fields=fin_missing,
            summary=f"Income ₹{int(income_val):,} recorded ({'Certificate attached' if has_income_doc else 'Certificate pending'})." if len(fin_missing) == 0 else f"Missing: {', '.join(fin_missing)}"
        )

        # 5. Bank and Benefit
        bank_ready = getattr(profile, "bank_readiness", "NOT_CONFIGURED")
        bank_missing = []
        if bank_ready != "READY":
            bank_missing.append("Bank Account Readiness / DBT Verification")
        bank_pct = 100 if bank_ready == "READY" else 50
        sections["bank_benefit"] = ProfileCompletionSection(
            status="COMPLETE" if bank_ready == "READY" else "NEEDS_UPDATING",
            percentage=bank_pct,
            missing_fields=bank_missing,
            summary="Direct Benefit Transfer (DBT) account ready." if bank_ready == "READY" else "Bank account readiness not confirmed."
        )

        # 6. Identity and Aadhaar
        id_status = getattr(profile, "aadhaar_verification_status", "NOT_PROVIDED")
        has_id_doc = id_doc and id_doc.status == "AVAILABLE"
        id_pct = 100 if (id_status == "VERIFIED_AUTHORIZED" or has_id_doc) else (50 if id_status == "VERIFICATION_PENDING" else 0)
        id_missing = []
        if id_status in ["NOT_PROVIDED", "VERIFICATION_REQUIRED"] and not has_id_doc:
            id_missing.append("Aadhaar Identity Proof Document or Reference")
        sections["identity"] = ProfileCompletionSection(
            status="COMPLETE" if (id_status == "VERIFIED_AUTHORIZED" or has_id_doc) else "VERIFICATION_REQUIRED",
            percentage=id_pct,
            missing_fields=id_missing,
            summary="Identity proof documented in vault." if (id_status == "VERIFIED_AUTHORIZED" or has_id_doc) else "Identity verification pending."
        )

        # Calculate overall score weighted by key matching categories (Personal 25%, Academic 30%, Community 20%, Financial 25%)
        overall = int((personal_pct * 0.25) + (academic_pct * 0.30) + (comm_pct * 0.20) + (fin_pct * 0.25))
        overall_status = "OPTIMAL" if overall >= 85 else ("SUFFICIENT" if overall >= 60 else "NEEDS_PROFILE_COMPLETION")

        return ProfileCompletionResponse(
            overall_percentage=overall,
            overall_status=overall_status,
            sections=sections
        )


student_service = StudentService()
