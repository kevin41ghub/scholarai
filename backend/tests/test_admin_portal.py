import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.student import Student
from app.models.scholarship import Scholarship
from app.models.application import Application
from app.core.security import create_session_token, hash_password
from app.core.config import settings


@pytest.fixture
def admin_user(db_session: Session) -> User:
    email = "admin_test@scholarai.local"
    user = db_session.query(User).filter(User.email == email).first()
    if not user:
        student = Student(name="Admin Tester", email=email, phone="9999999999")
        db_session.add(student)
        db_session.flush()
        pwd_hash, salt = hash_password("AdminSecurePassword123!")
        user = User(
            email=email,
            password_hash=pwd_hash,
            salt=salt,
            role="ADMIN",
            student_id=student.id,
            is_active=True,
            is_demo=False,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
    return user


@pytest.fixture
def student_user(db_session: Session) -> User:
    email = "student_test@scholarai.local"
    user = db_session.query(User).filter(User.email == email).first()
    if not user:
        student = Student(name="Student Tester", email=email, phone="8888888888")
        db_session.add(student)
        db_session.flush()
        pwd_hash, salt = hash_password("StudentSecurePassword123!")
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
    return user


def test_admin_routes_reject_unauthenticated(client: TestClient):
    """Unauthenticated requests must be rejected with 401 across admin endpoints."""
    endpoints = [
        "/api/v1/admin/overview",
        "/api/v1/admin/users",
        "/api/v1/admin/documents",
        "/api/v1/admin/scholarships",
        "/api/v1/admin/applications",
        "/api/v1/admin/ai/diagnostic",
        "/api/v1/admin/audit-logs",
    ]
    for ep in endpoints:
        resp = client.get(ep)
        assert resp.status_code == 401, f"Expected 401 for unauthenticated {ep}, got {resp.status_code}"


def test_admin_routes_reject_student_role(client: TestClient, student_user: User):
    """Ordinary students must be rejected with 403 Forbidden on admin endpoints."""
    token = create_session_token(student_user.id, student_user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    endpoints = [
        "/api/v1/admin/overview",
        "/api/v1/admin/users",
        "/api/v1/admin/documents",
        "/api/v1/admin/scholarships",
        "/api/v1/admin/applications",
        "/api/v1/admin/ai/diagnostic",
        "/api/v1/admin/audit-logs",
    ]
    for ep in endpoints:
        resp = client.get(ep)
        assert resp.status_code == 403, f"Expected 403 for student on {ep}, got {resp.status_code}"


def test_admin_overview_success(client: TestClient, admin_user: User):
    """Admin user can retrieve system aggregations and AI health."""
    token = create_session_token(admin_user.id, admin_user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    resp = client.get("/api/v1/admin/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_users" in data
    assert "total_scholarships" in data
    assert "total_applications" in data
    assert "applications_by_status" in data
    assert "ai_status" in data
    assert "database_health" in data
    assert data["database_health"]["status"] == "HEALTHY"
    assert "storage_health" in data
    assert data["storage_health"]["status"] == "HEALTHY"
    assert isinstance(data["total_users"], int)
    assert data["total_users"] >= 1


def test_admin_scholarship_list_and_retire(client: TestClient, admin_user: User, db_session: Session):
    """Admin user can list scholarships and non-destructively retire one."""
    token = create_session_token(admin_user.id, admin_user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    resp = client.get("/api/v1/admin/scholarships")
    assert resp.status_code == 200
    data = resp.json()
    assert "scholarships" in data
    assert len(data["scholarships"]) > 0

    first_sc = data["scholarships"][0]
    sc_id = first_sc["id"]

    # Retire the scholarship
    retire_resp = client.post(f"/api/v1/admin/scholarships/{sc_id}/retire")
    assert retire_resp.status_code == 200
    retire_data = retire_resp.json()
    assert retire_data["status"] == "INACTIVE"

    # Verify still in DB
    refetched = db_session.query(Scholarship).filter(Scholarship.id == sc_id).first()
    assert refetched is not None
    assert refetched.status == "INACTIVE"


def test_admin_application_queue_and_history(client: TestClient, admin_user: User, db_session: Session):
    """Admin user can view application queue and audit history."""
    token = create_session_token(admin_user.id, admin_user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    resp = client.get("/api/v1/admin/applications")
    assert resp.status_code == 200
    data = resp.json()
    assert "applications" in data

    if len(data["applications"]) > 0:
        first_app = data["applications"][0]
        app_id = first_app["id"]

        hist_resp = client.get(f"/api/v1/admin/applications/{app_id}/history")
        assert hist_resp.status_code == 200
        hist_data = hist_resp.json()
        assert "history" in hist_data


def test_admin_ai_diagnostic_endpoint(client: TestClient, admin_user: User):
    """Admin user can retrieve AI diagnostic without exposing sensitive secrets."""
    token = create_session_token(admin_user.id, admin_user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    resp = client.get("/api/v1/admin/ai/diagnostic")
    assert resp.status_code == 200
    data = resp.json()
    assert "provider" in data
    assert "configured" in data
    assert "connectivity" in data
    # Ensure raw API keys are never exposed in the response
    raw_str = resp.text
    assert "AIza" not in raw_str
    assert "sk-" not in raw_str


def test_admin_users_list(client: TestClient, admin_user: User):
    """Admin user can list registered users and their student profile links."""
    token = create_session_token(admin_user.id, admin_user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    resp = client.get("/api/v1/admin/users")
    assert resp.status_code == 200
    data = resp.json()
    assert "users" in data
    assert "total" in data
    assert data["total"] >= 1
    assert any(u["email"] == admin_user.email for u in data["users"])


def test_admin_documents_list(client: TestClient, admin_user: User):
    """Admin user can monitor all student document records."""
    token = create_session_token(admin_user.id, admin_user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    resp = client.get("/api/v1/admin/documents")
    assert resp.status_code == 200
    data = resp.json()
    assert "documents" in data
    assert "total" in data
    assert isinstance(data["documents"], list)
