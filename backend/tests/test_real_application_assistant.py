"""
Comprehensive Real Application Assistant & External Submission Tests
Tests the field-by-field preparation, grounded profile mapping, contradiction checks,
explicit student approval, and truthful external submission tracking.

Core Principle: "AI assists. Official sources decide. Student approves."
Rule: Never confuse an application saved in SCHOLARAi with an application submitted to the provider.
"""

import io
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

VALID_RECEIPT_PDF = (
    b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n"
    b"4 0 obj\n<< /Length 45 >>\nstream\n"
    b"BT /F1 12 Tf 100 700 Td (NSP Official Submission Receipt) Tj ET\n"
    b"endstream\nendobj\nxref\n0 5\n0000000000 65535 f \n"
    b"0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
    b"0000000204 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n300\n%%EOF"
)


@pytest.fixture
def test_setup(db_session: Session):
    # Student A (Arjun)
    email_a = "assistant_test_arjun@scholarai.local"
    user_a = db_session.query(User).filter(User.email == email_a).first()
    if not user_a:
        student_a = Student(name="Arjun Assistant Tester", email=email_a, phone="9111111111")
        db_session.add(student_a)
        db_session.flush()
        prof_a = StudentProfile(
            student_id=student_a.id,
            institution="Loyola College (Autonomous)",
            course="B.Sc. Computer Science",
            year="Year 2",
            twelfth_percentage=92.5,
            category="BC",
            cgpa=8.8,
            state="Tamil Nadu",
            gender="Male",
            admission_quota="GOVERNMENT_QUOTA",
            hosteller_status="DAY_SCHOLAR",
            is_first_graduate=True,
        )
        db_session.add(prof_a)
        fund_a = FundingProfile(
            student_id=student_a.id,
            annual_family_income=180000.0,
            annual_education_cost=45000.0,
            existing_support=0.0,
        )
        db_session.add(fund_a)
        pwd_hash, salt = hash_password("ArjunSecurePass123!")
        user_a = User(
            email=email_a,
            password_hash=pwd_hash,
            salt=salt,
            role="STUDENT",
            student_id=student_a.id,
            is_active=True,
            is_demo=False,
        )
        db_session.add(user_a)
        db_session.commit()
        db_session.refresh(user_a)

    # Student B (Tenant Isolation check)
    email_b = "assistant_test_other@scholarai.local"
    user_b = db_session.query(User).filter(User.email == email_b).first()
    if not user_b:
        student_b = Student(name="Other Student", email=email_b, phone="9222222222")
        db_session.add(student_b)
        db_session.flush()
        pwd_hash_b, salt_b = hash_password("OtherSecurePass123!")
        user_b = User(
            email=email_b,
            password_hash=pwd_hash_b,
            salt=salt_b,
            role="STUDENT",
            student_id=student_b.id,
            is_active=True,
            is_demo=False,
        )
        db_session.add(user_b)
        db_session.commit()
        db_session.refresh(user_b)

    # Test Scholarship: Central Sector Scheme (NSP)
    sch = db_session.query(Scholarship).filter(Scholarship.name.like("%Central Sector%")).first()
    if not sch:
        sch = Scholarship(
            name="Central Sector Scheme of Scholarship (PM-USP CSSS)",
            provider="Department of Higher Education, Ministry of Education, Government of India",
            description="Merit-cum-means scholarship for college students.",
            amount=12000.0,
            currency="INR",
            deadline=datetime.now(timezone.utc),
            application_url="https://scholarships.gov.in/",
            official_portal_name="National Scholarship Portal (NSP)",
            income_ceiling=450000.0,
            status="ACTIVE",
        )
        db_session.add(sch)
        db_session.commit()
        db_session.refresh(sch)

    # Create Application for Student A
    app_obj = (
        db_session.query(Application)
        .filter(Application.student_id == user_a.student_id, Application.scholarship_id == sch.id)
        .first()
    )
    if not app_obj:
        app_obj = Application(
            student_id=user_a.student_id,
            scholarship_id=sch.id,
            status="IN_PROGRESS",
            preparation_status="IN_PROGRESS",
            submission_status="NOT_SUBMITTED",
            progress=0.0,
            personal_statement="Initial statement",
        )
        db_session.add(app_obj)
        db_session.commit()
        db_session.refresh(app_obj)

    return {
        "user_a": user_a,
        "user_b": user_b,
        "scholarship": sch,
        "application": app_obj,
    }


def test_get_application_assistant_workspace(client: TestClient, test_setup: dict):
    """The workspace returns field checklists, official instructions, and portal intelligence."""
    user_a = test_setup["user_a"]
    app_id = test_setup["application"].id
    token = create_session_token(user_a.id, user_a.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    res = client.get(f"/api/v1/applications/{app_id}/assistant")
    assert res.status_code == 200
    data = res.json()

    assert data["application_id"] == app_id
    assert data["submission_mode"] == "STUDENT_COMPLETED_EXTERNAL_SUBMISSION"
    assert "scholarships.gov.in" in data["official_portal_url"]
    assert "National Scholarship Portal" in data["official_portal_name"]
    assert len(data["fields"]) >= 10
    assert len(data["instructions"]) > 0

    # Verify auto-populated fields from student profile
    field_keys = {f["key"]: f for f in data["fields"]}
    assert "full_name" in field_keys
    assert field_keys["full_name"]["value"] == "Arjun Assistant Tester"
    assert field_keys["full_name"]["source"] == "STUDENT_PROFILE"

    assert "cgpa_score" in field_keys
    assert field_keys["cgpa_score"]["value"] == "8.8"

    assert "annual_income" in field_keys
    assert field_keys["annual_income"]["value"] == "180000"


def test_update_application_form_fields(client: TestClient, test_setup: dict):
    """Student can update, edit, and confirm form answers persistently."""
    user_a = test_setup["user_a"]
    app_id = test_setup["application"].id
    token = create_session_token(user_a.id, user_a.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    payload = {
        "fields": {
            "full_name": {"value": "Arjun K.", "is_confirmed": True},
            "bank_account_number": {"value": "987654321012", "is_confirmed": True},
            "bank_ifsc_code": {"value": "SBIN0000800", "is_confirmed": True},
        }
    }
    res = client.put(f"/api/v1/applications/{app_id}/assistant/fields", json=payload)
    assert res.status_code == 200
    data = res.json()

    field_map = {f["key"]: f for f in data["fields"]}
    assert field_map["full_name"]["value"] == "Arjun K."
    assert field_map["full_name"]["is_confirmed"] is True
    assert field_map["bank_account_number"]["value"] == "987654321012"

    # Verify audit history event was appended
    history_events = [ev["event_type"] for ev in data["status_history"]]
    assert "FORM_FIELDS_UPDATED" in history_events


def test_tenant_isolation_prevents_unauthorized_access(client: TestClient, test_setup: dict):
    """Student B cannot view or modify Student A's application workspace."""
    user_b = test_setup["user_b"]
    app_id = test_setup["application"].id
    token_b = create_session_token(user_b.id, user_b.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token_b)

    # Attempt to read workspace
    res = client.get(f"/api/v1/applications/{app_id}/assistant")
    assert res.status_code in [403, 404]

    # Attempt to update fields
    res_update = client.put(f"/api/v1/applications/{app_id}/assistant/fields", json={"fields": {"cgpa_score": "9.9"}})
    assert res_update.status_code in [403, 404]


def test_record_external_submission_validates_and_records(client: TestClient, test_setup: dict, db_session: Session):
    """Recording external submission updates submission_status to SUBMITTED_EXTERNALLY with proof."""
    user_a = test_setup["user_a"]
    app_id = test_setup["application"].id
    token = create_session_token(user_a.id, user_a.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # 1. Invalid confirmation number (too short / empty) rejected
    bad_res = client.post(
        f"/api/v1/applications/{app_id}/assistant/record-external-submission",
        json={"confirmation_number": "1"}
    )
    assert bad_res.status_code in [400, 422]

    # 2. Upload official acknowledgment receipt
    files = {"file": ("nsp_ack_receipt.pdf", io.BytesIO(VALID_RECEIPT_PDF), "application/pdf")}
    doc_res = client.post(
        "/api/v1/documents/upload",
        files=files,
        data={"document_type": "OTHER", "notes": "NSP Final Submission Acknowledgment Slip"}
    )
    assert doc_res.status_code == 201
    receipt_doc_id = doc_res.json()["id"]

    # 3. Record valid external submission
    conf_number = "NSP-2024-TN-882194"
    valid_res = client.post(
        f"/api/v1/applications/{app_id}/assistant/record-external-submission",
        json={
            "confirmation_number": conf_number,
            "receipt_document_id": receipt_doc_id,
            "submission_notes": "Submitted successfully via NSP OTR portal.",
        }
    )
    assert valid_res.status_code == 200
    app_data = valid_res.json()

    assert app_data["status"] == "SUBMITTED"
    assert app_data["submission_status"] == "SUBMITTED_EXTERNALLY"
    assert app_data["external_application_id"] == conf_number
    assert app_data["external_receipt_document_id"] == receipt_doc_id
    assert conf_number in app_data["status_reason"]


def test_official_api_submission_adapter(client: TestClient, test_setup: dict):
    """Official API submission enforces explicit consent and duplicate submission checks."""
    user_a = test_setup["user_a"]
    app_id = test_setup["application"].id
    token = create_session_token(user_a.id, user_a.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # Set application to ready state for API transmission test
    app_obj = test_setup["application"]
    app_obj.status = "READY"
    app_obj.preparation_status = "READY_FOR_REVIEW"
    app_obj.submission_status = "NOT_SUBMITTED"

    # Missing accuracy confirmation rejected
    reject_res = client.post(
        f"/api/v1/applications/{app_id}/assistant/submit-api",
        json={"confirm_accuracy": False}
    )
    assert reject_res.status_code == 400

    # Authorized submission succeeds and records transmission confirmation
    ok_res = client.post(
        f"/api/v1/applications/{app_id}/assistant/submit-api",
        json={"confirm_accuracy": True, "idempotency_key": "test-idem-key-101"}
    )
    assert ok_res.status_code == 200
    data = ok_res.json()
    assert data["submission_status"] == "SUBMITTED_EXTERNALLY"
    assert data["external_application_id"] is not None
    assert "API-TX-" in data["external_application_id"]

    # Duplicate submission attempt rejected
    dup_res = client.post(
        f"/api/v1/applications/{app_id}/assistant/submit-api",
        json={"confirm_accuracy": True}
    )
    assert dup_res.status_code == 400
    assert "already been submitted" in dup_res.json()["detail"].lower()


def test_export_application_dossier(client: TestClient, test_setup: dict):
    """Students can export a clean JSON payload for easy copy-pasting to external portals."""
    user_a = test_setup["user_a"]
    app_id = test_setup["application"].id
    token = create_session_token(user_a.id, user_a.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    res = client.get(f"/api/v1/applications/{app_id}/assistant/export-dossier")
    assert res.status_code == 200
    dossier = res.json()

    assert "fields" in dossier
    assert "scholarship_name" in dossier
    assert "disclaimer" in dossier
    assert "AI assists. Official sources decide. Student approves." in dossier["disclaimer"]
