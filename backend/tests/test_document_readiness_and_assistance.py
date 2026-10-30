import io
import pytest
from fastapi.testclient import TestClient

VALID_PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 53 >>\nstream\nBT /F1 12 Tf 100 700 Td (This is to certify that Arjun Kumar) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n308\n%%EOF"


def test_documents_readiness_checklist_and_why_requested(auth_client: TestClient, db_session):
    # Call readiness endpoint for authenticated student
    res = auth_client.get("/api/v1/documents/readiness")
    assert res.status_code == 200, res.text
    data = res.json()

    assert "total_documents_uploaded" in data
    assert "total_verified_documents" in data
    assert "readiness_items" in data
    assert "privacy_guarantees" in data

    # Verify privacy and security disclaimers
    privacy = data["privacy_guarantees"]
    assert privacy["uploads_optional"] is True
    assert "official" in privacy["official_submission_notice"].lower()
    assert "never auto-submit" in privacy["official_submission_notice"].lower()

    # Check scholarship checklist items
    items = data["readiness_items"]
    assert len(items) > 0

    first_item = items[0]
    assert "scholarship_name" in first_item
    assert "readiness_status" in first_item
    assert first_item["readiness_status"] in ["READY", "MISSING_DOCUMENTS", "NEEDS_REVIEW"]
    assert len(first_item["checklist"]) > 0

    # Ensure each checklist item explains why requested
    for check in first_item["checklist"]:
        assert "why_requested" in check
        assert len(check["why_requested"]) > 10
        assert "is_uploaded" in check


def test_student_confirm_extracted_details_and_profile_sync(auth_client: TestClient, db_session):
    # 1. Upload a valid PDF income certificate
    file_payload = {
        "file": ("income_cert.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")
    }
    upload_res = auth_client.post(
        "/api/v1/documents/upload",
        files=file_payload,
        data={"document_type": "INCOME_CERTIFICATE", "notes": "Issued by Tahsildar Office"},
    )
    assert upload_res.status_code == 201, upload_res.text
    doc_data = upload_res.json()
    doc_id = doc_data["id"]

    # 2. Confirm AI-extracted details with review and apply to profile
    confirmed_fields = {
        "student_name": "Arjun Kumar",
        "annual_income": 195000,
        "certificate_number": "TN-REV-2025-99881",
        "issuing_authority": "Revenue Department",
    }
    confirm_res = auth_client.post(
        f"/api/v1/documents/{doc_id}/confirm-extracted",
        json={
            "confirmed_fields": confirmed_fields,
            "apply_to_profile": True,
        },
    )
    assert confirm_res.status_code == 200, confirm_res.text
    updated_doc = confirm_res.json()

    assert updated_doc["extracted_data"]["student_confirmed"] is True
    assert updated_doc["extracted_data"]["extracted_fields"]["annual_income"] == 195000
    assert updated_doc["extracted_data"]["extracted_fields"]["certificate_number"] == "TN-REV-2025-99881"

    # Verify audit history
    audit_events = updated_doc["audit_history"]
    assert any(e["action"] == "STUDENT_CONFIRMED_EXTRACTED_DATA" for e in audit_events)

    # 3. Check student profile reflects the confirmed annual income
    prof_res = auth_client.get("/api/v1/student/me")
    assert prof_res.status_code == 200
    prof = prof_res.json()
    assert prof["funding_profile"]["annual_family_income"] == 195000


def test_documents_readiness_cross_student_isolation(client: TestClient, db_session):
    # Register student beta
    reg_res = client.post("/api/v1/auth/register", json={
        "email": "beta_isolated_user@example.com",
        "password": "Password123!",
        "name": "Beta Student",
    })
    assert reg_res.status_code in [200, 201], reg_res.text
    token_beta = reg_res.json()["session_token"]
    headers_beta = {"Authorization": f"Bearer {token_beta}"}

    # Register student alpha
    reg_res2 = client.post("/api/v1/auth/register", json={
        "email": "alpha_isolated_user@example.com",
        "password": "Password123!",
        "name": "Alpha Student",
    })
    assert reg_res2.status_code in [200, 201], reg_res2.text
    token_alpha = reg_res2.json()["session_token"]
    headers_alpha = {"Authorization": f"Bearer {token_alpha}"}

    # Alpha uploads a document
    upload_res = client.post(
        "/api/v1/documents/upload",
        files={"file": ("alpha_id.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"document_type": "ID_PROOF"},
        headers=headers_alpha,
    )
    assert upload_res.status_code == 201
    alpha_doc_id = upload_res.json()["id"]

    # Beta attempts to confirm or access Alpha's document
    client.cookies.clear()
    forbidden_res = client.post(
        f"/api/v1/documents/{alpha_doc_id}/confirm-extracted",
        json={"confirmed_fields": {"student_name": "Hacker"}, "apply_to_profile": False},
        headers=headers_beta,
    )
    assert forbidden_res.status_code in [403, 404]
