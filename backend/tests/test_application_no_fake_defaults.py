"""
SCHOLARAi — Comprehensive Tests for Truthful Application Assistance & Fallback Removal
Tests proving that:
1. Missing annual income stays missing (never defaulted to 180000).
2. Missing bank details stay empty (never defaulted to SBI, XXXX-XXXX-4819, SBIN0000800).
3. Existing saved profile and application answers are preserved.
4. Missing fields are clearly identified and block premature approval.
5. Missing information cannot be marked verified (and uploaded != verified).
6. AI-generated statements do not invent unsupported personal claims.
7. Existing application preparation and export features continue to work.
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.scholarship import Scholarship
from app.models.document import Document
from app.models.user import User
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.funding_profile import FundingProfile
from app.core.security import create_session_token, hash_password
from app.core.config import settings


@pytest.fixture
def empty_student_setup(db_session: Session):
    """Student with blank profile (no income, no bank, no gender, no category)."""
    email = "empty_student_test@scholarai.local"
    user = db_session.query(User).filter(User.email == email).first()
    if not user:
        student = Student(name="Bare Minimum Student", email=email, phone="9000000000")
        db_session.add(student)
        db_session.flush()

        prof = StudentProfile(
            student_id=student.id,
            institution=None,
            course=None,
            year=None,
            category=None,
            gender=None,
            state=None,
            cgpa=None,
            institution_type=None,
            admission_quota=None,
            hosteller_status=None,
            is_first_graduate=None,
        )
        db_session.add(prof)

        pwd_hash, salt = hash_password("EmptyPass123!")
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
        db_session.commit()
        db_session.refresh(user)

    sch = db_session.query(Scholarship).filter(Scholarship.name == "Tamil Nadu Merit Grant Test").first()
    if not sch:
        sch = Scholarship(
            name="Tamil Nadu Merit Grant Test",
            provider="TN Directorate of Collegiate Education",
            description="State collegiate scheme.",
            amount=15000.0,
            currency="INR",
            deadline=datetime.now(timezone.utc),
            application_url="https://tndce.tn.gov.in/",
            official_portal_name="TNDCE Portal",
            income_ceiling=250000.0,
            tn_residency_required="YES",
            status="ACTIVE",
        )
        db_session.add(sch)
        db_session.commit()
        db_session.refresh(sch)

    app_obj = (
        db_session.query(Application)
        .filter(Application.student_id == user.student_id, Application.scholarship_id == sch.id)
        .first()
    )
    if not app_obj:
        app_obj = Application(
            student_id=user.student_id,
            scholarship_id=sch.id,
            status="IN_PROGRESS",
            preparation_status="IN_PROGRESS",
            submission_status="NOT_SUBMITTED",
            progress=0.0,
            personal_statement="",
        )
        db_session.add(app_obj)
        db_session.commit()
        db_session.refresh(app_obj)

    return {
        "user": user,
        "student": user.student,
        "scholarship": sch,
        "application": app_obj,
    }


def test_1_missing_annual_income_stays_missing(client: TestClient, empty_student_setup: dict):
    """When a student has no income saved, annual_income must stay None (not defaulted to 180000)."""
    user = empty_student_setup["user"]
    app_id = empty_student_setup["application"].id
    token = create_session_token(user.id, user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    res = client.get(f"/api/v1/applications/{app_id}/assistant")
    assert res.status_code == 200
    data = res.json()

    field_map = {f["key"]: f for f in data["fields"]}
    income_field = field_map["annual_income"]

    # Must be None, not fabricated 180000
    assert income_field["value"] is None
    assert income_field["suggested_value"] is None
    assert income_field["source"] == "NOT_PROVIDED"
    assert income_field["verification_status"] == "NOT_PROVIDED"
    assert income_field["is_confirmed"] is False
    assert "Annual Family Income (INR)" in data["missing_mandatory_fields"]


def test_2_missing_bank_details_stay_empty(client: TestClient, empty_student_setup: dict):
    """Bank details must remain empty/None (never defaulted to SBI, XXXX-XXXX-4819, SBIN0000800)."""
    user = empty_student_setup["user"]
    app_id = empty_student_setup["application"].id
    token = create_session_token(user.id, user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    res = client.get(f"/api/v1/applications/{app_id}/assistant")
    assert res.status_code == 200
    data = res.json()

    field_map = {f["key"]: f for f in data["fields"]}

    # Bank Name
    bank_name = field_map["bank_name"]
    assert bank_name["value"] is None
    assert bank_name["suggested_value"] is None
    assert bank_name["source"] == "NOT_PROVIDED"
    assert bank_name["value"] != "State Bank of India"

    # Account Number
    acc_num = field_map["bank_account_number"]
    assert acc_num["value"] is None
    assert acc_num["suggested_value"] is None
    assert acc_num["source"] == "NOT_PROVIDED"
    assert acc_num["value"] != "XXXX-XXXX-4819"

    # IFSC Code
    ifsc = field_map["bank_ifsc_code"]
    assert ifsc["value"] is None
    assert ifsc["suggested_value"] is None
    assert ifsc["source"] == "NOT_PROVIDED"
    assert ifsc["value"] != "SBIN0000800"

    # Check demographic fields also have NO fake defaults
    assert field_map["gender"]["value"] is None
    assert field_map["gender"]["value"] != "Male"
    assert field_map["community_category"]["value"] is None
    assert field_map["community_category"]["value"] != "BC"
    assert field_map["institution_type"]["value"] is None
    assert field_map["institution_type"]["value"] != "Government-aided"


def test_3_existing_saved_profile_and_application_answers_preserved(
    client: TestClient, empty_student_setup: dict, db_session: Session
):
    """Prefills legitimately from profile and preserves student-edited application answers."""
    user = empty_student_setup["user"]
    app_id = empty_student_setup["application"].id
    token = create_session_token(user.id, user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # 1. Update profile with legitimate data
    prof = user.student.profile
    prof.institution = "Presidency College, Chennai"
    prof.course = "B.A. Economics"
    prof.year = "Year 2"
    prof.category = "MBC/DNC"
    prof.state = "Tamil Nadu"
    prof.gender = "Female"

    # Add funding profile
    fund = FundingProfile(
        student_id=user.student.id,
        annual_family_income=95000.0,
        annual_education_cost=25000.0,
        existing_support=0.0,
    )
    db_session.add(fund)
    db_session.commit()

    # 2. Verify workspace pre-fills from profile
    res1 = client.get(f"/api/v1/applications/{app_id}/assistant")
    assert res1.status_code == 200
    data1 = res1.json()
    field_map1 = {f["key"]: f for f in data1["fields"]}

    assert field_map1["institution_name"]["value"] == "Presidency College, Chennai"
    assert field_map1["institution_name"]["source"] == "STUDENT_PROFILE"
    assert field_map1["course_program"]["value"] == "B.A. Economics"
    assert field_map1["community_category"]["value"] == "MBC/DNC"
    assert field_map1["annual_income"]["value"] == "95000"
    assert field_map1["annual_income"]["source"] == "STUDENT_PROFILE"

    # 3. Student explicitly saves bank answers & confirms income
    update_payload = {
        "fields": {
            "annual_income": {"value": "95000", "is_confirmed": True},
            "bank_name": {"value": "Indian Bank", "is_confirmed": True},
            "bank_account_number": {"value": "200987654321", "is_confirmed": True},
            "bank_ifsc_code": {"value": "IDIB000P042", "is_confirmed": True},
        }
    }
    res_update = client.put(f"/api/v1/applications/{app_id}/assistant/fields", json=update_payload)
    assert res_update.status_code == 200

    # 4. Reload workspace and confirm answers persisted
    res2 = client.get(f"/api/v1/applications/{app_id}/assistant")
    assert res2.status_code == 200
    data2 = res2.json()
    field_map2 = {f["key"]: f for f in data2["fields"]}

    assert field_map2["bank_name"]["value"] == "Indian Bank"
    assert field_map2["bank_name"]["is_confirmed"] is True
    assert field_map2["bank_account_number"]["value"] == "200987654321"
    assert field_map2["bank_ifsc_code"]["value"] == "IDIB000P042"


def test_4_missing_fields_clearly_identified_and_block_approval(client: TestClient, empty_student_setup: dict):
    """Missing mandatory fields are flagged in missing_mandatory_fields and block approval."""
    user = empty_student_setup["user"]
    app_id = empty_student_setup["application"].id
    token = create_session_token(user.id, user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    res = client.get(f"/api/v1/applications/{app_id}/assistant")
    data = res.json()

    assert len(data["missing_mandatory_fields"]) > 0
    assert data["preparation_status"] == "ACTION_REQUIRED"
    assert data["is_ready_for_student_approval"] is False

    # Attempt to approve without filling mandatory fields
    approve_res = client.post(
        f"/api/v1/applications/{app_id}/assistant/approve",
        json={"consent": True}
    )
    assert approve_res.status_code == 400
    assert "Missing fields:" in approve_res.json()["detail"]


def test_5_missing_information_cannot_be_marked_verified(
    client: TestClient, empty_student_setup: dict, db_session: Session
):
    """Missing information is NOT_PROVIDED; unverified uploaded docs do not grant verified status."""
    user = empty_student_setup["user"]
    app_id = empty_student_setup["application"].id
    token = create_session_token(user.id, user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # 1. Missing income -> verification_status == NOT_PROVIDED
    res = client.get(f"/api/v1/applications/{app_id}/assistant")
    data = res.json()
    field_map = {f["key"]: f for f in data["fields"]}
    assert field_map["annual_income"]["verification_status"] == "NOT_PROVIDED"

    # 2. Add an unverified document (status="AVAILABLE", verification_status="UPLOADED")
    doc = Document(
        student_id=user.student.id,
        document_type="INCOME_CERTIFICATE",
        name="Income Cert Unverified",
        original_filename="income.pdf",
        status="AVAILABLE",
        verification_status="UPLOADED",  # Not OFFICIALLY_VERIFIED!
    )
    db_session.add(doc)
    db_session.commit()

    # Even with an uploaded document, if income value is not entered or verified:
    # Enter income value
    client.put(
        f"/api/v1/applications/{app_id}/assistant/fields",
        json={"fields": {"annual_income": {"value": "80000", "is_confirmed": True}}}
    )
    res_after = client.get(f"/api/v1/applications/{app_id}/assistant")
    data_after = res_after.json()
    field_map_after = {f["key"]: f for f in data_after["fields"]}

    # Document is only UPLOADED, not officially verified:
    # verification_status must NOT be DOCUMENT_VERIFIED or OFFICIALLY_VERIFIED
    assert field_map_after["annual_income"]["verification_status"] != "DOCUMENT_VERIFIED"
    assert field_map_after["annual_income"]["verification_status"] == "STUDENT_PROVIDED"


def test_6_ai_generated_statement_does_not_invent_unsupported_claims(
    client: TestClient, empty_student_setup: dict
):
    """AI personal statement draft does not invent fake CGPA (8.4), Demo College, or Computer Science."""
    user = empty_student_setup["user"]
    app_id = empty_student_setup["application"].id
    token = create_session_token(user.id, user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    res = client.post(
        f"/api/v1/applications/{app_id}/draft",
        json={"question": "Explain your academic focus and necessity for this scholarship."}
    )
    assert res.status_code == 200
    draft_data = res.json()

    draft_text = draft_data["draft_text"]

    # Must NOT invent fake fallback strings
    assert "Computer Science" not in draft_text
    assert "Demo College" not in draft_text
    assert "8.4" not in draft_text
    assert "2nd-year" not in draft_text

    # Claims detected must not assert unverified CGPA
    claims = " ".join(draft_data["claims_detected"])
    assert "8.4" not in claims

    assert draft_data["student_approval_required"] is True
    assert "AI GENERATED DRAFT" in draft_data["trust_label"]


def test_7_application_preparation_and_export_features_continue_to_work(
    client: TestClient, empty_student_setup: dict
):
    """Dossier export returns structured JSON with disclaimer and truthful field states."""
    user = empty_student_setup["user"]
    app_id = empty_student_setup["application"].id
    token = create_session_token(user.id, user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    res = client.get(f"/api/v1/applications/{app_id}/assistant/export-dossier")
    assert res.status_code == 200
    dossier = res.json()

    assert "fields" in dossier
    assert "scholarship_name" in dossier
    assert "missing_mandatory_fields" in dossier
    assert "unconfirmed_fields" in dossier
    assert "disclaimer" in dossier
    assert "AI assists. Official sources decide. Student approves." in dossier["disclaimer"]

