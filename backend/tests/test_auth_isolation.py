import time
import pytest
from fastapi.testclient import TestClient
from app.core.config import settings
from app.core.security import create_session_token
from app.models.document import Document
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.models.action import Action
from app.models.evidence import Evidence
from app.models.notification import Notification
from app.models.scholarship import Scholarship


def test_unauthenticated_requests_reject_with_401(client: TestClient):
    """
    Verify that ALL protected domain endpoints reject unauthenticated requests with HTTP 401.
    Demo user fallback must NOT trigger in any environment.
    """
    protected_endpoints = [
        ("GET", "/api/v1/student/me"),
        ("PUT", "/api/v1/student/me"),
        ("GET", "/api/v1/student/funding"),
        ("GET", "/api/v1/scholarships"),
        ("GET", "/api/v1/scholarships/recommended"),
        ("GET", "/api/v1/scholarships/1"),
        ("GET", "/api/v1/scholarships/1/eligibility"),
        ("POST", "/api/v1/scholarships/1/apply"),
        ("GET", "/api/v1/applications"),
        ("GET", "/api/v1/applications/portfolio-summary"),
        ("GET", "/api/v1/applications/1"),
        ("POST", "/api/v1/applications"),
        ("PATCH", "/api/v1/applications/1"),
        ("GET", "/api/v1/applications/1/requirements"),
        ("PATCH", "/api/v1/applications/1/requirements/1"),
        ("POST", "/api/v1/applications/1/draft"),
        ("POST", "/api/v1/applications/1/review"),
        ("POST", "/api/v1/applications/1/evidence-check"),
        ("GET", "/api/v1/documents"),
        ("POST", "/api/v1/documents"),
        ("PATCH", "/api/v1/documents/1"),
        ("GET", "/api/v1/actions"),
        ("PATCH", "/api/v1/actions/1/toggle"),
        ("GET", "/api/v1/planner"),
        ("POST", "/api/v1/planner"),
        ("GET", "/api/v1/evidence"),
        ("POST", "/api/v1/evidence"),
        ("GET", "/api/v1/evidence/1"),
        ("PATCH", "/api/v1/evidence/1"),
        ("DELETE", "/api/v1/evidence/1"),
        ("POST", "/api/v1/assistant/chat"),
        ("GET", "/api/v1/notifications"),
        ("PATCH", "/api/v1/notifications/1/read"),
        ("POST", "/api/v1/notifications/mark-all-read"),
        ("POST", "/api/v1/voice/interpret"),
        ("POST", "/api/v1/monitoring/check"),
    ]

    for method, endpoint in protected_endpoints:
        if method == "GET":
            r = client.get(endpoint)
        elif method == "POST":
            r = client.post(endpoint, json={})
        elif method == "PUT":
            r = client.put(endpoint, json={})
        elif method == "PATCH":
            r = client.patch(endpoint, json={})
        elif method == "DELETE":
            r = client.delete(endpoint)

        assert r.status_code == 401, f"Expected 401 for {method} {endpoint}, got {r.status_code}: {r.text}"


def test_tampered_and_expired_session_tokens_reject_with_401(client: TestClient, monkeypatch):
    """
    Verify that tampered, expired, or malformed tokens return 401.
    """
    # 1. Invalid signature
    client.cookies.set(settings.SESSION_COOKIE_NAME, "fake.invalid.signature")
    r = client.get("/api/v1/student/me")
    assert r.status_code == 401

    # 2. Expired token
    monkeypatch.setattr(settings, "SESSION_MAX_AGE_SECONDS", -10)
    expired_token = create_session_token(user_id=1, email="demo@scholarai.local")
    monkeypatch.undo()
    client.cookies.set(settings.SESSION_COOKIE_NAME, expired_token)
    r = client.get("/api/v1/student/me")
    assert r.status_code == 401
    assert "expired" in r.json().get("detail", "").lower()

    # 3. Nonexistent user ID in validly signed token
    ghost_token = create_session_token(user_id=999999, email="ghost@scholarai.local")
    client.cookies.set(settings.SESSION_COOKIE_NAME, ghost_token)
    r = client.get("/api/v1/student/me")
    assert r.status_code == 401


def test_multi_tenant_data_isolation_between_accounts(create_authenticated_client, db_session):
    """
    Verify that User B cannot see User A's profile, applications, documents, or evidence in listings.
    """
    client_a, user_a, student_a = create_authenticated_client("alice@example.com", "Alice User")
    client_b, user_b, student_b = create_authenticated_client("bob@example.com", "Bob User")

    # 1. Profiles are isolated
    res_a = client_a.get("/api/v1/student/me")
    assert res_a.status_code == 200
    assert res_a.json()["name"] == "Alice User"
    assert res_a.json()["email"] == "alice@example.com"

    res_b = client_b.get("/api/v1/student/me")
    assert res_b.status_code == 200
    assert res_b.json()["name"] == "Bob User"
    assert res_b.json()["email"] == "bob@example.com"

    # 2. Documents are isolated
    doc_payload = {
        "name": "Alice Marksheet",
        "document_type": "MARKSHEET",
        "status": "AVAILABLE",
        "notes": "Alice's official transcript",
    }
    create_doc = client_a.post("/api/v1/documents", json=doc_payload)
    assert create_doc.status_code == 201

    docs_b = client_b.get("/api/v1/documents").json()
    assert not any(d["name"] == "Alice Marksheet" for d in docs_b)

    # 3. Applications are isolated
    scholarship = db_session.query(Scholarship).first()
    app_payload = {"scholarship_id": scholarship.id}
    create_app = client_a.post("/api/v1/applications", json=app_payload)
    assert create_app.status_code == 201
    alice_app_id = create_app.json()["id"]

    apps_b = client_b.get("/api/v1/applications").json()
    assert not any(a["id"] == alice_app_id for a in apps_b)

    # 4. Evidence Bank is isolated
    ev_payload = {
        "title": "Alice Hackathon Win",
        "category": "PROJECT",
        "description": "First place in cloud computing",
        "date": "2025",
        "organization": "ACM Chapter",
    }
    create_ev = client_a.post("/api/v1/evidence", json=ev_payload)
    assert create_ev.status_code == 201
    alice_ev_id = create_ev.json()["id"]

    evs_b = client_b.get("/api/v1/evidence").json()
    assert not any(e["id"] == alice_ev_id for e in evs_b)


def test_cross_account_read_rejections_403(create_authenticated_client, db_session):
    """
    Verify that User B receives HTTP 403 Forbidden when attempting to read User A's private resources.
    """
    client_a, user_a, student_a = create_authenticated_client("alice_read@example.com", "Alice Read")
    client_b, user_b, student_b = create_authenticated_client("bob_read@example.com", "Bob Read")

    scholarship = db_session.query(Scholarship).first()

    # User A creates application
    app_a = client_a.post("/api/v1/applications", json={"scholarship_id": scholarship.id}).json()
    app_id = app_a["id"]

    # User B attempts to read User A's application -> 403
    r_app = client_b.get(f"/api/v1/applications/{app_id}")
    assert r_app.status_code == 403
    assert "permission" in r_app.json()["detail"].lower() or "forbidden" in r_app.json()["detail"].lower()

    # User B attempts to read User A's application requirements -> 403
    r_reqs = client_b.get(f"/api/v1/applications/{app_id}/requirements")
    assert r_reqs.status_code == 403

    # User A creates evidence item
    ev_a = client_a.post("/api/v1/evidence", json={
        "title": "Alice Private Award",
        "category": "ACADEMIC",
        "description": "Top scorer award",
        "date": "2025",
        "organization": "College",
    }).json()
    ev_id = ev_a["id"]

    # User B attempts to read User A's evidence item -> 403
    r_ev = client_b.get(f"/api/v1/evidence/{ev_id}")
    assert r_ev.status_code == 403


def test_cross_account_mutation_rejections_403(create_authenticated_client, db_session):
    """
    Verify that User B receives HTTP 403 Forbidden when attempting to mutate User A's resources.
    """
    client_a, user_a, student_a = create_authenticated_client("alice_mut@example.com", "Alice Mut")
    client_b, user_b, student_b = create_authenticated_client("bob_mut@example.com", "Bob Mut")

    scholarship = db_session.query(Scholarship).first()

    # 1. Cross-account application update
    app_a = client_a.post("/api/v1/applications", json={"scholarship_id": scholarship.id}).json()
    app_id = app_a["id"]
    r_patch_app = client_b.patch(f"/api/v1/applications/{app_id}", json={"personal_statement": "Hacked statement"})
    assert r_patch_app.status_code == 403

    # 2. Cross-account application requirement update
    req_id = app_a["requirements"][0]["id"]
    r_patch_req = client_b.patch(
        f"/api/v1/applications/{app_id}/requirements/{req_id}",
        json={"status": "VERIFIED"}
    )
    assert r_patch_req.status_code == 403

    # 3. Cross-account document update
    doc_a = client_a.post("/api/v1/documents", json={
        "name": "Alice Domicile",
        "document_type": "DOMICILE_CERTIFICATE",
        "status": "MISSING",
    }).json()
    doc_id = doc_a["id"]
    r_patch_doc = client_b.patch(f"/api/v1/documents/{doc_id}", json={"status": "VERIFIED"})
    assert r_patch_doc.status_code == 403

    # 4. Cross-account evidence update and delete
    ev_a = client_a.post("/api/v1/evidence", json={
        "title": "Alice Research Paper",
        "category": "ACADEMIC",
        "description": "Published paper",
        "date": "2024",
        "organization": "IEEE",
    }).json()
    ev_id = ev_a["id"]
    r_patch_ev = client_b.patch(f"/api/v1/evidence/{ev_id}", json={"title": "Hacked Paper"})
    assert r_patch_ev.status_code == 403

    r_del_ev = client_b.delete(f"/api/v1/evidence/{ev_id}")
    assert r_del_ev.status_code == 403

    # 5. Cross-account notification mark-read
    notif = Notification(
        student_id=student_a.id,
        type="DEADLINE",
        title="Alice Urgent Alert",
        message="Your application deadline is tomorrow.",
        severity="URGENT",
        read=False,
    )
    db_session.add(notif)
    db_session.commit()
    db_session.refresh(notif)

    r_patch_notif = client_b.patch(f"/api/v1/notifications/{notif.id}/read")
    assert r_patch_notif.status_code == 403

    # 6. Cross-account action toggle
    action = Action(
        student_id=student_a.id,
        title="Upload Income Certificate",
        reason="Required to unblock application",
        action_type="UPLOAD_DOCUMENT",
        urgency="HIGH",
        is_completed=False,
    )
    db_session.add(action)
    db_session.commit()
    db_session.refresh(action)

    r_toggle_action = client_b.patch(f"/api/v1/actions/{action.id}/toggle")
    assert r_toggle_action.status_code == 403


def test_cross_account_application_ai_ownership_rejections_403(create_authenticated_client, db_session):
    """
    Verify that User B cannot invoke AI drafting, review, or evidence checks
    on User A's applications.
    """
    client_a, user_a, student_a = create_authenticated_client("alice_ai@example.com", "Alice AI")
    client_b, user_b, student_b = create_authenticated_client("bob_ai@example.com", "Bob AI")

    scholarship = db_session.query(Scholarship).first()
    app_a = client_a.post("/api/v1/applications", json={"scholarship_id": scholarship.id}).json()
    app_id = app_a["id"]

    # 1. AI Draft attempt on another user's application -> 403
    r_draft = client_b.post(f"/api/v1/applications/{app_id}/draft", json={
        "question": "Why do you deserve this award?"
    })
    assert r_draft.status_code == 403
    assert "permission" in r_draft.json()["detail"].lower() or "forbidden" in r_draft.json()["detail"].lower()

    # 2. AI Review attempt on another user's application -> 403
    r_review = client_b.post(f"/api/v1/applications/{app_id}/review", json={
        "question": "Describe challenges",
        "answer_text": "My answer..."
    })
    assert r_review.status_code == 403

    # 3. AI Evidence check attempt on another user's application -> 403
    r_check = client_b.post(f"/api/v1/applications/{app_id}/evidence-check", json={
        "draft_text": "I won first place..."
    })
    assert r_check.status_code == 403


def test_session_cookie_security_attributes_dev_and_prod(client: TestClient, monkeypatch):
    """
    Verify cookie configuration:
    - In development (ENVIRONMENT != "production"): samesite="lax", secure=False.
    - In production (ENVIRONMENT == "production"): samesite="none", secure=True.
    """
    # 1. Development login cookie check
    reg_dev = {
        "email": "cookie_dev@example.com",
        "password": "Password123!",
        "name": "Cookie Dev",
    }
    res_dev = client.post("/api/v1/auth/register", json=reg_dev)
    assert res_dev.status_code == 201
    cookie_header_dev = res_dev.headers.get("set-cookie", "")
    assert settings.SESSION_COOKIE_NAME in cookie_header_dev
    assert "httponly" in cookie_header_dev.lower()
    assert "samesite=lax" in cookie_header_dev.lower()
    assert "secure" not in cookie_header_dev.lower()

    # 2. Production login cookie check
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    reg_prod = {
        "email": "cookie_prod@example.com",
        "password": "Password123!",
        "name": "Cookie Prod",
    }
    res_prod = client.post("/api/v1/auth/register", json=reg_prod)
    assert res_prod.status_code == 201
    cookie_header_prod = res_prod.headers.get("set-cookie", "")
    assert settings.SESSION_COOKIE_NAME in cookie_header_prod
    assert "httponly" in cookie_header_prod.lower()
    assert "samesite=none" in cookie_header_prod.lower()
    assert "secure" in cookie_header_prod.lower()
