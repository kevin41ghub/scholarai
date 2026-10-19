import io
import pytest
from fastapi.testclient import TestClient
from app.models.document import Document
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.models.scholarship import Scholarship
from app.models.user import User
from app.services.storage_service import storage_service

# Valid minimal PDF bytes
VALID_PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 53 >>\nstream\nBT /F1 12 Tf 100 700 Td (This is to certify that Arjun Kumar) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n308\n%%EOF"

# Valid minimal 1x1 PNG bytes
VALID_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\xa74U\xa6\x00\x00\x00\x00IEND\xaeB`\x82"


def test_valid_pdf_upload(auth_client: TestClient, db_session):
    """Verify that a valid PDF can be uploaded, stored, extracted, and verified."""
    files = {"file": ("income_cert.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    data = {"document_type": "INCOME_CERTIFICATE", "notes": "Issued by Tahsildar"}

    res = auth_client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == 201
    payload = res.json()

    assert payload["document_type"] == "INCOME_CERTIFICATE"
    assert payload["mime_type"] == "application/pdf"
    assert payload["file_size"] == len(VALID_PDF_BYTES)
    assert payload["content_hash"] is not None
    assert payload["storage_key"] is not None
    assert payload["verification_status"] in ["AUTOMATED_CHECKS_PASSED", "NEEDS_HUMAN_REVIEW"]
    assert len(payload["verification_results"]) > 0

    # Ensure document exists in database
    doc_in_db = db_session.query(Document).filter(Document.id == payload["id"]).first()
    assert doc_in_db is not None
    assert doc_in_db.storage_key == payload["storage_key"]

    # Verify physical/cloud retrieval
    retrieved = storage_service.retrieve_document(doc_in_db.storage_key)
    assert retrieved == VALID_PDF_BYTES


def test_valid_png_upload(auth_client: TestClient, db_session):
    """Verify that a valid PNG image can be uploaded and processed."""
    files = {"file": ("marksheet.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    data = {"document_type": "10TH_MARKSHEET"}

    res = auth_client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == 201
    payload = res.json()

    assert payload["document_type"] == "10TH_MARKSHEET"
    assert payload["mime_type"] == "image/png"
    assert payload["file_size"] == len(VALID_PNG_BYTES)


def test_spoofed_mime_type_rejected(auth_client: TestClient):
    """Verify that spoofed MIME/extension without valid magic bytes is rejected."""
    fake_pdf = b"NOT_A_REAL_PDF_THIS_IS_PLAIN_TEXT"
    files = {"file": ("malicious.pdf", io.BytesIO(fake_pdf), "application/pdf")}
    data = {"document_type": "INCOME_CERTIFICATE"}

    res = auth_client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == 400
    assert "header signature does not match" in res.json()["detail"].lower()


def test_empty_file_rejected(auth_client: TestClient):
    """Verify that 0-byte uploads are rejected with 400."""
    files = {"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")}
    data = {"document_type": "INCOME_CERTIFICATE"}

    res = auth_client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == 400
    assert "empty file" in res.json()["detail"].lower()


def test_unsupported_file_extension(auth_client: TestClient):
    """Verify that non-whitelisted file extensions (.exe, .sh, .docx) are rejected."""
    files = {"file": ("script.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")}
    data = {"document_type": "INCOME_CERTIFICATE"}

    res = auth_client.post("/api/v1/documents/upload", files=files, data=data)
    assert res.status_code == 400
    assert "unsupported file extension" in res.json()["detail"].lower()


def test_download_and_preview_endpoints(auth_client: TestClient):
    """Verify authenticated download with proper Content-Disposition and security headers."""
    files = {"file": ("income.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    upload_res = auth_client.post("/api/v1/documents/upload", files=files, data={"document_type": "INCOME_CERTIFICATE"})
    doc_id = upload_res.json()["id"]

    # 1. Download attachment
    dl_res = auth_client.get(f"/api/v1/documents/{doc_id}/download?inline=false")
    assert dl_res.status_code == 200
    assert dl_res.content == VALID_PDF_BYTES
    assert "attachment" in dl_res.headers.get("content-disposition", "")
    assert dl_res.headers.get("x-content-type-options") == "nosniff"

    # 2. Preview inline
    preview_res = auth_client.get(f"/api/v1/documents/{doc_id}/download?inline=true")
    assert preview_res.status_code == 200
    assert preview_res.content == VALID_PDF_BYTES
    assert "inline" in preview_res.headers.get("content-disposition", "")


def test_multi_tenant_isolation_on_documents(auth_client: TestClient, create_authenticated_client, db_session):
    """
    Strict isolation: Student B must NOT be able to view, download, re-extract,
    or delete Student A's documents.
    """
    # Student A uploads document
    files = {"file": ("student_a_cert.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    res_a = auth_client.post("/api/v1/documents/upload", files=files, data={"document_type": "DOMICILE_CERTIFICATE"})
    assert res_a.status_code == 201
    doc_id = res_a.json()["id"]

    # Student B creates session
    client_b, user_b, student_b = create_authenticated_client(email="student_b@example.com", name="Student B")

    # Student B attempts to get details
    get_res = client_b.get(f"/api/v1/documents/{doc_id}")
    assert get_res.status_code == 403

    # Student B attempts to download
    dl_res = client_b.get(f"/api/v1/documents/{doc_id}/download")
    assert dl_res.status_code == 403

    # Student B attempts to re-extract
    rex_res = client_b.post(f"/api/v1/documents/{doc_id}/re-extract")
    assert rex_res.status_code == 403

    # Student B attempts to delete
    del_res = client_b.delete(f"/api/v1/documents/{doc_id}")
    assert del_res.status_code == 403


def test_re_extract_document_updates_results(auth_client: TestClient):
    """Verify that re-extraction triggers extraction and re-verification."""
    files = {"file": ("cert.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    upload_res = auth_client.post("/api/v1/documents/upload", files=files, data={"document_type": "INCOME_CERTIFICATE"})
    doc_id = upload_res.json()["id"]

    rex_res = auth_client.post(f"/api/v1/documents/{doc_id}/re-extract")
    assert rex_res.status_code == 200
    data = rex_res.json()
    assert data["id"] == doc_id
    assert any(event["action"] == "RE_EXTRACT" for event in data["audit_history"])


def test_delete_document_cleans_up_storage(auth_client: TestClient, db_session):
    """Verify that deleting a document removes the file from storage and database."""
    files = {"file": ("to_delete.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    upload_res = auth_client.post("/api/v1/documents/upload", files=files, data={"document_type": "CASTE_CERTIFICATE"})
    doc_id = upload_res.json()["id"]
    storage_key = upload_res.json()["storage_key"]

    # Verify storage file exists before deletion
    assert storage_service.backend.file_exists(storage_key) is True

    # Delete
    del_res = auth_client.delete(f"/api/v1/documents/{doc_id}")
    assert del_res.status_code == 200

    # Verify database record deleted
    assert db_session.query(Document).filter(Document.id == doc_id).first() is None

    # Verify physical file removed
    assert storage_service.backend.file_exists(storage_key) is False


def test_reviewer_authorization_and_workflow(auth_client: TestClient, db_session):
    """
    Authorized reviewer workflow:
    - Normal student cannot approve documents (rejected with 403)
    - Reviewer can officially approve or reject with reason
    """
    files = {"file": ("doc_for_review.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    upload_res = auth_client.post("/api/v1/documents/upload", files=files, data={"document_type": "BONAFIDE_CERTIFICATE"})
    doc_id = upload_res.json()["id"]

    # Regular student attempts to review
    fail_res = auth_client.post(
        f"/api/v1/documents/{doc_id}/review",
        json={"action": "APPROVE", "reason": "Self approval attempt"},
    )
    assert fail_res.status_code == 403
    assert "reviewer role required" in fail_res.json()["detail"].lower()

    # Promote user to REVIEWER role
    user = db_session.query(User).filter(User.student_id == upload_res.json()["student_id"]).first()
    user.role = "REVIEWER"
    db_session.commit()

    # Reviewer approves document
    approve_res = auth_client.post(
        f"/api/v1/documents/{doc_id}/review",
        json={"action": "APPROVE", "reason": "Institutional seal and signature validated by officer"},
    )
    assert approve_res.status_code == 200
    approved_data = approve_res.json()
    assert approved_data["verification_status"] == "OFFICIALLY_VERIFIED"
    assert approved_data["status"] == "VERIFIED"
    assert approved_data["reviewed_by"] == user.email
    assert any(e["action"] == "REVIEW_APPROVE" for e in approved_data["audit_history"])


def test_cascade_unblocking_on_upload(auth_client: TestClient, db_session):
    """
    Verify that uploading a document cascades to active applications requiring that document type.
    """
    # 1. Fetch current student and an unused scholarship
    from app.models.student import Student
    from app.core.config import settings

    user = db_session.query(User).filter(User.email == settings.DEMO_USER_EMAIL).first()
    student = db_session.query(Student).filter(Student.id == user.student_id).first()
    # Find a scholarship without an existing application for this student
    existing_scholarship_ids = [
        app.scholarship_id for app in db_session.query(Application).filter(Application.student_id == student.id).all()
    ]
    scholarship = (
        db_session.query(Scholarship)
        .filter(~Scholarship.id.in_(existing_scholarship_ids))
        .first()
    )

    # 2. Create application with MISSING requirement
    app = Application(
        student_id=student.id,
        scholarship_id=scholarship.id,
        status="IN_PROGRESS",
        progress=0.0,
    )
    db_session.add(app)
    db_session.flush()

    req = ApplicationRequirement(
        application_id=app.id,
        name="Income Certificate Required",
        document_type="INCOME_CERTIFICATE",
        status="MISSING",
        is_required=True,
    )
    db_session.add(req)
    db_session.commit()

    # 3. Upload document of that type
    files = {"file": ("income.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    upload_res = auth_client.post(
        "/api/v1/documents/upload",
        files=files,
        data={"document_type": "INCOME_CERTIFICATE"},
    )
    assert upload_res.status_code == 201

    # 4. Check that requirement status was updated and linked
    db_session.refresh(req)
    db_session.refresh(app)
    assert req.document_id == upload_res.json()["id"]
    assert req.status in ["AVAILABLE", "VERIFIED"]
    assert app.progress > 0.0
