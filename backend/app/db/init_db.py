import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.base import Base
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.funding_profile import FundingProfile
from app.models.scholarship import Scholarship
from app.models.eligibility_rule import EligibilityRule
from app.models.scholarship_requirement import ScholarshipRequirement
from app.models.document import Document
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.models.action import Action
from app.models.planner import PlannerGoal

logger = logging.getLogger(__name__)

DEMO_STUDENT_EMAIL = "arjun.kumar@demo.edu"


def init_db(db: Session) -> None:
    """
    Initialize tables and seed demo student, scholarships, documents,
    applications, and planner data safely and idempotently.
    """
    bind = db.get_bind()
    Base.metadata.create_all(bind=bind)

    # SQLite migration helper: ensure 'gender' column exists in student_profiles
    try:
        db.execute(text("ALTER TABLE student_profiles ADD COLUMN gender VARCHAR(50) DEFAULT 'Male'"))
        db.commit()
    except Exception:
        db.rollback()

    # 1. Check/Seed Demo Student
    student = db.query(Student).filter(Student.email == DEMO_STUDENT_EMAIL).first()
    if not student:
        logger.info("Seeding demo student: Arjun Kumar")
        student = Student(
            name="Arjun Kumar",
            email=DEMO_STUDENT_EMAIL,
            phone="+91 98765 43210",
        )
        db.add(student)
        db.flush()

        profile = StudentProfile(
            student_id=student.id,
            institution="Demo Engineering College",
            course="B.Tech Computer Science",
            year="2nd Year",
            cgpa=8.4,
            twelfth_percentage=89.2,
            category="OBC",
            state="Karnataka",
            gender="Male",
        )
        db.add(profile)

        funding = FundingProfile(
            student_id=student.id,
            annual_education_cost=120000.0,
            existing_support=60000.0,
            annual_family_income=240000.0,
        )
        db.add(funding)
        db.commit()
        db.refresh(student)
        logger.info("Demo student seeded successfully.")

    # 2. Check/Seed Demo Scholarships (at least 8)
    if db.query(Scholarship).count() == 0:
        logger.info("Seeding 8 demo scholarships...")
        now = datetime.now(timezone.utc)

        demo_scholarships_data = [
            {
                "name": "National Merit-cum-Means Scholarship",
                "provider": "Ministry of Education (Demo)",
                "description": "Central scholarship supporting academically proficient students from economically weaker sections enrolled in technical and professional courses.",
                "amount": 50000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=18),
                "application_url": "#demo-apply-nmm",
                "source_url": "#demo-source-nmm",
                "source_name": "National Scholarship Portal (Demo Entry)",
                "verification_status": "DEMO_DATA",
                "eligibility_summary": "Min CGPA 7.0, Annual Family Income <= ₹2.5L, 12th percentage >= 75%",
                "application_effort": "Medium (3-5 hrs)",
                "status": "ACTIVE",
                "rules": [
                    {"rule_type": "MIN_CGPA", "criteria_value": "7.0", "operator": "GTE", "description": "Minimum CGPA of 7.0"},
                    {"rule_type": "MAX_INCOME", "criteria_value": "250000", "operator": "LTE", "description": "Annual family income up to ₹2,50,000"},
                    {"rule_type": "MIN_12TH_PERCENTAGE", "criteria_value": "75.0", "operator": "GTE", "description": "Minimum 75% in 12th standard"},
                ],
                "requirements": [
                    {"name": "Income Certificate", "document_type": "INCOME_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Current Marksheet", "document_type": "MARKSHEET", "type": "DOCUMENT", "is_required": True},
                    {"name": "Bonafide Certificate", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "NextGen Technology Grant",
                "provider": "Future Tech Foundation (Demo)",
                "description": "Industry-supported merit grant targeting undergraduate engineering students innovating in computer science and data disciplines.",
                "amount": 40000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=44),
                "application_url": "#demo-apply-nextgen",
                "source_url": "#demo-source-nextgen",
                "source_name": "Tech Foundation Portal (Demo Entry)",
                "verification_status": "DEMO_DATA",
                "eligibility_summary": "B.Tech/BE Computer Science, IT or related fields, Min CGPA 8.0",
                "application_effort": "Low (2-3 hrs)",
                "status": "ACTIVE",
                "rules": [
                    {"rule_type": "COURSE", "criteria_value": "Computer Science", "operator": "CONTAINS", "description": "Enrolled in Computer Science or allied technical branch"},
                    {"rule_type": "MIN_CGPA", "criteria_value": "8.0", "operator": "GTE", "description": "Minimum CGPA of 8.0"},
                ],
                "requirements": [
                    {"name": "Current Marksheet", "document_type": "MARKSHEET", "type": "DOCUMENT", "is_required": True},
                    {"name": "Statement of Purpose Draft", "document_type": "STATEMENT_OF_PURPOSE", "type": "ESSAY", "is_required": True},
                    {"name": "Aadhaar Card / ID Proof", "document_type": "ID_PROOF", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "State Welfare Fellowship",
                "provider": "Karnataka Higher Education Council (Demo)",
                "description": "State post-matric financial assistance fellowship for OBC/SC/ST domicile students pursuing technical degrees.",
                "amount": 25000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=29),
                "application_url": "#demo-apply-swf",
                "source_url": "#demo-source-swf",
                "source_name": "Karnataka State Scholarship Portal (Demo Entry)",
                "verification_status": "DEMO_DATA",
                "eligibility_summary": "Karnataka domicile, OBC/SC/ST category, Annual Family Income <= ₹3.0L",
                "application_effort": "Low (2 hrs)",
                "status": "ACTIVE",
                "rules": [
                    {"rule_type": "STATE", "criteria_value": "Karnataka", "operator": "EQUALS", "description": "Domicile of Karnataka state"},
                    {"rule_type": "CATEGORY", "criteria_value": "OBC,SC,ST", "operator": "IN", "description": "Belongs to OBC, SC, or ST category"},
                    {"rule_type": "MAX_INCOME", "criteria_value": "300000", "operator": "LTE", "description": "Annual family income up to ₹3,00,000"},
                ],
                "requirements": [
                    {"name": "Income Certificate", "document_type": "INCOME_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Aadhaar Card / ID Proof", "document_type": "ID_PROOF", "type": "DOCUMENT", "is_required": True},
                    {"name": "Current Marksheet", "document_type": "MARKSHEET", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "PG Excellence Fellowship",
                "provider": "National Research Council (Demo)",
                "description": "Competitive research fellowship exclusively for postgraduate and doctoral scholars conducting high-impact advanced research.",
                "amount": 80000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=23),
                "application_url": "#demo-apply-pg",
                "source_url": "#demo-source-pg",
                "source_name": "Research Council Portal (Demo Entry)",
                "verification_status": "DEMO_DATA",
                "eligibility_summary": "Strictly restricted to Postgraduate (M.Tech/M.Sc/Ph.D) students with CGPA >= 8.5",
                "application_effort": "High (8-10 hrs)",
                "status": "ACTIVE",
                "rules": [
                    {"rule_type": "COURSE", "criteria_value": "Postgraduate", "operator": "CONTAINS", "description": "Must be enrolled in a Postgraduate or Master's program"},
                    {"rule_type": "MIN_CGPA", "criteria_value": "8.5", "operator": "GTE", "description": "Minimum CGPA of 8.5"},
                ],
                "requirements": [
                    {"name": "UG Degree Certificate", "document_type": "DEGREE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Research Proposal", "document_type": "STATEMENT_OF_PURPOSE", "type": "ESSAY", "is_required": True},
                ]
            },
            {
                "name": "CSR STEM Bursary",
                "provider": "TechCorp Global CSR (Demo)",
                "description": "Urgent industry bursary designed to close immediate tuition gaps for students in technical STEM degree programs.",
                "amount": 60000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=4),  # Deadline-urgent in demo!
                "application_url": "#demo-apply-stem",
                "source_url": "#demo-source-stem",
                "source_name": "TechCorp CSR Portal (Demo Entry)",
                "verification_status": "DEMO_DATA",
                "eligibility_summary": "STEM degree students, Min CGPA 7.5, Annual Family Income <= ₹3.5L. Urgent submission deadline!",
                "application_effort": "Medium (3 hrs)",
                "status": "ACTIVE",
                "rules": [
                    {"rule_type": "COURSE", "criteria_value": "Computer Science,Engineering,B.Tech", "operator": "IN", "description": "Enrolled in an eligible STEM undergraduate program"},
                    {"rule_type": "MIN_CGPA", "criteria_value": "7.5", "operator": "GTE", "description": "Minimum CGPA of 7.5"},
                    {"rule_type": "MAX_INCOME", "criteria_value": "350000", "operator": "LTE", "description": "Annual family income up to ₹3,50,000"},
                ],
                "requirements": [
                    {"name": "Income Certificate", "document_type": "INCOME_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Current Marksheet", "document_type": "MARKSHEET", "type": "DOCUMENT", "is_required": True},
                    {"name": "Bonafide Certificate", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "Regional Student Stipend",
                "provider": "Southern Regional Board (Demo)",
                "description": "Zonal assistance grant for higher education students requiring verification of local municipal ward certification.",
                "amount": 35000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=74),
                "application_url": "#demo-apply-rss",
                "source_url": "#demo-source-rss",
                "source_name": "Regional Directorate (Demo Entry)",
                "verification_status": "NEEDS_VERIFICATION",
                "eligibility_summary": "Southern region domicile. Official municipal ward verification certificate required.",
                "application_effort": "Low (2 hrs)",
                "status": "ACTIVE",
                "rules": [
                    {"rule_type": "STATE", "criteria_value": "Karnataka", "operator": "EQUALS", "description": "Resident of Karnataka"},
                    {"rule_type": "CATEGORY", "criteria_value": "Needs Verification", "operator": "EQUALS", "description": "Requires official regional municipal ward verification"},
                ],
                "requirements": [
                    {"name": "Income Certificate", "document_type": "INCOME_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Local Domicile Endorsement", "document_type": "ID_PROOF", "type": "DOCUMENT", "is_required": True},
                ]
            },
            {
                "name": "Empower Future Scholarship",
                "provider": "Empower Youth Trust (Demo)",
                "description": "Holistic scholarship focusing on undergraduate students demonstrating sustained academic performance and community involvement.",
                "amount": 30000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=59),
                "application_url": "#demo-apply-efs",
                "source_url": "#demo-source-efs",
                "source_name": "Youth Trust Website (Demo Entry)",
                "verification_status": "DEMO_DATA",
                "eligibility_summary": "Undergraduate 1st to 3rd year, Min CGPA 6.5, Annual Family Income <= ₹4.0L",
                "application_effort": "Medium (4 hrs)",
                "status": "ACTIVE",
                "rules": [
                    {"rule_type": "MIN_CGPA", "criteria_value": "6.5", "operator": "GTE", "description": "Minimum CGPA of 6.5"},
                    {"rule_type": "MAX_INCOME", "criteria_value": "400000", "operator": "LTE", "description": "Annual family income up to ₹4,00,000"},
                    {"rule_type": "YEAR", "criteria_value": "2nd Year", "operator": "EQUALS", "description": "Open to 2nd year undergraduates"},
                ],
                "requirements": [
                    {"name": "Current Marksheet", "document_type": "MARKSHEET", "type": "DOCUMENT", "is_required": True},
                    {"name": "Bonafide Certificate", "document_type": "BONAFIDE_CERTIFICATE", "type": "DOCUMENT", "is_required": True},
                    {"name": "Statement of Purpose Draft", "document_type": "STATEMENT_OF_PURPOSE", "type": "ESSAY", "is_required": True},
                ]
            },
            {
                "name": "Women in Technology Scholarship",
                "provider": "Anita Borg Women in Tech Initiative (Demo)",
                "description": "Targeted diversity scholarship strictly dedicated to empowering female undergraduate scholars in computer science and engineering.",
                "amount": 75000.0,
                "currency": "INR",
                "deadline": now + timedelta(days=39),
                "application_url": "#demo-apply-wit",
                "source_url": "#demo-source-wit",
                "source_name": "Women Tech Portal (Demo Entry)",
                "verification_status": "DEMO_DATA",
                "eligibility_summary": "Female students enrolled in Computer Science / Engineering degrees with CGPA >= 8.0",
                "application_effort": "High (6 hrs)",
                "status": "ACTIVE",
                "rules": [
                    {"rule_type": "GENDER", "criteria_value": "Female", "operator": "EQUALS", "description": "Strictly restricted to female students"},
                    {"rule_type": "COURSE", "criteria_value": "Computer Science", "operator": "CONTAINS", "description": "Enrolled in Computer Science or software engineering"},
                    {"rule_type": "MIN_CGPA", "criteria_value": "8.0", "operator": "GTE", "description": "Minimum CGPA of 8.0"},
                ],
                "requirements": [
                    {"name": "Current Marksheet", "document_type": "MARKSHEET", "type": "DOCUMENT", "is_required": True},
                    {"name": "Statement of Purpose Draft", "document_type": "STATEMENT_OF_PURPOSE", "type": "ESSAY", "is_required": True},
                ]
            }
        ]

        for s_data in demo_scholarships_data:
            rules_data = s_data.pop("rules")
            reqs_data = s_data.pop("requirements")

            scholarship = Scholarship(**s_data)
            db.add(scholarship)
            db.flush()

            for r in rules_data:
                db.add(EligibilityRule(scholarship_id=scholarship.id, **r))
            for req in reqs_data:
                db.add(ScholarshipRequirement(scholarship_id=scholarship.id, **req))

        db.commit()
        logger.info("8 demo scholarships seeded successfully.")

    # 3. Seed Demo Documents for Arjun Kumar
    if student and db.query(Document).filter(Document.student_id == student.id).count() == 0:
        logger.info("Seeding demo documents for Arjun Kumar...")
        # Note: Income Certificate starts as MISSING (the intentional shared blocker!)
        demo_documents = [
            Document(
                student_id=student.id,
                name="Income Certificate (Tehsildar Issued)",
                document_type="INCOME_CERTIFICATE",
                status="MISSING",
                notes="Official government income certificate for current fiscal year."
            ),
            Document(
                student_id=student.id,
                name="Current Marksheet (Semester III)",
                document_type="MARKSHEET",
                status="AVAILABLE",
                uploaded_at=datetime.now(timezone.utc) - timedelta(days=12),
                notes="Authenticated university semester marksheet showing 8.4 CGPA."
            ),
            Document(
                student_id=student.id,
                name="Bonafide Student Certificate",
                document_type="BONAFIDE_CERTIFICATE",
                status="AVAILABLE",
                uploaded_at=datetime.now(timezone.utc) - timedelta(days=10),
                notes="Issued by Registrar, Demo Engineering College."
            ),
            Document(
                student_id=student.id,
                name="Aadhaar Card / Domicile Proof",
                document_type="ID_PROOF",
                status="AVAILABLE",
                uploaded_at=datetime.now(timezone.utc) - timedelta(days=14),
                notes="UIDAI Aadhaar Card with Karnataka residential address."
            ),
            Document(
                student_id=student.id,
                name="Statement of Purpose (Draft)",
                document_type="STATEMENT_OF_PURPOSE",
                status="AVAILABLE",
                uploaded_at=datetime.now(timezone.utc) - timedelta(days=5),
                notes="Personal motivation essay focusing on computer science career."
            )
        ]
        db.add_all(demo_documents)
        db.commit()
        logger.info("Demo documents seeded successfully.")

    # 4. Seed 3 Active Demo Applications for Arjun Kumar (All 3 require Income Certificate -> Shared Blocker!)
    if student and db.query(Application).filter(Application.student_id == student.id).count() == 0:
        logger.info("Seeding 3 active demo applications for Arjun Kumar...")
        app_scholarships = [
            "National Merit-cum-Means Scholarship",
            "CSR STEM Bursary",
            "State Welfare Fellowship"
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
                    progress=66.7,  # 2 of 3 requirements available, 1 missing (Income Certificate)
                    personal_statement="I am pursuing B.Tech in Computer Science and require financial assistance to meet tuition fees and research lab expenses.",
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
        logger.info("3 active demo applications seeded.")

    # 5. Seed PlannerGoal for Arjun Kumar
    if student and not db.query(PlannerGoal).filter(PlannerGoal.student_id == student.id).first():
        logger.info("Seeding initial PlannerGoal for Arjun Kumar...")
        goal = PlannerGoal(
            student_id=student.id,
            target_funding=60000.0,
            purpose="Tuition & Academic Lab Equipment",
            timeline="Current Academic Year (2026-2027)",
            available_hours_per_week=5.0,
            priorities="High-impact & Deadline-urgent"
        )
        db.add(goal)
        db.commit()
        logger.info("PlannerGoal seeded successfully.")

    # 6. Seed initial Actions
    if student and db.query(Action).filter(Action.student_id == student.id).count() == 0:
        logger.info("Seeding initial next-best-actions...")
        csr_bursary = db.query(Scholarship).filter(Scholarship.name == "CSR STEM Bursary").first()
        csr_app = db.query(Application).filter(Application.scholarship_id == csr_bursary.id).first() if csr_bursary else None

        initial_actions = [
            Action(
                student_id=student.id,
                application_id=csr_app.id if csr_app else None,
                title="Provide Income Certificate (Shared Blocker)",
                reason="Required by 3 active applications (CSR STEM Bursary, National Merit-cum-Means, and State Welfare Fellowship).",
                urgency="URGENT",
                deadline=datetime.now(timezone.utc) + timedelta(days=4),
                effort_estimate="1-2 hours",
                potential_funding_impact=135000.0,
                blocker_impact="Blocks 3 active applications",
                action_type="DOCUMENT",
                is_completed=False
            ),
            Action(
                student_id=student.id,
                application_id=csr_app.id if csr_app else None,
                title="Review & Finalize CSR STEM Bursary Application",
                reason="Submission deadline is approaching in 4 days. Application is 67% complete.",
                urgency="HIGH",
                deadline=datetime.now(timezone.utc) + timedelta(days=4),
                effort_estimate="1 hour",
                potential_funding_impact=60000.0,
                blocker_impact="Ready to submit once Income Certificate is provided",
                action_type="APPLICATION",
                is_completed=False
            )
        ]
        db.add_all(initial_actions)
        db.commit()
        logger.info("Initial next-best-actions seeded.")
