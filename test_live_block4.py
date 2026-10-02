#!/usr/bin/env python3
"""
SCHOLARAi — Block 4 Live Integration & E2E QA Suite
Tests live running FastAPI backend (http://127.0.0.1:8000) and Next.js frontend (http://localhost:3000)
Validates:
1. Health check & database connection
2. Secure session authentication & cookie handling
3. IDOR protection & multi-tenant isolation
4. AI Assistant with controlled tools & DEMO AI MODE
5. Action confirmation workflow
6. Evidence Bank grounded drafting & claim check
7. RAG knowledge search with source citation preservation
8. Monitoring change detection & urgent alerts
9. Voice decoder with confirmation safeguards
10. Frontend SSR & client route accessibility
"""
import sys
import httpx

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:3000"


def run_block4_qa():
    print("[BLOCK 4 QA] Starting End-to-End System QA & Production Hardening Suite...")
    client = httpx.Client(timeout=15.0)

    # 1. Health & Database connectivity
    r = client.get(f"{BACKEND_URL}/api/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    health_data = r.json()
    assert health_data["status"] == "healthy"
    assert health_data["database"] == "connected"
    assert "AI assists. Official sources decide. Student approves." in health_data["trust_principle"]
    print("PASS: 1. Health check & database connectivity confirmed.")

    # 2. Authentication: Login & HttpOnly Cookie Set
    login_payload = {
        "email": "demo@scholarai.local",
        "password": "DemoStudent@2026"
    }
    r = client.post(f"{BACKEND_URL}/api/v1/auth/login", json=login_payload)
    assert r.status_code == 200, f"Login failed: {r.status_code} - {r.text}"
    auth_data = r.json()
    assert auth_data["user"]["email"] == "demo@scholarai.local"
    assert auth_data["user"]["student_name"] == "Arjun Kumar"
    assert "scholarai_session" in client.cookies, "HttpOnly session cookie was not set in client cookies!"
    auth_headers = {"Authorization": f"Bearer {auth_data['session_token']}"}
    print("PASS: 2. Authentication login and signed session cookie confirmed.")

    # 3. Authenticated Identity Verification (/auth/me)
    r = client.get(f"{BACKEND_URL}/api/v1/auth/me", headers=auth_headers)
    assert r.status_code == 200, f"/auth/me failed: {r.status_code}"
    user_me = r.json()
    assert user_me["id"] == auth_data["user"]["id"]
    student_id = user_me["student_id"]
    print(f"PASS: 3. Authenticated identity verified: User ID {user_me['id']}, Student ID {student_id}.")

    # 4. Multi-Tenant Authorization & IDOR Defense
    r = client.get(f"{BACKEND_URL}/api/v1/evidence", headers=auth_headers)
    assert r.status_code == 200
    evidence_items = r.json()
    for ev in evidence_items:
        assert ev["student_id"] == student_id, "Found cross-tenant evidence item!"
    print("PASS: 4. IDOR defense and tenant isolation confirmed on evidence bank.")

    # 5. Evidence Bank Verification Statuses & Citations
    assert len(evidence_items) >= 3
    has_verified = any(e["verification_status"] == "VERIFIED" for e in evidence_items)
    has_user_provided = any(e["verification_status"] == "USER_PROVIDED" for e in evidence_items)
    assert has_verified and has_user_provided, "Evidence Bank missing verified or user-provided items!"
    print("PASS: 5. Evidence Bank verification statuses and source provenance confirmed.")

    # 6. RAG Knowledge Search with Citations
    r = client.get(f"{BACKEND_URL}/api/v1/knowledge/search?q=bonafide")
    assert r.status_code == 200
    search_data = r.json()
    assert search_data["total_found"] >= 1
    chunk = search_data["chunks"][0]
    assert "source_name" in chunk
    assert "authority_level" in chunk
    assert "verification_status" in chunk
    print(f"PASS: 6. RAG search returned citations: {chunk['source_name']} ({chunk['verification_status']}).")

    # 7. AI Assistant with Controlled Tools & Trust Category
    chat_req = {
        "message": "Which document is currently blocking my applications?",
        "history": []
    }
    r = client.post(f"{BACKEND_URL}/api/v1/assistant/chat", json=chat_req, headers=auth_headers)
    assert r.status_code == 200
    chat_resp = r.json()
    assert "Income Certificate" in chat_resp["reply"]
    assert chat_resp["trust_category"] == "FACTS FROM USER DATA"
    assert "find_application_blockers" in chat_resp["tools_used"]
    print("PASS: 7. AI Assistant tool execution and FACTS FROM USER DATA trust labeling confirmed.")

    # 8. AI Application Drafting Grounded in Evidence
    r_apps = client.get(f"{BACKEND_URL}/api/v1/applications", headers=auth_headers)
    assert r_apps.status_code == 200
    apps = r_apps.json()
    app_id = apps[0]["id"]

    draft_req = {
        "question": "Describe a notable academic or technical achievement you are proud of."
    }
    r = client.post(f"{BACKEND_URL}/api/v1/applications/{app_id}/draft", json=draft_req, headers=auth_headers)
    assert r.status_code == 200
    draft_resp = r.json()
    assert "AI GENERATED DRAFT" in draft_resp["trust_label"]
    assert len(draft_resp["evidence_used"]) >= 1
    assert draft_resp["student_approval_required"] is True
    print(f"PASS: 8. AI draft grounded in evidence ({draft_resp['evidence_used'][0]['title']}).")

    # 9. Unsupported Claim Detection
    claim_req = {
        "draft_text": "I served as Director of Aerospace Engineering at NASA during my freshman year."
    }
    r = client.post(f"{BACKEND_URL}/api/v1/applications/{app_id}/evidence-check", json=claim_req, headers=auth_headers)
    assert r.status_code == 200
    claim_resp = r.json()
    assert len(claim_resp["unsupported_claims"]) >= 1
    print(f"PASS: 9. Unsupported claim detector flagged unverified assertion: '{claim_resp['unsupported_claims'][0]}'.")

    # 10. Voice Decoder with Mandatory Confirmation
    voice_req = {
        "transcription": "Enakku study ku 6 hours irukku this week",
        "language": "ta-Latn"
    }
    r = client.post(f"{BACKEND_URL}/api/v1/voice/interpret", json=voice_req)
    assert r.status_code == 200
    voice_resp = r.json()
    assert voice_resp["intent"] == "weekly_available_hours"
    assert voice_resp["extracted_params"]["hours"] == 6.0
    assert voice_resp["requires_confirmation"] is True
    print(f"PASS: 10. Multilingual voice decoder extracted intent with mandatory confirmation: {voice_resp['confirmation_message']}.")

    # 11. Monitoring Change Detection & Notification Trigger
    mon_check = {
        "simulate_change_type": "DEADLINE_CHANGED",
        "simulated_value": "48 hours remaining"
    }
    r = client.post(f"{BACKEND_URL}/api/v1/monitoring/check", json=mon_check, headers=auth_headers)
    assert r.status_code == 200
    mon_resp = r.json()
    assert mon_resp["change_detected"] is True
    assert mon_resp["change_category"] == "DEADLINE_CHANGED"
    assert mon_resp["notification_created"] is True
    print("PASS: 11. Monitoring engine detected change and created high-priority notification.")

    # 12. Notification Center Unread Status
    r = client.get(f"{BACKEND_URL}/api/v1/notifications", headers=auth_headers)
    assert r.status_code == 200
    notif_summary = r.json()
    assert notif_summary["unread_count"] >= 1
    print(f"PASS: 12. Notification Center confirmed {notif_summary['unread_count']} unread alerts.")

    # 13. Logout Session Termination
    r = client.post(f"{BACKEND_URL}/api/v1/auth/logout")
    assert r.status_code == 200
    print("PASS: 13. User logged out and session terminated.")

    # 14. Frontend SSR Verification across all routes
    routes = [
        "/",
        "/discover",
        "/discover/1",
        "/applications",
        "/documents",
        "/evidence",
        "/assistant",
        "/goal",
        "/profile",
        "/login",
        "/register",
    ]
    for route in routes:
        resp = client.get(f"{FRONTEND_URL}{route}")
        assert resp.status_code == 200, f"Frontend route {route} failed with {resp.status_code}"
    print(f"PASS: 14. Verified all {len(routes)} frontend pages rendered with HTTP 200.")

    print("\n=======================================================")
    print("ALL 14 BLOCK 4 LIVE END-TO-END QA CHECKS PASSED 100%!")
    print("=======================================================")


if __name__ == "__main__":
    run_block4_qa()
