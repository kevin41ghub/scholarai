"""
Tests for Guided Official Portal Form Filling Copilot
Validates:
1. Statutory portal detection for NSP, TN_SSP, Pudhumai Penn, TNEA, TNDCE, and unsupported schemes.
2. Verified section-by-section and field-by-field mapping generation.
3. 1-click clipboard helpers (grouped text and individual field copy values).
4. Portal launch endpoint POST /applications/{id}/assistant/launch-portal.
5. Status transition to SUBMISSION_IN_PROGRESS and audit history logging.
6. Student-to-student data isolation and authorization.
7. Absence of fake fallback values in all mapped sections.
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.scholarship import Scholarship
from app.models.application import Application
from app.core.security import create_session_token, hash_password
from app.services.portal_mapping_service import portal_mapping_service


def test_portal_type_detection():
    """Validates accurate classification of supported official portals."""
    # 1. NSP
    s_nsp = Scholarship(
        name="Post Matric Scholarship for Minorities",
        provider="Ministry of Minority Affairs",
        description="Statutory minority scheme.",
        application_url="https://scholarships.gov.in/fresh/newRegistration",
        deadline=datetime.now(timezone.utc) + timedelta(days=30),
        amount=10000,
    )
    assert portal_mapping_service.detect_portal_type(s_nsp) == "NSP"

    # 2. TN SSP
    s_tn_ssp = Scholarship(
        name="TN Post Matric Scholarship Scheme",
        provider="Tamil Nadu Adi Dravidar and Tribal Welfare",
        description="State welfare scheme.",
        application_url="https://sspdept.tnega.org/ssp/",
        deadline=datetime.now(timezone.utc) + timedelta(days=30),
        amount=15000,
    )
    assert portal_mapping_service.detect_portal_type(s_tn_ssp) == "TN_SSP"

    # 3. Pudhumai Penn / Tamil Pudhalvan
    s_pp = Scholarship(
        name="Moovalur Ramamirtham Ammaiyar Higher Education Assurance (Pudhumai Penn)",
        provider="Social Welfare Department, Tamil Nadu",
        description="Higher education monthly stipend.",
        application_url="https://pudhumaipenn.tn.gov.in/student-registration",
        deadline=datetime.now(timezone.utc) + timedelta(days=30),
        amount=12000,
    )
    assert portal_mapping_service.detect_portal_type(s_pp) == "PUDHUMAI_PENN"

    # 4. TNEA Online
    s_tnea = Scholarship(
        name="First Generation Graduate Tuition Fee Waiver",
        provider="DOTE Tamil Nadu",
        description="First graduate waiver.",
        application_url="https://www.tneaonline.org/special-reservation",
        deadline=datetime.now(timezone.utc) + timedelta(days=30),
        amount=25000,
    )
    assert portal_mapping_service.detect_portal_type(s_tnea) == "TNEA"

    # 5. TNDCE Offline
    s_tndce = Scholarship(
        name="Perarignar Anna Memorial Award",
        provider="Directorate of Collegiate Education",
        description="Collegiate offline award.",
        application_url="http://www.tndce.tn.gov.in/scholarship-circulars",
        deadline=datetime.now(timezone.utc) + timedelta(days=30),
        amount=5000,
    )
    assert portal_mapping_service.detect_portal_type(s_tndce) == "TNDCE_OFFLINE"

    # 6. Manual Assistance Only
    s_other = Scholarship(
        name="Private Endowment Trust Award",
        provider="Private Trust",
        description="Private educational grant.",
        application_url="https://exampletrust.org/apply",
        deadline=datetime.now(timezone.utc) + timedelta(days=30),
        amount=5000,
    )
    assert portal_mapping_service.detect_portal_type(s_other) == "MANUAL_ASSISTANCE_ONLY"

    # 7. Unsupported / Demo
    s_unsupported = Scholarship(
        name="Demo Fellowship",
        provider="Unknown",
        description="Demo fellowship.",
        application_url="#demo-link",
        status="INACTIVE",
        deadline=datetime.now(timezone.utc) + timedelta(days=30),
        amount=1000,
    )
    assert portal_mapping_service.detect_portal_type(s_unsupported) == "UNSUPPORTED"


def test_build_nsp_portal_mapping():
    """Validates structured NSP sections, fields, and grouped clipboard text."""
    s_nsp = Scholarship(
        name="Post Matric Scholarship for Minorities",
        provider="Ministry of Minority Affairs",
        description="Statutory minority scheme.",
        application_url="https://scholarships.gov.in/fresh/newRegistration",
        deadline=datetime.now(timezone.utc) + timedelta(days=30),
        amount=10000,
    )

    from app.schemas.application import ApplicationFormFieldItem
    fields = [
        ApplicationFormFieldItem(
            key="full_name",
            label="Full Legal Name",
            field_group="personal",
            value="KAVITHA M",
            is_confirmed=True,
            source="STUDENT_PROFILE",
            verification_status="PROFILE_PROVIDED",
            is_required=True,
        ),
        ApplicationFormFieldItem(
            key="institution_name",
            label="Current College / University Name",
            field_group="academic",
            value="College of Engineering Guindy, Anna University",
            is_confirmed=True,
            source="STUDENT_PROFILE",
            verification_status="PROFILE_PROVIDED",
            is_required=True,
        ),
        ApplicationFormFieldItem(
            key="bank_account_number",
            label="Bank Account Number",
            field_group="bank",
            value=None,  # Not provided
            is_confirmed=False,
            source="NOT_PROVIDED",
            verification_status="NOT_PROVIDED",
            is_required=True,
        ),
    ]

    sections = portal_mapping_service.build_portal_mappings(
        scholarship=s_nsp,
        fields=fields,
        requirements=[],
    )

    assert len(sections) == 5
    sec_titles = [s.section_title for s in sections]
    assert "1. Registration & Aadhaar OTR Verification" in sec_titles
    assert "2. Academic Enrolment & Institution Details" in sec_titles
    assert "3. Domicile, Category & Financial Information" in sec_titles
    assert "4. Direct Benefit Transfer (DBT) Bank Details" in sec_titles
    assert "5. Mandatory Documents & Institutional Endorsement" in sec_titles

    # Verify OTR section details
    otr_sec = next(s for s in sections if "1. Registration" in s.section_title)
    name_field = next(f for f in otr_sec.fields if f.key == "full_name")
    assert name_field.value == "KAVITHA M"
    assert name_field.copy_value == "KAVITHA M"
    assert "Aadhaar" in name_field.official_field_label

    # Verify grouped clipboard text is populated
    assert "[1. Registration & Aadhaar OTR Verification]" in otr_sec.grouped_copy_text
    assert "• Full Name (as per Aadhaar / School Certificate): KAVITHA M" in otr_sec.grouped_copy_text

    # Verify bank section has NO fabricated fallbacks
    bank_sec = next(s for s in sections if "4. Direct Benefit Transfer" in s.section_title)
    acc_field = next(f for f in bank_sec.fields if f.key == "bank_account_number")
    assert acc_field.value is None
    assert acc_field.copy_value == ""
    assert "[Not Provided]" in bank_sec.grouped_copy_text


def test_build_pudhumai_penn_portal_mapping():
    """Validates Pudhumai Penn specific higher education and bank details field mapping."""
    s_pp = Scholarship(
        name="Pudhumai Penn Scheme",
        provider="Social Welfare Department, Tamil Nadu",
        description="Higher education stipend scheme.",
        application_url="https://pudhumaipenn.tn.gov.in/student-registration",
        deadline=datetime.now(timezone.utc) + timedelta(days=30),
        amount=12000,
    )

    from app.schemas.application import ApplicationFormFieldItem
    fields = [
        ApplicationFormFieldItem(
            key="full_name",
            label="Full Legal Name",
            field_group="personal",
            value="SELVI S",
            is_confirmed=True,
            source="STUDENT_PROFILE",
            verification_status="PROFILE_PROVIDED",
            is_required=True,
        ),
        ApplicationFormFieldItem(
            key="institution_name",
            label="Current Enrolled College",
            field_group="academic",
            value="Queen Mary's College, Chennai",
            is_confirmed=True,
            source="STUDENT_PROFILE",
            verification_status="PROFILE_PROVIDED",
            is_required=True,
        ),
    ]

    sections = portal_mapping_service.build_portal_mappings(
        scholarship=s_pp,
        fields=fields,
        requirements=[],
    )

    assert len(sections) == 2
    enrol_sec = next(s for s in sections if "1. Higher Education Enrolment" in s.section_title)
    name_field = next(f for f in enrol_sec.fields if f.key == "full_name")
    assert name_field.value == "SELVI S"
    assert name_field.copy_value == "SELVI S"
    assert "Must match Tamil Nadu EMIS school records." in name_field.guidance_tip


def test_launch_official_portal_api_and_status_transition(client: TestClient, db_session: Session):
    """
    Validates POST /api/v1/applications/{id}/assistant/launch-portal:
    - Transitions submission_status to SUBMISSION_IN_PROGRESS
    - Records OFFICIAL_PORTAL_LAUNCHED event in status_history
    - Returns portal_sections, portal_type, is_portal_supported in workspace
    """
    email = "portal_student_test@scholarai.local"
    student = Student(name="Portal Student", email=email, phone="9876543210")
    db_session.add(student)
    db_session.flush()

    pwd_hash, salt = hash_password("PortalPass123!")
    user = User(
        email=email,
        password_hash=pwd_hash,
        salt=salt,
        role="STUDENT",
        student_id=student.id,
        is_active=True,
        is_demo=False,
    )
    db_session.add(user)
    db_session.flush()

    profile = StudentProfile(
        student_id=student.id,
        state="Tamil Nadu",
        cgpa=8.5,
    )
    db_session.add(profile)

    scholarship = Scholarship(
        name="Tamil Nadu State Post Matric Scholarship Test",
        provider="TN Adi Dravidar and Tribal Welfare",
        description="Post matric assistance scheme.",
        application_url="https://sspdept.tnega.org/ssp/registration",
        official_portal_name="Tamil Nadu SSP Portal",
        deadline=datetime.now(timezone.utc) + timedelta(days=60),
        amount=15000,
        status="ACTIVE",
        verification_status="OFFICIALLY_VERIFIED",
    )
    db_session.add(scholarship)
    db_session.flush()

    application = Application(
        student_id=student.id,
        scholarship_id=scholarship.id,
        status="IN_PROGRESS",
        preparation_status="READY_TO_SUBMIT",
        submission_status="MANUAL_SUBMISSION_REQUIRED",
        submission_mode="STUDENT_COMPLETED_EXTERNAL_SUBMISSION",
        form_data={},
    )
    db_session.add(application)
    db_session.commit()
    db_session.refresh(application)

    token = create_session_token(user_id=user.id, email=user.email)
    headers = {"Authorization": f"Bearer {token}"}

    # Verify initial state via GET workspace
    res_get = client.get(f"/api/v1/applications/{application.id}/assistant", headers=headers)
    assert res_get.status_code == 200
    ws = res_get.json()
    assert ws["submission_mode"] == "STUDENT_COMPLETED_EXTERNAL_SUBMISSION"
    assert ws["submission_status"] == "MANUAL_SUBMISSION_REQUIRED"
    assert ws["portal_type"] == "TN_SSP"
    assert ws["is_portal_supported"] is True
    assert len(ws["portal_sections"]) > 0

    # Call POST launch-portal
    res_launch = client.post(f"/api/v1/applications/{application.id}/assistant/launch-portal", headers=headers)
    assert res_launch.status_code == 200
    data = res_launch.json()

    # Submission status must now be SUBMISSION_IN_PROGRESS
    assert data["submission_status"] == "SUBMISSION_IN_PROGRESS"
    assert data["portal_type"] == "TN_SSP"

    # Verify audit history
    history = data["status_history"]
    assert any(h.get("event_type") == "OFFICIAL_PORTAL_LAUNCHED" for h in history)

    # Verify in DB directly
    db_session.refresh(application)
    assert application.submission_status == "SUBMISSION_IN_PROGRESS"


def test_launch_official_portal_isolation(client: TestClient, db_session: Session):
    """Verifies that Student B cannot launch or access Student A's application portal endpoint."""
    email_a = "student_a_test@scholarai.local"
    student_a = Student(name="Student A", email=email_a, phone="9111111111")
    db_session.add(student_a)
    db_session.flush()

    pwd_hash_a, salt_a = hash_password("PassA123!")
    user_a = User(
        email=email_a,
        password_hash=pwd_hash_a,
        salt=salt_a,
        role="STUDENT",
        student_id=student_a.id,
        is_active=True,
    )
    db_session.add(user_a)

    email_b = "student_b_test@scholarai.local"
    student_b = Student(name="Student B", email=email_b, phone="9222222222")
    db_session.add(student_b)
    db_session.flush()

    pwd_hash_b, salt_b = hash_password("PassB123!")
    user_b = User(
        email=email_b,
        password_hash=pwd_hash_b,
        salt=salt_b,
        role="STUDENT",
        student_id=student_b.id,
        is_active=True,
    )
    db_session.add(user_b)
    db_session.flush()

    scholarship = Scholarship(
        name="NSP Merit Scholarship Test",
        provider="Ministry of Education",
        description="Central merit scholarship.",
        application_url="https://scholarships.gov.in",
        deadline=datetime.now(timezone.utc) + timedelta(days=30),
        amount=20000,
        status="ACTIVE",
        verification_status="OFFICIALLY_VERIFIED",
    )
    db_session.add(scholarship)
    db_session.flush()

    app_a = Application(
        student_id=student_a.id,
        scholarship_id=scholarship.id,
        status="IN_PROGRESS",
        preparation_status="READY_TO_SUBMIT",
        submission_status="MANUAL_SUBMISSION_REQUIRED",
    )
    db_session.add(app_a)
    db_session.commit()
    db_session.refresh(app_a)

    token_b = create_session_token(user_id=user_b.id, email=user_b.email)
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Student B attempts to launch Student A's portal
    res = client.post(f"/api/v1/applications/{app_a.id}/assistant/launch-portal", headers=headers_b)
    assert res.status_code == 403
