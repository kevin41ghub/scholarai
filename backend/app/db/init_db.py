import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.base import Base
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.funding_profile import FundingProfile
from app.models.scholarship import Scholarship, KNOWN_FICTIONAL_DEMO_NAMES, RETIRED_DEMO_STATUSES
from app.models.eligibility_rule import EligibilityRule
from app.models.scholarship_requirement import ScholarshipRequirement
from app.models.document import Document
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.models.action import Action
from app.models.planner import PlannerGoal
from app.models.user import User
from app.models.evidence import Evidence
from app.models.knowledge import KnowledgeSource, KnowledgeDocument, KnowledgeChunk
from app.models.notification import Notification
from app.core.security import hash_password
from app.core.config import settings
from app.db.migrations import run_schema_migrations
import hashlib

logger = logging.getLogger(__name__)

DEMO_STUDENT_EMAIL = "arjun.kumar@demo.edu"


KNOWN_FICTIONAL_DEMO_NAMES = {
    "Empower Future Scholarship",
    "NextGen Technology Grant",
    "National Merit-cum-Means Scholarship",
    "CSR STEM Bursary",
    "Regional Student Stipend",
    "State Welfare Fellowship",
    "Women in Technology Scholarship",
    "PG Excellence Fellowship",
}


def retire_legacy_demo_scholarships(db: Session) -> int:
    """
    Safely retires known fictional demo scholarship records by setting status to INACTIVE
    and verification_status to RETIRED_DEMO.

    Strict Safety Rules:
    - Does NOT delete any scholarship record rows from the database.
    - Does NOT alter primary keys or break foreign-key relationships.
    - Preserves all student application references and requirements intact.
    - Uses an explicit, reviewed identification rule (known demo names / demo providers / DEMO_DATA status).
    - Excludes verified Tamil Nadu dossiers from retirement.
    """
    try:
        candidates = db.query(Scholarship).all()
        retired_count = 0

        for s in candidates:
            # Skip if already verified dossier
            if s.dossier_index and s.dossier_index.startswith("№ "):
                continue

            # Explicit, conservative identification rule
            is_fictional_demo = (
                s.verification_status == "DEMO_DATA"
                or (s.provider and "(Demo)" in s.provider)
                or (s.name in KNOWN_FICTIONAL_DEMO_NAMES)
            )

            if is_fictional_demo:
                needs_update = False
                if s.status != "INACTIVE":
                    s.status = "INACTIVE"
                    needs_update = True
                if s.verification_status != "RETIRED_DEMO":
                    s.verification_status = "RETIRED_DEMO"
                    needs_update = True
                if needs_update:
                    retired_count += 1

        if retired_count > 0:
            db.commit()
            logger.info(
                f"Safely retired {retired_count} legacy demo scholarship record(s) "
                f"(status=INACTIVE, verification_status=RETIRED_DEMO). No user applications deleted."
            )
        return retired_count
    except Exception as e:
        logger.warning(f"Note during legacy demo scholarship retirement: {e}")
        db.rollback()
        return 0


# Backward compatibility alias
cleanup_legacy_demo_catalog = retire_legacy_demo_scholarships


def init_db(db: Session) -> None:
    """
    Initialize tables and seed verified Tamil Nadu scholarship intelligence,
    autonomous college student profile, genuine requirements, applications, and knowledge base.
    """
    bind = db.get_bind()
    Base.metadata.create_all(bind=bind)

    # Run safe schema migrations (widens columns on PostgreSQL, adds missing columns, indexes)
    try:
        run_schema_migrations(bind)
    except Exception as mig_err:
        logger.warning(f"Note during schema migration in init_db: {mig_err}")

    # Step 0: Clean up any old fictional demo data
    cleanup_legacy_demo_catalog(db)

    # 1. Check/Seed Domicile Student Profile (Tamil Nadu Autonomous College)
    student = db.query(Student).filter(Student.email == DEMO_STUDENT_EMAIL).first()
    if not student:
        logger.info("Seeding student: Arjun Kumar (Loyola College Chennai, Autonomous)")
        student = Student(
            name="Arjun Kumar",
            email=DEMO_STUDENT_EMAIL,
            phone="+91 98765 43210",
        )
        db.add(student)
        db.flush()

        profile = StudentProfile(
            student_id=student.id,
            institution="Loyola College (Autonomous), Chennai",
            course="B.Sc Computer Science",
            year="2nd Year",
            cgpa=8.4,
            twelfth_percentage=89.2,
            category="BC",
            state="Tamil Nadu",
            gender="Male",
            admission_quota="GOVERNMENT_QUOTA",
            hosteller_status="DAY_SCHOLAR",
            is_first_graduate=False,
        )
        db.add(profile)

        funding = FundingProfile(
            student_id=student.id,
            annual_education_cost=65000.0,
            existing_support=0.0,
            annual_family_income=210000.0,
        )
        db.add(funding)
        db.commit()
        db.refresh(student)
        logger.info("Student profile seeded successfully.")
    else:
        # Ensure student profile reflects Tamil Nadu autonomous college profile
        if student.profile:
            student.profile.institution = "Loyola College (Autonomous), Chennai"
            student.profile.course = "B.Sc Computer Science"
            student.profile.state = "Tamil Nadu"
            student.profile.category = "BC"
            student.profile.cgpa = 8.4
            student.profile.twelfth_percentage = 89.2
            student.profile.gender = "Male"
        if student.funding_profile:
            student.funding_profile.annual_family_income = 210000.0
            student.funding_profile.annual_education_cost = 65000.0
            student.funding_profile.existing_support = 0.0
        db.commit()

    # 2. Idempotently Seed 11 Verified Tamil Nadu & Central Scholarship Schemes
    logger.info("Verifying and idempotently synchronizing 11 verified Tamil Nadu scholarship records...")
    now = datetime.now(timezone.utc)

    verified_scholarships_data = [
            {
                "name": "Post-Matric Scholarship for SC/ST/SCA Students",
                "provider": "Adi Dravidar and Tribal Welfare Department, Government of Tamil Nadu",
                "dossier_index": "№ TN-ADW-2025-01",
                "stream": "BOTH",
                "study_level": "BOTH",
                "category_tag": "Government Scholarships, Tamil Nadu State Schemes, Community/Category-Based, Tuition and Fee Assistance",
                "institution_types": "Government, Aided, and Self-Financing Autonomous Colleges",
                "autonomous_compatibility": "Fully eligible in Autonomous Arts & Science and Autonomous Engineering colleges admitted via Government single-window quota / TNEA. Management quota seats are not covered.",
                "tn_residency_required": True,
                "community_category": "SC,ST,SCA",
                "income_ceiling": 250000.0,
                "income_criteria_raw": "Annual parental income not exceeding ₹2,50,000 for SC/ST/SCA students (₹8,00,000 for central top-class categories).",
                "award_type": "TUITION_WAIVER_AND_MAINTENANCE",
                "award_display": "100% compulsory tuition fee waiver + monthly maintenance allowance (₹550–₹1,200/mo)",
                "amount": 55000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=45),
                "application_url": "https://sspdept.tnega.org/",
                "source_url": "https://tndce.tn.gov.in/Home/scholarship_cms",
                "source_name": "Tamil Nadu State Scholarship Portal (Official)",
                "official_portal_name": "Tamil Nadu State Scholarship Portal (SSP / UMIS)",
                "official_guideline_url": "https://tndce.tn.gov.in/Home/scholarship_cms",
                "academic_year": "2024-2026",
                "source_verification_status": "SOURCE_VERIFIED",
                "application_window_status": "ANNUAL_CYCLE",
                "verification_status": "SOURCE_VERIFIED",
                "eligibility_summary": "TN Domicile, SC/ST/SCA category, Family Income <= ₹2.5L, admitted in Autonomous college via Single-Window / Govt quota.",
                "description": "Flagship Tamil Nadu post-matric scholarship guaranteeing 100% compulsory fee waiver and monthly living maintenance for SC/ST/SCA students in recognized autonomous Arts & Science and Engineering colleges.",
                "application_effort": "Medium (3-4 hrs via college office)",
                "status": "ACTIVE",
                "unresolved_questions": "Hosteller maintenance requires college hostel warden certification. Day scholar rates apply otherwise.",
                "rules": [
                    {"rule_type": "STATE", "criteria_value": "Tamil Nadu", "operator": "EQUALS", "description": "Domicile of Tamil Nadu"},
                    {"rule_type": "CATEGORY", "criteria_value": "SC,ST,SCA", "operator": "IN", "description": "Belongs to SC, ST, or SCA community"},
                    {"rule_type": "MAX_INCOME", "criteria_value": "250000", "operator": "LTE", "description": "Annual parental income up to ₹2,50,000"},
                ],
                "requirements": [
                    {"name": "Community Certificate (Tahsildar Issued)", "document_type": "COMMUNITY_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Current Fiscal Year Income Certificate", "document_type": "INCOME_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Institutional Bonafide & Allotment Order", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Current Semester Marksheet", "document_type": "MARKSHEET", "type": "DOCUMENT", "is_required": True},
                    {"name": "Aadhaar Card / Domicile Proof", "document_type": "ID_PROOF", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "Post-Matric Scholarship for BC, MBC & DNC Students",
                "provider": "Backward Classes, Most Backward Classes and Minorities Welfare Department, Government of Tamil Nadu",
                "dossier_index": "№ TN-BCMW-2025-02",
                "stream": "BOTH",
                "study_level": "BOTH",
                "category_tag": "Government Scholarships, Tamil Nadu State Schemes, Community/Category-Based, Tuition and Fee Assistance",
                "institution_types": "Government, Aided, and Self-Financing Autonomous Colleges",
                "autonomous_compatibility": "Eligible in Autonomous Government and Aided institutions; Self-Financing Autonomous colleges covered for Government Quota (TNEA/DCE) seats subject to department fee cap.",
                "tn_residency_required": True,
                "community_category": "BC,MBC,DNC",
                "income_ceiling": 250000.0,
                "income_criteria_raw": "Annual parental income not exceeding ₹2,50,000.",
                "award_type": "VARIABLE_ASSISTANCE",
                "award_display": "Tuition fee reimbursement (statutory rates) + Special fees + Maintenance allowance",
                "amount": 25000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=30),
                "application_url": "https://sspdept.tnega.org/",
                "source_url": "https://bcmbcmw.tn.gov.in/welfschemes.htm",
                "source_name": "TN BC/MBC Welfare Department Portal (Official)",
                "official_portal_name": "TN BCMBCMW Welfare Dept / State Scholarship Portal",
                "official_guideline_url": "https://bcmbcmw.tn.gov.in/welfschemes.htm",
                "academic_year": "2024-2026",
                "source_verification_status": "SOURCE_VERIFIED",
                "application_window_status": "ANNUAL_CYCLE",
                "verification_status": "SOURCE_VERIFIED",
                "eligibility_summary": "TN Domicile, BC/MBC/DNC community, Family Income <= ₹2.5L, admitted in approved regular courses in autonomous colleges.",
                "description": "State post-matric assistance covering approved tuition fees, exam fees, and maintenance allowances for Backward Classes, Most Backward Classes, and Denotified Communities in higher education.",
                "application_effort": "Medium (3 hrs via TN SSP)",
                "status": "ACTIVE",
                "unresolved_questions": "Self-financing autonomous college fee reimbursement is capped at approved government fee structure.",
                "rules": [
                    {"rule_type": "STATE", "criteria_value": "Tamil Nadu", "operator": "EQUALS", "description": "Domicile of Tamil Nadu"},
                    {"rule_type": "CATEGORY", "criteria_value": "BC,MBC,DNC,OBC", "operator": "IN", "description": "Belongs to BC, MBC, or DNC community"},
                    {"rule_type": "MAX_INCOME", "criteria_value": "250000", "operator": "LTE", "description": "Annual family income up to ₹2,50,000"},
                ],
                "requirements": [
                    {"name": "Permanent Community Certificate", "document_type": "COMMUNITY_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Income Certificate (Current Fiscal Year)", "document_type": "INCOME_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Institutional Bonafide Certificate", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Current Semester Marksheet", "document_type": "MARKSHEET", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "Free Education Scheme for 3-Year Degree Students (BC/MBC/DNC)",
                "provider": "Directorate of Collegiate Education, Government of Tamil Nadu",
                "dossier_index": "№ TN-DCE-2025-03",
                "stream": "ARTS_SCIENCE",
                "study_level": "UG",
                "category_tag": "Government Scholarships, Tamil Nadu State Schemes, Community/Category-Based, Tuition and Fee Assistance",
                "institution_types": "Government and Government-Aided Autonomous Arts & Science Colleges",
                "autonomous_compatibility": "Exclusively applies to Government Autonomous and Government-Aided Autonomous Arts & Science colleges (Aided Day Shift). Self-financing courses/shifts are not eligible.",
                "tn_residency_required": True,
                "community_category": "BC,MBC,DNC",
                "income_ceiling": 250000.0,
                "income_criteria_raw": "No income limit for MBC/DNC students. Annual income <= ₹2,50,000 for BC students.",
                "award_type": "TUITION_WAIVER",
                "award_display": "100% exemption from tuition, special fees, and examination fees",
                "amount": 15000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=25),
                "application_url": "https://tndce.tn.gov.in/Home/scholarship_cms",
                "source_url": "https://tndce.tn.gov.in/Home/scholarship_cms",
                "source_name": "TNDCE Official Scholarship Portal",
                "official_portal_name": "Tamil Nadu Directorate of Collegiate Education (TNDCE)",
                "official_guideline_url": "https://tndce.tn.gov.in/Home/scholarship_cms",
                "academic_year": "2024-2026",
                "source_verification_status": "SOURCE_VERIFIED",
                "application_window_status": "ANNUAL_CYCLE",
                "verification_status": "SOURCE_VERIFIED",
                "eligibility_summary": "TN Domicile, BC/MBC/DNC, UG 3-Year Arts & Science in Govt/Aided Autonomous Colleges. No income limit for MBC/DNC; <= ₹2.5L for BC.",
                "description": "Complete tuition fee waiver scheme for BC/MBC/DNC undergraduate students pursuing B.A., B.Sc., B.Com. in government and government-aided autonomous colleges.",
                "application_effort": "Low (1-2 hrs via college office)",
                "status": "ACTIVE",
                "unresolved_questions": "Does not cover evening self-financing shifts operated in aided colleges.",
                "rules": [
                    {"rule_type": "STATE", "criteria_value": "Tamil Nadu", "operator": "EQUALS", "description": "Domicile of Tamil Nadu"},
                    {"rule_type": "COURSE", "criteria_value": "B.A.,B.Sc,B.Com,BCA,BBA,Arts,Science", "operator": "CONTAINS", "description": "3-Year Undergraduate Arts & Science degree"},
                    {"rule_type": "CATEGORY", "criteria_value": "BC,MBC,DNC,OBC", "operator": "IN", "description": "Belongs to BC, MBC, or DNC"},
                    {"rule_type": "MAX_INCOME", "criteria_value": "250000", "operator": "LTE", "description": "Income <= ₹2,50,000 for BC (No limit for MBC/DNC)"},
                ],
                "requirements": [
                    {"name": "Permanent Community Certificate", "document_type": "COMMUNITY_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Income Certificate", "document_type": "INCOME_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Institutional Bonafide Certificate", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "Moovalur Ramamirtham Ammaiyar Higher Education Assurance Scheme (Pudhumai Penn)",
                "provider": "Social Welfare and Women Empowerment Department, Government of Tamil Nadu",
                "dossier_index": "№ TN-SWD-2025-04",
                "stream": "BOTH",
                "study_level": "UG",
                "category_tag": "Government Scholarships, Tamil Nadu State Schemes, Women in Higher Education",
                "institution_types": "All Recognized Autonomous Colleges in Tamil Nadu",
                "autonomous_compatibility": "Fully eligible across all Autonomous Arts & Science and Engineering colleges (Govt, Aided, Self-Financing).",
                "tn_residency_required": True,
                "community_category": "ALL",
                "income_ceiling": None,
                "income_criteria_raw": "No family income ceiling. Eligibility is verified based on schooling in Tamil Nadu Government schools from Classes 6 to 12.",
                "award_type": "FIXED_STIPEND",
                "award_display": "₹1,000 per month (₹12,000/year) DBT until undergraduate degree completion",
                "amount": 12000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=60),
                "application_url": "https://www.pudhumaipenn.tn.gov.in/",
                "source_url": "https://www.pudhumaipenn.tn.gov.in/",
                "source_name": "Tamil Nadu Social Welfare Department (Official)",
                "official_portal_name": "Pudhumai Penn Portal / UMIS TN",
                "official_guideline_url": "https://www.pudhumaipenn.tn.gov.in/",
                "academic_year": "2024-2026",
                "source_verification_status": "SOURCE_VERIFIED",
                "application_window_status": "ANNUAL_CYCLE",
                "verification_status": "SOURCE_VERIFIED",
                "eligibility_summary": "Female students, TN Domicile, studied Classes 6 to 12 in TN Govt schools, enrolled in UG degree in autonomous colleges.",
                "description": "Transformative monthly financial assistance of ₹1,000 directly transferred to girl students who completed schooling in TN government schools and enrolled in higher education degrees.",
                "application_effort": "Low (2 hrs via EMIS school records)",
                "status": "ACTIVE",
                "unresolved_questions": "Requires EMIS student ID verification from high school records.",
                "rules": [
                    {"rule_type": "STATE", "criteria_value": "Tamil Nadu", "operator": "EQUALS", "description": "Domicile of Tamil Nadu"},
                    {"rule_type": "GENDER", "criteria_value": "Female", "operator": "EQUALS", "description": "Restricted strictly to female students"},
                ],
                "requirements": [
                    {"name": "School Bonafide (6th-12th Govt School / EMIS Record)", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "College Bonafide Certificate", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Bank Passbook (Aadhaar Seeded)", "document_type": "ID_PROOF", "type": "DOCUMENT", "is_required": True},
                    {"name": "Aadhaar Card", "document_type": "ID_PROOF", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "First Graduate (FG) Tuition Fee Concession",
                "provider": "Directorate of Technical Education (DOTE), Government of Tamil Nadu",
                "dossier_index": "№ TN-DOTE-2025-05",
                "stream": "ENGINEERING",
                "study_level": "UG",
                "category_tag": "Government Scholarships, Tamil Nadu State Schemes, Tuition and Fee Assistance",
                "institution_types": "All Autonomous Engineering Colleges affiliated with Anna University",
                "autonomous_compatibility": "Covers all Autonomous Engineering Colleges for seats allocated through TNEA Single Window Government Counselling. Management quota admissions are strictly excluded.",
                "tn_residency_required": True,
                "community_category": "ALL",
                "income_ceiling": None,
                "income_criteria_raw": "No income limit. Must be the first individual in the immediate family (including siblings) to graduate.",
                "award_type": "TUITION_WAIVER",
                "award_display": "₹25,000–₹27,500/year full tuition waiver for entire 4-year B.E./B.Tech. duration",
                "amount": 27500.0,
                "currency": "INR",
                "deadline": now + timedelta(days=20),
                "application_url": "https://www.tneaonline.org/",
                "source_url": "https://www.dte.tn.gov.in/",
                "source_name": "Directorate of Technical Education TN",
                "official_portal_name": "Tamil Nadu Engineering Admissions (TNEA) / DOTE",
                "official_guideline_url": "https://www.tneaonline.org/",
                "academic_year": "2024-2026",
                "source_verification_status": "SOURCE_VERIFIED",
                "application_window_status": "ANNUAL_CYCLE",
                "verification_status": "SOURCE_VERIFIED",
                "eligibility_summary": "TN Domicile, First graduate in family, admitted in Autonomous Engineering College through TNEA counselling.",
                "description": "Government tuition fee waiver granted to students who are the first generation in their family to enter higher education, pursuing B.E./B.Tech in autonomous engineering colleges.",
                "application_effort": "Medium (requires Tahsildar FG Certificate)",
                "status": "ACTIVE",
                "unresolved_questions": "If an elder sibling has previously availed the First Graduate concession or holds a degree, the applicant is ineligible.",
                "rules": [
                    {"rule_type": "STATE", "criteria_value": "Tamil Nadu", "operator": "EQUALS", "description": "Domicile of Tamil Nadu"},
                    {"rule_type": "COURSE", "criteria_value": "Engineering,B.E.,B.Tech", "operator": "CONTAINS", "description": "Enrolled in B.E. / B.Tech engineering degree"},
                    {"rule_type": "FIRST_GRADUATE", "criteria_value": "TRUE", "operator": "EQUALS", "description": "Applicant must be first graduate in immediate family"},
                    {"rule_type": "ADMISSION_QUOTA", "criteria_value": "GOVERNMENT_QUOTA", "operator": "EQUALS", "description": "Single-window TNEA government counselling quota admission only"},
                ],
                "requirements": [
                    {"name": "First Graduate Certificate (Tahsildar Issued)", "document_type": "SPECIAL_CATEGORY_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Joint Declaration Signed by Parents & Candidate", "document_type": "STATEMENT_OF_PURPOSE", "type": "DOCUMENT", "is_required": True},
                    {"name": "TNEA Single-Window Allotment Order", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Aadhaar Card", "document_type": "ID_PROOF", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "Central Sector Scheme of Scholarship for College and University Students (PM-USP CSSS)",
                "provider": "Department of Higher Education, Ministry of Education, Government of India",
                "dossier_index": "№ IND-NSP-2025-06",
                "stream": "BOTH",
                "study_level": "BOTH",
                "category_tag": "Government Scholarships, Central Government Schemes, Merit-Based, Income-Based",
                "institution_types": "All UGC/AICTE Recognized Autonomous Colleges",
                "autonomous_compatibility": "Eligible in all Autonomous Arts & Science and Engineering colleges registered with AISHE code on the National Scholarship Portal.",
                "tn_residency_required": False,
                "community_category": "ALL",
                "income_ceiling": 450000.0,
                "income_criteria_raw": "Gross annual parental income not exceeding ₹4,50,000.",
                "award_type": "FIXED_STIPEND",
                "award_display": "₹12,000/yr for first 3 years (UG) and ₹20,000/yr for 4th year (Engineering) or PG",
                "amount": 12000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=50),
                "application_url": "https://scholarships.gov.in/",
                "source_url": "https://scholarships.gov.in/All-Scholarships",
                "source_name": "National Scholarship Portal (Official)",
                "official_portal_name": "National Scholarship Portal (NSP)",
                "official_guideline_url": "https://scholarships.gov.in/All-Scholarships",
                "academic_year": "2024-2026",
                "source_verification_status": "SOURCE_VERIFIED",
                "application_window_status": "ANNUAL_CYCLE",
                "verification_status": "SOURCE_VERIFIED",
                "eligibility_summary": "Above 80th percentile in TN HSE / Class 12, Gross Family Income <= ₹4.5L, enrolled in regular UG/PG degree in autonomous college.",
                "description": "Merit-cum-means central scholarship supporting top 20th percentile board exam qualifiers enrolled in regular degree programs in autonomous colleges.",
                "application_effort": "Medium (3-5 hrs on NSP)",
                "status": "ACTIVE",
                "unresolved_questions": "Annual renewal requires >= 50% aggregate marks in annual college exams and minimum 75% attendance.",
                "rules": [
                    {"rule_type": "MIN_12TH_PERCENTAGE", "criteria_value": "80.0", "operator": "GTE", "description": "Above 80th percentile in 12th board examinations"},
                    {"rule_type": "MAX_INCOME", "criteria_value": "450000", "operator": "LTE", "description": "Gross family income not exceeding ₹4,50,000"},
                ],
                "requirements": [
                    {"name": "Class 12 Marksheet / Percentile Proof", "document_type": "MARKSHEET", "type": "DOCUMENT", "is_required": True},
                    {"name": "Income Certificate", "document_type": "INCOME_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Institutional Bonafide Certificate", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Aadhaar Card", "document_type": "ID_PROOF", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "AICTE Pragati Scholarship for Girl Students",
                "provider": "All India Council for Technical Education (AICTE), Government of India",
                "dossier_index": "№ IND-AICTE-2025-07",
                "stream": "ENGINEERING",
                "study_level": "UG",
                "category_tag": "Government Scholarships, Central Government Schemes, Women in Higher Education",
                "institution_types": "AICTE-Approved Autonomous Engineering Colleges",
                "autonomous_compatibility": "Eligible in all AICTE-approved autonomous engineering institutions in Tamil Nadu (1st year or 2nd year lateral entry).",
                "tn_residency_required": False,
                "community_category": "ALL",
                "income_ceiling": 800000.0,
                "income_criteria_raw": "Family income from all sources not exceeding ₹8,00,000 per annum.",
                "award_type": "FIXED_STIPEND",
                "award_display": "₹50,000 per annum for tuition fees, computer purchase, books, and equipment",
                "amount": 50000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=40),
                "application_url": "https://scholarships.gov.in/",
                "source_url": "https://www.aicte-india.org/schemes/students-development-schemes/pragati",
                "source_name": "AICTE Official Schemes Portal",
                "official_portal_name": "National Scholarship Portal / AICTE Portal",
                "official_guideline_url": "https://www.aicte-india.org/schemes/students-development-schemes/pragati",
                "academic_year": "2024-2026",
                "source_verification_status": "SOURCE_VERIFIED",
                "application_window_status": "ANNUAL_CYCLE",
                "verification_status": "SOURCE_VERIFIED",
                "eligibility_summary": "Female students admitted to 1st year (or lateral entry) B.E./B.Tech in AICTE-approved autonomous colleges, Family Income <= ₹8.0L (max 2 girls per family).",
                "description": "Special central initiative by AICTE to foster technical education among female students through ₹50,000 annual direct support.",
                "application_effort": "Medium (3-4 hrs)",
                "status": "ACTIVE",
                "unresolved_questions": "Limited to 10,000 national slots; selection follows state-wise merit list based on qualifying exams.",
                "rules": [
                    {"rule_type": "GENDER", "criteria_value": "Female", "operator": "EQUALS", "description": "Restricted strictly to female students"},
                    {"rule_type": "COURSE", "criteria_value": "Engineering,B.E.,B.Tech", "operator": "CONTAINS", "description": "Enrolled in AICTE-approved engineering degree"},
                    {"rule_type": "MAX_INCOME", "criteria_value": "800000", "operator": "LTE", "description": "Annual family income not exceeding ₹8,00,000"},
                ],
                "requirements": [
                    {"name": "TNEA / College Admission Allotment Order", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Income Certificate", "document_type": "INCOME_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Class 12 / Diploma Marksheet", "document_type": "MARKSHEET", "type": "DOCUMENT", "is_required": True},
                    {"name": "Aadhaar Card", "document_type": "ID_PROOF", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "AICTE Saksham Scholarship for Differently-Abled Students",
                "provider": "All India Council for Technical Education (AICTE), Government of India",
                "dossier_index": "№ IND-AICTE-2025-08",
                "stream": "ENGINEERING",
                "study_level": "UG",
                "category_tag": "Government Scholarships, Central Government Schemes, Disability Support",
                "institution_types": "AICTE-Approved Autonomous Engineering Colleges",
                "autonomous_compatibility": "Eligible in all AICTE-approved autonomous engineering institutions.",
                "tn_residency_required": False,
                "community_category": "ALL",
                "income_ceiling": 800000.0,
                "income_criteria_raw": "Family income not exceeding ₹8,00,000 per annum. Minimum 40% benchmark disability.",
                "award_type": "FIXED_STIPEND",
                "award_display": "₹50,000 per annum for tuition fees, books, equipment, and assistive software",
                "amount": 50000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=40),
                "application_url": "https://scholarships.gov.in/",
                "source_url": "https://www.aicte-india.org/schemes/students-development-schemes/saksham",
                "source_name": "AICTE Official Portal",
                "official_portal_name": "National Scholarship Portal / AICTE",
                "official_guideline_url": "https://www.aicte-india.org/schemes/students-development-schemes/saksham",
                "academic_year": "2024-2026",
                "source_verification_status": "SOURCE_VERIFIED",
                "application_window_status": "ANNUAL_CYCLE",
                "verification_status": "SOURCE_VERIFIED",
                "eligibility_summary": "Differently-abled students (>= 40% disability), admitted to B.E./B.Tech in AICTE-approved colleges, Family Income <= ₹8.0L.",
                "description": "AICTE scheme dedicated to supporting differently-abled students with ₹50,000 per year towards degree expenses and assistive devices.",
                "application_effort": "Medium (3 hrs)",
                "status": "ACTIVE",
                "unresolved_questions": "UDID card or government district medical board certificate is mandatory.",
                "rules": [
                    {"rule_type": "COURSE", "criteria_value": "Engineering,B.E.,B.Tech", "operator": "CONTAINS", "description": "Enrolled in AICTE-approved technical engineering program"},
                    {"rule_type": "MAX_INCOME", "criteria_value": "800000", "operator": "LTE", "description": "Annual family income up to ₹8,00,000"},
                ],
                "requirements": [
                    {"name": "Disability Certificate (UDID / Medical Board)", "document_type": "SPECIAL_CATEGORY_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Income Certificate", "document_type": "INCOME_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "College Bonafide Certificate", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Current Marksheet", "document_type": "MARKSHEET", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "Post-Matric Scholarship for Minorities (NSP / MoMA)",
                "provider": "Ministry of Minority Affairs (MoMA), Government of India",
                "dossier_index": "№ IND-MOMA-2025-09",
                "stream": "BOTH",
                "study_level": "BOTH",
                "category_tag": "Government Scholarships, Central Government Schemes, Minority Support, Tuition and Fee Assistance",
                "institution_types": "All Recognized Autonomous Colleges in Tamil Nadu",
                "autonomous_compatibility": "Eligible in all UGC/AICTE-recognized Autonomous Arts & Science and Engineering colleges with AISHE registration.",
                "tn_residency_required": False,
                "community_category": "Minority",
                "income_ceiling": 200000.0,
                "income_criteria_raw": "Annual parental/guardian income not exceeding ₹2,00,000.",
                "award_type": "VARIABLE_ASSISTANCE",
                "award_display": "Actual tuition/admission fee reimbursed up to ₹10,000/yr + monthly maintenance allowance",
                "amount": 18000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=35),
                "application_url": "https://scholarships.gov.in/",
                "source_url": "https://scholarships.gov.in/All-Scholarships",
                "source_name": "National Scholarship Portal (Official)",
                "official_portal_name": "National Scholarship Portal (NSP)",
                "official_guideline_url": "https://scholarships.gov.in/All-Scholarships",
                "academic_year": "2024-2026",
                "source_verification_status": "SOURCE_VERIFIED",
                "application_window_status": "ANNUAL_CYCLE",
                "verification_status": "SOURCE_VERIFIED",
                "eligibility_summary": "Students from notified minority communities (Muslim, Christian, Sikh, Buddhist, Jain, Parsi), Min 50% marks, Family Income <= ₹2.0L.",
                "description": "Central post-matric scheme enabling students from recognized religious minority communities to pursue higher education in autonomous colleges.",
                "application_effort": "Medium (3 hrs on NSP)",
                "status": "ACTIVE",
                "unresolved_questions": "State quota allocation applies; award determined based on state-wise merit list.",
                "rules": [
                    {"rule_type": "CATEGORY", "criteria_value": "Minority,Christian,Muslim,Sikh,Buddhist,Jain,Parsi", "operator": "IN", "description": "Notified minority community member"},
                    {"rule_type": "MIN_12TH_PERCENTAGE", "criteria_value": "50.0", "operator": "GTE", "description": "Minimum 50% marks in previous qualifying examination"},
                    {"rule_type": "MAX_INCOME", "criteria_value": "200000", "operator": "LTE", "description": "Annual family income up to ₹2,00,000"},
                ],
                "requirements": [
                    {"name": "Minority Community Certificate / Self-Declaration", "document_type": "COMMUNITY_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Income Certificate", "document_type": "INCOME_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "College Bonafide Certificate", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Marksheet", "document_type": "MARKSHEET", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "Perarignar Anna Memorial Award",
                "provider": "Adi Dravidar and Tribal Welfare Department, Government of Tamil Nadu",
                "dossier_index": "№ TN-ADW-2025-10",
                "stream": "BOTH",
                "study_level": "UG",
                "category_tag": "Government Scholarships, Tamil Nadu State Schemes, Community/Category-Based, Merit-Based",
                "institution_types": "Autonomous Colleges in Tamil Nadu",
                "autonomous_compatibility": "Eligible in all Autonomous Colleges in Tamil Nadu.",
                "tn_residency_required": True,
                "community_category": "SC,ST,SCA",
                "income_ceiling": None,
                "income_criteria_raw": "No family income ceiling. Awarded strictly on district merit ranking in Class 12.",
                "award_type": "MERIT_GRANT",
                "award_display": "₹5,000–₹9,000/year annual merit prize for entire degree duration",
                "amount": 9000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=55),
                "application_url": "https://tndce.tn.gov.in/Home/scholarship_cms",
                "source_url": "https://tndce.tn.gov.in/Home/scholarship_cms",
                "source_name": "TNDCE Scholarship Guidelines",
                "official_portal_name": "Tamil Nadu Directorate of Collegiate Education / ADW",
                "official_guideline_url": "https://tndce.tn.gov.in/Home/scholarship_cms",
                "academic_year": "2024-2026",
                "source_verification_status": "SOURCE_VERIFIED",
                "application_window_status": "ANNUAL_CYCLE",
                "verification_status": "SOURCE_VERIFIED",
                "eligibility_summary": "TN Domicile, SC/ST/SCA students who secured top ranking in their revenue district in Class 12 exams.",
                "description": "Prestige state merit prize honoring top-scoring SC/ST students from each revenue district in Tamil Nadu who enter higher degree studies.",
                "application_effort": "Low (Nomination based on board results)",
                "status": "ACTIVE",
                "unresolved_questions": "Direct nomination is typically processed through the District Adi Dravidar and Tribal Welfare Officer.",
                "rules": [
                    {"rule_type": "STATE", "criteria_value": "Tamil Nadu", "operator": "EQUALS", "description": "Domicile of Tamil Nadu"},
                    {"rule_type": "CATEGORY", "criteria_value": "SC,ST,SCA", "operator": "IN", "description": "Belongs to SC/ST/SCA"},
                    {"rule_type": "MIN_12TH_PERCENTAGE", "criteria_value": "85.0", "operator": "GTE", "description": "District topper marks standard in 12th board"},
                ],
                "requirements": [
                    {"name": "Class 12 Marksheet", "document_type": "MARKSHEET", "type": "DOCUMENT", "is_required": True},
                    {"name": "Community Certificate", "document_type": "COMMUNITY_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "College Bonafide Certificate", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "TANSCHE Fellowship for Postgraduate Students",
                "provider": "Tamil Nadu State Council for Higher Education (TANSCHE)",
                "dossier_index": "№ TN-CHE-2025-11",
                "stream": "ARTS_SCIENCE",
                "study_level": "PG",
                "category_tag": "Government Scholarships, Tamil Nadu State Schemes, Research and Postgraduate Funding, Merit-Based",
                "institution_types": "Government and Government-Aided Autonomous Arts & Science Colleges",
                "autonomous_compatibility": "Exclusively for students admitted to Government and Government-Aided Autonomous Arts & Science Colleges in Tamil Nadu. Self-financing colleges are not eligible.",
                "tn_residency_required": True,
                "community_category": "ALL",
                "income_ceiling": 300000.0,
                "income_criteria_raw": "Annual parental income not exceeding ₹3,00,000.",
                "award_type": "MERIT_GRANT",
                "award_display": "₹25,000 per annum postgraduate study and research stipend",
                "amount": 25000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=22),
                "application_url": "http://www.tansche.tn.gov.in/",
                "source_url": "https://tndce.tn.gov.in/",
                "source_name": "TANSCHE Official Portal",
                "official_portal_name": "Tamil Nadu State Council for Higher Education (TANSCHE)",
                "official_guideline_url": "http://www.tansche.tn.gov.in/",
                "academic_year": "2024-2026",
                "source_verification_status": "PARTIALLY_VERIFIED",
                "application_window_status": "ANNUAL_CYCLE",
                "verification_status": "PARTIALLY_VERIFIED",
                "eligibility_summary": "TN Domicile, PG Arts & Science in Govt/Aided Autonomous Colleges, Min 60% in UG degree, Family Income <= ₹3.0L.",
                "description": "Competitive state fellowship supporting high-performing postgraduate scholars pursuing M.A. and M.Sc. degrees in autonomous collegiate institutions.",
                "application_effort": "Medium (Requires UG transcripts & department recommendation)",
                "status": "ACTIVE",
                "unresolved_questions": "Departmental quota allocation varies yearly by subject branch.",
                "rules": [
                    {"rule_type": "STATE", "criteria_value": "Tamil Nadu", "operator": "EQUALS", "description": "Domicile of Tamil Nadu"},
                    {"rule_type": "COURSE", "criteria_value": "M.Sc,M.A.,Postgraduate,Master", "operator": "CONTAINS", "description": "Enrolled in Postgraduate Arts & Science degree"},
                    {"rule_type": "MIN_CGPA", "criteria_value": "7.5", "operator": "GTE", "description": "Minimum CGPA of 7.5 (or 60%) in undergraduate degree"},
                    {"rule_type": "MAX_INCOME", "criteria_value": "300000", "operator": "LTE", "description": "Annual family income up to ₹3,00,000"},
                ],
                "requirements": [
                    {"name": "Undergraduate Degree Certificate & Consolidated Marksheet", "document_type": "DEGREE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Income Certificate", "document_type": "INCOME_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "College Bonafide Certificate", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                ]
            }
        ]

    seeded_count = 0
    synced_count = 0

    for s_item in verified_scholarships_data:
        s_data = dict(s_item)
        rules_data = s_data.pop("rules", [])
        reqs_data = s_data.pop("requirements", [])
        dossier_idx = s_data.get("dossier_index")

        # Normalize residency flag to safe string representation for PostgreSQL VARCHAR column
        if "tn_residency_required" in s_data:
            s_data["tn_residency_required"] = "YES" if s_data["tn_residency_required"] in [True, "YES", "yes", "1", 1] else "NO"

        # Idempotent match by unique dossier_index or official scheme name
        existing = None
        if dossier_idx:
            existing = db.query(Scholarship).filter(Scholarship.dossier_index == dossier_idx).first()
        if not existing:
            existing = db.query(Scholarship).filter(Scholarship.name == s_data["name"]).first()

        if existing:
            # Synchronize verified fields on existing record without overwriting primary keys or foreign keys
            updated = False
            for key, val in s_data.items():
                if getattr(existing, key, None) != val:
                    setattr(existing, key, val)
                    updated = True
            if updated:
                synced_count += 1
            continue

        # Create new verified scholarship record
        scholarship = Scholarship(**s_data)
        db.add(scholarship)
        db.flush()

        for r in rules_data:
            db.add(EligibilityRule(scholarship_id=scholarship.id, **r))
        for req in reqs_data:
            db.add(ScholarshipRequirement(scholarship_id=scholarship.id, **req))
        seeded_count += 1

    db.commit()
    logger.info(
        f"Verified scholarship catalogue synchronization complete: "
        f"{seeded_count} newly seeded, {synced_count} synchronized."
    )

    # 3. Seed Verified Documents for Arjun Kumar
    if student and db.query(Document).filter(Document.student_id == student.id).count() == 0:
        logger.info("Seeding documents for Arjun Kumar (Tamil Nadu Autonomous College context)...")
        # Income Certificate is intentionally MISSING (the genuine shared blocker)
        student_documents = [
            Document(
                student_id=student.id,
                name="Income Certificate (Tahsildar / E-Sevai)",
                document_type="INCOME_CERTIFICATE",
                status="MISSING",
                notes="Official Tamil Nadu Revenue Department income certificate showing annual family income <= ₹2,50,000. Shared blocker across 3 active applications."
            ),
            Document(
                student_id=student.id,
                name="Permanent Community Certificate (BC)",
                document_type="COMMUNITY_CERTIFICATE",
                status="AVAILABLE",
                uploaded_at=datetime.now(timezone.utc) - timedelta(days=15),
                notes="Issued by Zonal Deputy Tahsildar, Revenue Department, Tamil Nadu confirming Backward Classes status."
            ),
            Document(
                student_id=student.id,
                name="Institutional Bonafide Certificate",
                document_type="BONAFIDE_CERTIFICATE",
                status="AVAILABLE",
                uploaded_at=datetime.now(timezone.utc) - timedelta(days=10),
                notes="Issued by Registrar, Loyola College (Autonomous), Chennai confirming 2nd Year B.Sc Computer Science enrollment."
            ),
            Document(
                student_id=student.id,
                name="Current Semester Marksheet (Semester III)",
                document_type="MARKSHEET",
                status="AVAILABLE",
                uploaded_at=datetime.now(timezone.utc) - timedelta(days=12),
                notes="Authenticated autonomous college semester transcript showing 8.4 CGPA."
            ),
            Document(
                student_id=student.id,
                name="Aadhaar Card / TN Nativity Proof",
                document_type="ID_PROOF",
                status="AVAILABLE",
                uploaded_at=datetime.now(timezone.utc) - timedelta(days=14),
                notes="UIDAI Aadhaar Card with verified Tamil Nadu residential address."
            ),
            Document(
                student_id=student.id,
                name="Academic Statement of Purpose",
                document_type="STATEMENT_OF_PURPOSE",
                status="AVAILABLE",
                uploaded_at=datetime.now(timezone.utc) - timedelta(days=5),
                notes="Personal academic motivation statement focusing on computing studies and higher-education goals."
            )
        ]
        db.add_all(student_documents)
        db.commit()
        logger.info("Student documents seeded successfully.")

    # 4. Seed 3 Active Applications for Arjun Kumar (All 3 require Income Certificate -> Shared Blocker!)
    if student and db.query(Application).filter(Application.student_id == student.id).count() == 0:
        logger.info("Seeding 3 active applications for Arjun Kumar...")
        app_scholarships = [
            "Post-Matric Scholarship for BC, MBC & DNC Students",
            "Central Sector Scheme of Scholarship for College and University Students (PM-USP CSSS)",
            "Free Education Scheme for 3-Year Degree Students (BC/MBC/DNC)"
        ]

        # Retrieve documents for linking
        docs_by_type = {
            doc.document_type: doc
            for doc in db.query(Document).filter(Document.student_id == student.id).all()
        }

        for s_name in app_scholarships:
            scholarship = db.query(Scholarship).filter(Scholarship.name == s_name).first()
            if scholarship:
                app_obj = Application(
                    student_id=student.id,
                    scholarship_id=scholarship.id,
                    status="IN_PROGRESS",
                    status_reason="Required documents are still missing or pending checks (Income Certificate).",
                    status_history=[{
                        "previous_status": "NOT_STARTED",
                        "new_status": "IN_PROGRESS",
                        "timestamp": (datetime.now(timezone.utc) - timedelta(days=6)).isoformat(),
                        "actor": "system",
                        "reason": "Application started by student. Missing Income Certificate.",
                    }],
                    progress=75.0 if s_name != "Free Education Scheme for 3-Year Degree Students (BC/MBC/DNC)" else 66.7,
                    personal_statement="I am a second-year B.Sc Computer Science student at Loyola College (Autonomous), Chennai. I require financial assistance to meet tuition fees and laboratory materials.",
                    started_at=datetime.now(timezone.utc) - timedelta(days=6)
                )
                db.add(app_obj)
                db.flush()

                # Add application requirements
                for req in scholarship.requirements:
                    matched_doc = docs_by_type.get(req.document_type)
                    req_status = matched_doc.status if matched_doc else "MISSING"
                    doc_id = matched_doc.id if matched_doc else None

                    app_req = ApplicationRequirement(
                        application_id=app_obj.id,
                        name=req.name,
                        document_type=req.document_type,
                        type=req.type,
                        is_required=req.is_required,
                        status=req_status,
                        document_id=doc_id
                    )
                    db.add(app_req)

        db.commit()
        logger.info("3 active applications seeded.")

    # 5. Seed PlannerGoal for Arjun Kumar
    if student and not db.query(PlannerGoal).filter(PlannerGoal.student_id == student.id).first():
        logger.info("Seeding initial PlannerGoal for Arjun Kumar...")
        goal = PlannerGoal(
            student_id=student.id,
            target_funding=52000.0,
            purpose="Tuition, Examination Fees & Computing Lab Equipment",
            timeline="Academic Year 2025-2026",
            available_hours_per_week=5.0,
            priorities="Government Post-Matric & State Collegiate Schemes"
        )
        db.add(goal)
        db.commit()
        logger.info("PlannerGoal seeded successfully.")

    # 6. Seed initial Next-Best-Actions
    if student and db.query(Action).filter(Action.student_id == student.id).count() == 0:
        logger.info("Seeding initial next-best-actions...")
        bc_scholarship = db.query(Scholarship).filter(Scholarship.name == "Post-Matric Scholarship for BC, MBC & DNC Students").first()
        bc_app = db.query(Application).filter(Application.scholarship_id == bc_scholarship.id).first() if bc_scholarship else None

        initial_actions = [
            Action(
                student_id=student.id,
                application_id=bc_app.id if bc_app else None,
                title="Obtain Income Certificate from E-Sevai (Shared Blocker)",
                reason="Required by 3 active applications (BC/MBC Post-Matric, PM-USP Central Sector, and Free Education Scheme).",
                urgency="URGENT",
                deadline=datetime.now(timezone.utc) + timedelta(days=7),
                effort_estimate="1-2 hours via E-Sevai / Tahsildar",
                potential_funding_impact=52000.0,
                blocker_impact="Blocks 3 active higher-education applications",
                action_type="DOCUMENT",
                is_completed=False
            ),
            Action(
                student_id=student.id,
                application_id=bc_app.id if bc_app else None,
                title="Review & Finalize BC/MBC Post-Matric Application on TN SSP",
                reason="Upcoming cycle window approaching. Application is 75% complete awaiting Income Certificate.",
                urgency="HIGH",
                deadline=datetime.now(timezone.utc) + timedelta(days=15),
                effort_estimate="1 hour",
                potential_funding_impact=25000.0,
                blocker_impact="Ready to submit once Income Certificate is uploaded",
                action_type="APPLICATION",
                is_completed=False
            )
        ]
        db.add_all(initial_actions)
        db.commit()
        logger.info("Initial next-best-actions seeded.")

    # 7. Seed Demo User Account for Arjun Kumar
    if student and not db.query(User).filter(User.student_id == student.id).first():
        logger.info("Seeding demo user account (demo@scholarai.local)...")
        pwd_hash, salt = hash_password(settings.DEMO_USER_PASSWORD)
        demo_user = User(
            email=settings.DEMO_USER_EMAIL,
            password_hash=pwd_hash,
            salt=salt,
            student_id=student.id,
            is_active=True,
            is_demo=True
        )
        db.add(demo_user)
        db.commit()
        logger.info("Demo user account seeded successfully.")

    # 8. Seed Evidence Bank for Arjun Kumar
    if student and db.query(Evidence).filter(Evidence.student_id == student.id).count() == 0:
        logger.info("Seeding initial Evidence Bank items for Arjun Kumar...")
        marksheet_doc = db.query(Document).filter(Document.student_id == student.id, Document.document_type == "MARKSHEET").first()
        demo_evidence = [
            Evidence(
                student_id=student.id,
                title="Academic Merit: 8.4 CGPA in B.Sc Computer Science",
                category="ACADEMIC",
                description="Completed 3 semesters with distinction at Loyola College (Autonomous), Chennai, demonstrating high competence in algorithms and systems.",
                date="2025-2026",
                organization="Loyola College (Autonomous), Chennai",
                evidence_text="Authenticated college semester marksheet confirming cumulative 8.4 CGPA.",
                source_document_id=marksheet_doc.id if marksheet_doc else None,
                source_type="STUDENT_PROFILE",
                source_name="Semester III Marksheet",
                verification_status="VERIFIED",
                confidence="HIGH_EVIDENCE_SUPPORT",
                used_in_applications="Post-Matric Scholarship for BC, MBC & DNC Students"
            ),
            Evidence(
                student_id=student.id,
                title="Class 12 Higher Secondary Academic Excellence (89.2%)",
                category="ACADEMIC",
                description="Secured 89.2% in Tamil Nadu Higher Secondary Examinations with distinction in Mathematics and Computer Science.",
                date="2024",
                organization="Tamil Nadu State Board of Higher Secondary Education",
                evidence_text="State board examination certificate establishing top 20th percentile standing.",
                source_type="STUDENT_PROFILE",
                source_name="HSE Marksheet",
                verification_status="VERIFIED",
                confidence="HIGH_EVIDENCE_SUPPORT",
                used_in_applications="PM-USP Central Sector Scheme of Scholarship"
            ),
            Evidence(
                student_id=student.id,
                title="Autonomous College Technical Project: Student Funding Intelligence",
                category="PROJECT",
                description="Engineered full-stack intelligence platform evaluating deterministic scholarship eligibility for autonomous college students across Tamil Nadu.",
                date="2026",
                organization="Technical Project Portfolio",
                evidence_text="TypeScript, React, FastAPI application repository implementing transparent rule evaluation and document verification.",
                source_type="USER_PROVIDED",
                source_name="Student Project Repository",
                verification_status="USER_PROVIDED",
                confidence="HIGH_EVIDENCE_SUPPORT",
                used_in_applications="Student Portfolio"
            )
        ]
        db.add_all(demo_evidence)
        db.commit()
        logger.info("Initial Evidence Bank items seeded.")

    # 9. Seed Knowledge Sources & RAG Chunks (Genuine Official TN Sources)
    if db.query(KnowledgeSource).count() == 0:
        logger.info("Seeding verified knowledge sources and official guidelines...")
        now = datetime.now(timezone.utc)

        bc_s = db.query(Scholarship).filter(Scholarship.name == "Post-Matric Scholarship for BC, MBC & DNC Students").first()
        css_s = db.query(Scholarship).filter(Scholarship.name.ilike("%Central Sector Scheme%")).first()

        sources_data = [
            {
                "name": "Tamil Nadu BC, MBC & MW Department Welfare Guidelines",
                "source_url": "https://bcmbcmw.tn.gov.in/welfschemes.htm",
                "source_type": "TN_STATE_PORTAL",
                "authority_level": "STATUTORY_STATE",
                "verification_status": "SOURCE_VERIFIED",
                "last_verified_at": now - timedelta(days=1),
                "monitoring_status": "ACTIVE",
                "last_checked": now,
                "change_severity": "INFO",
                "docs": [
                    {
                        "title": "Post-Matric Scholarship for BC/MBC/DNC Students Official Guidelines",
                        "scholarship_id": bc_s.id if bc_s else None,
                        "content": (
                            "The Government of Tamil Nadu provides Post-Matric Scholarships to students belonging to "
                            "Backward Classes, Most Backward Classes, and Denotified Communities studying in recognized "
                            "higher education institutions including Autonomous Colleges. For BC students, the annual parental "
                            "income limit is ₹2,50,000. In Government and Government-Aided Autonomous colleges, approved tuition "
                            "and special fees are reimbursed. For Self-Financing autonomous institutions, assistance is limited "
                            "to students admitted under the Government Single Window Quota (TNEA / Collegiate counselling).\n\n"
                            "Mandatory Documents: Current Fiscal Year Income Certificate issued by Revenue Tahsildar through "
                            "e-Sevai, Permanent Community Certificate, Institutional Bonafide Certificate, and current semester marksheet. "
                            "Applications must be registered through the Tamil Nadu State Scholarship Portal (SSP)."
                        ),
                        "section": "BC/MBC Post-Matric Scheme Overview & Eligibility"
                    }
                ]
            },
            {
                "name": "National Scholarship Portal Official Guidelines (PM-USP CSSS)",
                "source_url": "https://scholarships.gov.in/All-Scholarships",
                "source_type": "CENTRAL_PORTAL",
                "authority_level": "STATUTORY_CENTRAL",
                "verification_status": "SOURCE_VERIFIED",
                "last_verified_at": now - timedelta(days=3),
                "monitoring_status": "ACTIVE",
                "last_checked": now,
                "change_severity": "INFO",
                "docs": [
                    {
                        "title": "Central Sector Scheme of Scholarship for College and University Students",
                        "scholarship_id": css_s.id if css_s else None,
                        "content": (
                            "The Central Sector Scheme of Scholarship (PM-USP CSSS) provides financial assistance to "
                            "meritorious students belonging to low-income families pursuing regular degree courses in recognized "
                            "autonomous colleges and universities. Applicants must have secured above the 80th percentile in the "
                            "relevant stream (Science/Commerce/Humanities) in Class 12 Higher Secondary Examinations. "
                            "The parental income ceiling is ₹4,50,000 per annum from all sources.\n\n"
                            "Award Amount: ₹12,000 per annum for the first 3 years of undergraduate study and ₹20,000 per annum "
                            "for the 4th year (Engineering) or postgraduate studies. Applications are submitted online exclusively "
                            "through the National Scholarship Portal (scholarships.gov.in) with Aadhaar-based authentication."
                        ),
                        "section": "CSSS Central Guidelines & Percentile Criteria"
                    }
                ]
            }
        ]

        for s_info in sources_data:
            docs_info = s_info.pop("docs")
            ks = KnowledgeSource(**s_info)
            db.add(ks)
            db.flush()

            for d_info in docs_info:
                content = d_info["content"]
                c_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
                kd = KnowledgeDocument(
                    source_id=ks.id,
                    scholarship_id=d_info.get("scholarship_id"),
                    title=d_info["title"],
                    content=content,
                    document_url=ks.source_url,
                    content_hash=c_hash,
                    retrieved_at=now,
                    last_verified_at=now,
                    verification_status="SOURCE_VERIFIED"
                )
                db.add(kd)
                db.flush()

                # Ingest chunks
                paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
                for idx, p in enumerate(paragraphs):
                    chunk = KnowledgeChunk(
                        document_id=kd.id,
                        chunk_text=p,
                        section=f"{d_info['section']} (Part {idx + 1})" if len(paragraphs) > 1 else d_info["section"],
                        source_url=ks.source_url,
                        metadata_json=f'{{"source_id": {ks.id}, "part": {idx + 1}}}'
                    )
                    db.add(chunk)

        db.commit()
        logger.info("Verified knowledge sources and RAG chunks seeded.")

    # 10. Seed Initial Notifications for Arjun Kumar
    if student and db.query(Notification).filter(Notification.student_id == student.id).count() == 0:
        logger.info("Seeding initial notifications...")
        bc_scholarship = db.query(Scholarship).filter(Scholarship.name == "Post-Matric Scholarship for BC, MBC & DNC Students").first()
        bc_app = db.query(Application).filter(Application.scholarship_id == bc_scholarship.id).first() if bc_scholarship else None

        initial_notifs = [
            Notification(
                student_id=student.id,
                type="DOCUMENT",
                title="Shared Blocker Identified: Income Certificate",
                message="Your Income Certificate is marked as Missing. This single document is required across 3 active applications totaling ₹52,000 in potential funding.",
                severity="HIGH",
                read=False
            ),
            Notification(
                student_id=student.id,
                type="DEADLINE",
                title="Upcoming Application Cycle: Post-Matric BC/MBC Scholarship",
                message="Review your application requirements on the Tamil Nadu State Scholarship Portal before the deadline.",
                severity="MEDIUM",
                related_scholarship_id=bc_scholarship.id if bc_scholarship else None,
                related_application_id=bc_app.id if bc_app else None,
                read=False
            ),
            Notification(
                student_id=student.id,
                type="SYSTEM",
                title="Tamil Nadu Scholarship Intelligence Active",
                message="Curated intelligence for Autonomous Colleges in Tamil Nadu is active. All criteria are mapped to official government guidelines.",
                severity="INFO",
                read=True
            )
        ]
        db.add_all(initial_notifs)
        db.commit()
        logger.info("Initial notifications seeded.")
