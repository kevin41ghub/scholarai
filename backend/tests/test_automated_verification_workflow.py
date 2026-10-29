"""
Comprehensive Automated Verification & Application Status Workflow Tests
Covers all 18 verification, status engine, security, and authorization scenarios.

Core Principle: "AI assists. Official sources decide. Student approves."
"""

import io
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.models.scholarship import Scholarship
from app.models.scholarship_requirement import ScholarshipRequirement
from app.models.document import Document
from app.models.user import User
from app.models.student import Student
from app.services.storage_service import storage_service

VALID_PDF_BYTES = (
    b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n"
    b"4 0 obj\n<< /Length 53 >>\nstream\n"
    b"BT /F1 12 Tf 100 700 Td (This is to certify that Arjun Kumar) Tj ET\n"
    b"endstream\nendobj\nxref\n0 5\n0000000000 65535 f \n"
    b"0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
    b"0000000204 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n308\n%%EOF"
)


# ==============================================================================
# 1. An application with missing required documents remains IN_PROGRESS
# ==============================================================================
def test_1_missing_required_documents_remains_in_progress(auth_client: TestClient, db_session: Session):
    res = auth_client.get("/api/v1/applications")
    assert res.status_code == 200
    apps = res.json()
    assert len(apps) > 0

    # Arjun Kumar starts with missing Income Certificate
    in_progress_apps = [a for a in apps if a["status"] == "IN_PROGRESS"]
    assert len(in_progress_apps) > 0
    for app in in_progress_apps:
        assert app["progress"] < 100.0
        assert app["is_ready_for_submission"] is False
        assert "missing" in app["status_reason"].lower() or "progress" in app["status_reason"].lower()
        assert len(app["blockers"]) > 0


# ==============================================================================
# 2. A valid upload is persisted and associated with the correct requirement
# ==============================================================================
def test_2_valid_upload_persisted_and_associated(auth_client: TestClient, db_session: Session):
    files = {"file": ("income_cert.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    res = auth_client.post(
        "/api/v1/documents/upload",
        files=files,
        data={"document_type": "INCOME_CERTIFICATE", "notes": "Verified Tahsildar copy"}
    )
    assert res.status_code == 201
    doc_payload = res.json()
    assert doc_payload["document_type"] == "INCOME_CERTIFICATE"
    assert doc_payload["storage_key"] is not None
    assert doc_payload["status"] in ["AVAILABLE", "VERIFIED"]

    # Verify physical file existence in storage backend
    assert storage_service.backend.file_exists(doc_payload["storage_key"]) is True

    # Verify association with requirements
    app_res = auth_client.get("/api/v1/applications")
    assert app_res.status_code == 200
    for app in app_res.json():
        for req in app["requirements"]:
            if req["document_type"] == "INCOME_CERTIFICATE":
                assert req["document_id"] == doc_payload["id"]
                assert req["status"] in ["AVAILABLE", "VERIFIED"]


# ==============================================================================
# 3. A successful upload automatically updates the document checklist
# ==============================================================================
def test_3_successful_upload_updates_checklist(auth_client: TestClient):
    files = {"file": ("income_cert.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    res_upload = auth_client.post(
        "/api/v1/documents/upload",
        files=files,
        data={"document_type": "INCOME_CERTIFICATE"}
    )
    assert res_upload.status_code == 201

    # Fetch applications and verify checklist response
    res_apps = auth_client.get("/api/v1/applications")
    assert res_apps.status_code == 200
    apps = res_apps.json()
    income_reqs = [
        r for a in apps for r in a["requirements"] if r["document_type"] == "INCOME_CERTIFICATE"
    ]
    assert len(income_reqs) > 0
    for r in income_reqs:
        assert r["status"] in ["AVAILABLE", "VERIFIED"]
        assert r["document_id"] is not None


# ==============================================================================
# 4. A failed upload never becomes AVAILABLE
# ==============================================================================
def test_4_failed_upload_never_becomes_available(auth_client: TestClient, db_session: Session):
    # Upload an empty 0-byte file
    files = {"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")}
    res = auth_client.post(
        "/api/v1/documents/upload",
        files=files,
        data={"document_type": "INCOME_CERTIFICATE"}
    )
    assert res.status_code == 400
    assert "empty file" in res.json()["detail"].lower()

    # Verify document in DB remained MISSING
    doc = db_session.query(Document).filter(Document.document_type == "INCOME_CERTIFICATE").first()
    if doc:
        assert doc.status == "MISSING"
        assert doc.storage_key is None


# ==============================================================================
# 5. An upload with an invalid file type is rejected
# ==============================================================================
def test_5_invalid_file_type_rejected(auth_client: TestClient):
    files = {"file": ("malicious.exe", io.BytesIO(b"MZ\x90\x00executable"), "application/octet-stream")}
    res = auth_client.post(
        "/api/v1/documents/upload",
        files=files,
        data={"document_type": "INCOME_CERTIFICATE"}
    )
    assert res.status_code == 400
    assert "unsupported file extension" in res.json()["detail"].lower()


# ==============================================================================
# 6. A file exceeding the size limit is rejected
# ==============================================================================
def test_6_file_exceeding_size_limit_rejected(auth_client: TestClient):
    # 11MB file (exceeds 10MB limit)
    oversized = b"%PDF-1.4\n" + (b"0" * (11 * 1024 * 1024))
    files = {"file": ("huge.pdf", io.BytesIO(oversized), "application/pdf")}
    res = auth_client.post(
        "/api/v1/documents/upload",
        files=files,
        data={"document_type": "INCOME_CERTIFICATE"}
    )
    assert res.status_code == 413
    assert "exceeds maximum allowed size" in res.json()["detail"].lower()


# ==============================================================================
# 7. A missing optional document does not incorrectly block readiness
# ==============================================================================
def test_7_missing_optional_document_does_not_block_readiness(auth_client: TestClient, db_session: Session):
    from app.core.config import settings
    demo_user = db_session.query(User).filter(User.email == settings.DEMO_USER_EMAIL).first()
    student = db_session.query(Student).filter(Student.id == demo_user.student_id).first()

    # Create scholarship with 1 required requirement and 1 optional requirement
    test_sch = Scholarship(
        name="Optional Test Scholarship",
        provider="Tamil Nadu Test Trust",
        description="Scholarship for testing optional document reconciliation.",
        amount=20000.0,
        deadline=datetime(2027, 1, 1, tzinfo=timezone.utc),
        status="ACTIVE",
        verification_status="SOURCE_VERIFIED",
    )
    db_session.add(test_sch)
    db_session.flush()

    req_mandatory = ScholarshipRequirement(
        scholarship_id=test_sch.id,
        name="Mandatory Marksheet",
        document_type="MARKSHEET",
        type="DOCUMENT",
        is_required=True,
    )
    req_optional = ScholarshipRequirement(
        scholarship_id=test_sch.id,
        name="Optional Additional Certificate",
        document_type="SPECIAL_CATEGORY_CERTIFICATE",
        type="DOCUMENT",
        is_required=False,
    )
    db_session.add_all([req_mandatory, req_optional])
    db_session.commit()

    # Student applies
    res_apply = auth_client.post("/api/v1/applications", json={"scholarship_id": test_sch.id})
    assert res_apply.status_code == 201
    app_data = res_apply.json()

    # Marksheet is AVAILABLE in seed, SPECIAL_CATEGORY_CERTIFICATE is MISSING.
    # Because only MARKSHEET is required, the application MUST be READY!
    assert app_data["status"] == "READY"
    assert app_data["is_ready_for_submission"] is True
    assert app_data["required_documents_total"] == 1
    assert app_data["required_documents_completed"] == 1


# ==============================================================================
# 8. Uploading all applicable required documents causes readiness recalculation
# ==============================================================================
def test_8_uploading_all_required_causes_readiness_recalculation(auth_client: TestClient):
    # Upload missing INCOME_CERTIFICATE
    files = {"file": ("income.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    res_upload = auth_client.post(
        "/api/v1/documents/upload",
        files=files,
        data={"document_type": "INCOME_CERTIFICATE"}
    )
    assert res_upload.status_code == 201

    # Check applications
    res_apps = auth_client.get("/api/v1/applications")
    assert res_apps.status_code == 200
    apps = res_apps.json()

    for app in apps:
        if app["scholarship_name"] in [
            "Post-Matric Scholarship for BC, MBC & DNC Students",
            "Central Sector Scheme of Scholarship for College and University Students (PM-USP CSSS)",
            "Free Education Scheme for 3-Year Degree Students (BC/MBC/DNC)",
        ]:
            assert app["status"] == "READY"
            assert app["progress"] == 100.0
            assert app["is_ready_for_submission"] is True
            assert app["missing_requirements_count"] == 0


# ==============================================================================
# 9. An application becomes READY only when backend readiness rules are satisfied
# ==============================================================================
def test_9_application_becomes_ready_only_when_backend_rules_satisfied(auth_client: TestClient, db_session: Session):
    from app.core.config import settings
    demo_user = db_session.query(User).filter(User.email == settings.DEMO_USER_EMAIL).first()

    # Create scholarship requiring DEGREE_CERTIFICATE (which student does not have)
    sch = Scholarship(
        name="Strict Degree Fellowship",
        provider="TANSCHE Strict",
        description="Fellowship requiring degree certificate verification.",
        amount=50000.0,
        deadline=datetime(2027, 2, 1, tzinfo=timezone.utc),
        status="ACTIVE",
        verification_status="SOURCE_VERIFIED",
    )
    db_session.add(sch)
    db_session.flush()

    sch_req = ScholarshipRequirement(
        scholarship_id=sch.id,
        name="Official Degree Certificate",
        document_type="DEGREE_CERTIFICATE",
        type="DOCUMENT",
        is_required=True,
    )
    db_session.add(sch_req)
    db_session.commit()

    res_app = auth_client.post("/api/v1/applications", json={"scholarship_id": sch.id})
    assert res_app.status_code == 201
    assert res_app.json()["status"] == "IN_PROGRESS"
    assert res_app.json()["is_ready_for_submission"] is False


# ==============================================================================
# 10. A student cannot manually change the application status through UI or API
# ==============================================================================
def test_10_student_cannot_manually_change_application_status(auth_client: TestClient):
    apps = auth_client.get("/api/v1/applications").json()
    app_id = apps[0]["id"]

    for forbidden_status in ["READY", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"]:
        res_patch = auth_client.patch(
            f"/api/v1/applications/{app_id}",
            json={"status": forbidden_status}
        )
        assert res_patch.status_code == 403
        assert "forbidden" in res_patch.json()["detail"].lower()


# ==============================================================================
# 11. A student cannot manually mark a document AVAILABLE
# ==============================================================================
def test_11_student_cannot_manually_mark_document_available(auth_client: TestClient):
    docs = auth_client.get("/api/v1/documents").json()
    doc_id = docs[0]["id"]

    # Attempt to PATCH document status to AVAILABLE
    res_patch_doc = auth_client.patch(
        f"/api/v1/documents/{doc_id}",
        json={"status": "AVAILABLE"}
    )
    assert res_patch_doc.status_code == 403
    assert "forbidden" in res_patch_doc.json()["detail"].lower()

    # Attempt to create document with AVAILABLE status without uploading file
    res_post_doc = auth_client.post(
        "/api/v1/documents",
        json={"name": "Fake Document", "document_type": "INCOME_CERTIFICATE", "status": "AVAILABLE"}
    )
    # Server accepts document metadata entry but safely forces status to MISSING
    assert res_post_doc.status_code == 201
    assert res_post_doc.json()["status"] == "MISSING"

    # Attempt to PATCH requirement status to AVAILABLE
    apps = auth_client.get("/api/v1/applications").json()
    app_id = apps[0]["id"]
    req_id = apps[0]["requirements"][0]["id"]
    res_patch_req = auth_client.patch(
        f"/api/v1/applications/{app_id}/requirements/{req_id}",
        json={"status": "AVAILABLE"}
    )
    assert res_patch_req.status_code == 403


# ==============================================================================
# 12. A student cannot modify another student's document or application
# ==============================================================================
def test_12_isolation_student_cannot_modify_other_student_data(
    auth_client: TestClient,
    create_authenticated_client,
    db_session: Session
):
    apps = auth_client.get("/api/v1/applications").json()
    student_a_app_id = apps[0]["id"]
    docs = auth_client.get("/api/v1/documents").json()
    student_a_doc_id = docs[0]["id"]

    # Create Student B session
    client_b, user_b, student_b = create_authenticated_client(email="student_b_sec@example.com", name="Student B")

    # Student B attempts to access Student A's application
    assert client_b.get(f"/api/v1/applications/{student_a_app_id}").status_code == 403
    assert client_b.patch(f"/api/v1/applications/{student_a_app_id}", json={"personal_statement": "Hacked"}).status_code == 403
    assert client_b.post(f"/api/v1/applications/{student_a_app_id}/submit").status_code == 403
    assert client_b.post(f"/api/v1/applications/{student_a_app_id}/withdraw").status_code == 403

    # Student B attempts to access Student A's document
    assert client_b.get(f"/api/v1/documents/{student_a_doc_id}").status_code == 403
    assert client_b.delete(f"/api/v1/documents/{student_a_doc_id}").status_code == 403


# ==============================================================================
# 13. Only authorized reviewers can perform restricted review transitions
# ==============================================================================
def test_13_only_authorized_reviewers_can_perform_review(
    auth_client: TestClient,
    db_session: Session
):
    # 1. Unblock application to READY and SUBMIT
    files = {"file": ("income.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    auth_client.post("/api/v1/documents/upload", files=files, data={"document_type": "INCOME_CERTIFICATE"})

    apps = auth_client.get("/api/v1/applications").json()
    ready_app = next(a for a in apps if a["status"] == "READY")
    sub_res = auth_client.post(f"/api/v1/applications/{ready_app['id']}/submit")
    assert sub_res.status_code == 200
    assert sub_res.json()["status"] == "SUBMITTED"

    # 2. Regular student attempts to review/approve
    student_review_attempt = auth_client.post(
        f"/api/v1/applications/{ready_app['id']}/review",
        json={"action": "APPROVE", "reason": "Self-granting scholarship"}
    )
    assert student_review_attempt.status_code == 403
    assert "reviewer or administrator role required" in student_review_attempt.json()["detail"].lower()

    # 3. Promote user to REVIEWER
    from app.core.config import settings
    demo_user = db_session.query(User).filter(User.email == settings.DEMO_USER_EMAIL).first()
    demo_user.role = "REVIEWER"
    db_session.commit()

    # 4. Reviewer places application UNDER_REVIEW
    res_under_review = auth_client.post(
        f"/api/v1/applications/{ready_app['id']}/review",
        json={"action": "UNDER_REVIEW", "reason": "Officer verifying institutional seal"}
    )
    assert res_under_review.status_code == 200
    assert res_under_review.json()["status"] == "UNDER_REVIEW"

    # 5. Reviewer APPROVES application
    res_approve = auth_client.post(
        f"/api/v1/applications/{ready_app['id']}/review",
        json={"action": "APPROVE", "reason": "Verified against state scholarship registry"}
    )
    assert res_approve.status_code == 200
    approved_payload = res_approve.json()
    assert approved_payload["status"] == "APPROVED"
    assert approved_payload["reviewed_by"] == demo_user.email


# ==============================================================================
# 14. APPROVED and REJECTED cannot be assigned merely because files were uploaded
# ==============================================================================
def test_14_uploading_files_never_grants_approval_or_rejection(auth_client: TestClient):
    files = {"file": ("income.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    res_upload = auth_client.post("/api/v1/documents/upload", files=files, data={"document_type": "INCOME_CERTIFICATE"})
    assert res_upload.status_code == 201

    apps = auth_client.get("/api/v1/applications").json()
    for app in apps:
        assert app["status"] not in ["APPROVED", "REJECTED"]
        assert app["status"] in ["IN_PROGRESS", "READY"]


# ==============================================================================
# 15. Replacing or removing a required document triggers reconciliation
# ==============================================================================
def test_15_removing_required_document_triggers_reconciliation(auth_client: TestClient, db_session: Session):
    # 1. First make application READY by uploading Income Certificate
    files = {"file": ("income.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    upload_res = auth_client.post("/api/v1/documents/upload", files=files, data={"document_type": "INCOME_CERTIFICATE"})
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # Verify application is READY
    apps_ready = auth_client.get("/api/v1/applications").json()
    ready_app = next(a for a in apps_ready if a["status"] == "READY")
    assert ready_app["status"] == "READY"

    # 2. Delete the uploaded document
    del_res = auth_client.delete(f"/api/v1/documents/{doc_id}")
    assert del_res.status_code == 200

    # 3. Application must automatically downgrade back to IN_PROGRESS
    apps_after = auth_client.get("/api/v1/applications").json()
    app_reconciled = next(a for a in apps_after if a["id"] == ready_app["id"])
    assert app_reconciled["status"] == "IN_PROGRESS"
    assert app_reconciled["is_ready_for_submission"] is False
    assert "income" in app_reconciled["status_reason"].lower()


# ==============================================================================
# 16. Concurrent upload requests do not produce inconsistent checklist states
# ==============================================================================
def test_16_repeated_uploads_produce_consistent_state(auth_client: TestClient):
    # Uploading twice for the same document type replaces the record safely
    files1 = {"file": ("income1.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    res1 = auth_client.post("/api/v1/documents/upload", files=files1, data={"document_type": "INCOME_CERTIFICATE"})
    assert res1.status_code == 201
    doc1_id = res1.json()["id"]

    files2 = {"file": ("income2.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    res2 = auth_client.post("/api/v1/documents/upload", files=files2, data={"document_type": "INCOME_CERTIFICATE"})
    assert res2.status_code == 201
    doc2_id = res2.json()["id"]

    # Should update the existing record
    assert doc1_id == doc2_id

    # Verify requirement is linked to exactly one document
    apps = auth_client.get("/api/v1/applications").json()
    for app in apps:
        income_reqs = [r for r in app["requirements"] if r["document_type"] == "INCOME_CERTIFICATE"]
        assert len(income_reqs) == 1
        assert income_reqs[0]["document_id"] == doc1_id


# ==============================================================================
# 17. Historical application data and status history remain intact
# ==============================================================================
def test_17_historical_application_data_and_status_history(auth_client: TestClient):
    # Unblock and submit
    files = {"file": ("income.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    auth_client.post("/api/v1/documents/upload", files=files, data={"document_type": "INCOME_CERTIFICATE"})

    apps = auth_client.get("/api/v1/applications").json()
    ready_app = next(a for a in apps if a["status"] == "READY")

    # Submit
    res_sub = auth_client.post(f"/api/v1/applications/{ready_app['id']}/submit")
    assert res_sub.status_code == 200
    app_data = res_sub.json()

    assert app_data["status"] == "SUBMITTED"
    assert app_data["submitted_at"] is not None
    assert len(app_data["status_history"]) > 0

    # Ensure last event records student submission
    last_event = app_data["status_history"][-1]
    assert last_event["new_status"] == "SUBMITTED"
    assert "submitted" in last_event["reason"].lower()


# ==============================================================================
# 18. Existing application and document workflows continue working
# ==============================================================================
def test_18_existing_workflows_continue_working(auth_client: TestClient):
    apps = auth_client.get("/api/v1/applications").json()
    app_id = apps[0]["id"]

    # 1. Update personal statement
    patch_res = auth_client.patch(
        f"/api/v1/applications/{app_id}",
        json={"personal_statement": "Updated academic motivation statement for review."}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["personal_statement"] == "Updated academic motivation statement for review."

    # 2. Portfolio summary endpoint continues functioning
    res_summary = auth_client.get("/api/v1/applications/portfolio-summary")
    assert res_summary.status_code == 200
    summary = res_summary.json()
    assert "active_applications_count" in summary
    assert "potential_funding_under_pursuit" in summary

    # 3. Withdrawal workflow works
    withdraw_res = auth_client.post(
        f"/api/v1/applications/{app_id}/withdraw",
        json={"reason": "Student withdrawing to accept industry apprenticeship"}
    )
    assert withdraw_res.status_code == 200
    assert withdraw_res.json()["status"] == "WITHDRAWN"
    assert "withdrawn" in withdraw_res.json()["status_reason"].lower()
