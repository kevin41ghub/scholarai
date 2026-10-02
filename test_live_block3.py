"""
Live Integration Test Suite for SCHOLARAi Block 3:
Advanced AI, Evidence Bank, RAG, Adaptive Intelligence & Security.
"""

import sys
import httpx

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:3000"


def log(msg: str):
    print(f"[TEST] {msg}")


def main():
    log("Starting Block 3 Live Integration Verification Suite...")
    client = httpx.Client(timeout=10.0, follow_redirects=True)

    # 1. Backend Health Check
    r = client.get(f"{BACKEND_URL}/api/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    log("1. Backend Health Check PASSED")

    # 2. Demo User Authentication
    login_payload = {
        "email": "demo@scholarai.local",
        "password": "DemoStudent@2026"
    }
    r = client.post(f"{BACKEND_URL}/api/v1/auth/login", json=login_payload)
    assert r.status_code == 200, f"Demo login failed: {r.status_code} - {r.text}"
    auth_data = r.json()
    assert "session_token" in auth_data, "Missing session_token in login response"
    assert auth_data["user"]["email"] == "demo@scholarai.local"
    session_token = auth_data["session_token"]
    log(f"2. Auth Login PASSED (User: {auth_data['user']['student_name']})")

    # Configure authenticated headers / cookies
    auth_headers = {"Authorization": f"Bearer {session_token}"}

    # 3. Authenticated Identity Verification (/auth/me)
    r = client.get(f"{BACKEND_URL}/api/v1/auth/me", headers=auth_headers)
    assert r.status_code == 200, f"Auth /me failed: {r.status_code}"
    assert r.json()["email"] == "demo@scholarai.local"
    log("3. Authenticated Identity (/auth/me) PASSED")

    # 4. Evidence Bank Verification
    r = client.get(f"{BACKEND_URL}/api/v1/evidence", headers=auth_headers)
    assert r.status_code == 200, f"List evidence failed: {r.status_code}"
    evidence_items = r.json()
    assert len(evidence_items) >= 2, f"Expected at least 2 seeded evidence items, got {len(evidence_items)}"
    log(f"4. Evidence Bank List PASSED ({len(evidence_items)} items retrieved)")

    # 5. Create New Evidence Record
    new_ev = {
        "title": "Autonomous Vehicle Vision Pipeline",
        "category": "PROJECT",
        "description": "Engineered real-time obstacle detection model with 94% accuracy.",
        "date": "2025-2026",
        "organization": "Robotics Club",
        "source_type": "USER_PROVIDED",
        "source_name": "Project Documentation"
    }
    r = client.post(f"{BACKEND_URL}/api/v1/evidence", json=new_ev, headers=auth_headers)
    assert r.status_code == 201, f"Create evidence failed: {r.status_code}"
    created_ev = r.json()
    assert created_ev["verification_status"] == "USER_PROVIDED"
    log("5. Evidence Creation PASSED")

    # Clean up created evidence
    r = client.delete(f"{BACKEND_URL}/api/v1/evidence/{created_ev['id']}", headers=auth_headers)
    assert r.status_code == 204
    log("6. Evidence Deletion PASSED")

    # 7. RAG Knowledge Search & Citations
    r = client.get(f"{BACKEND_URL}/api/v1/knowledge/search?q=eligibility", headers=auth_headers)
    assert r.status_code == 200, f"RAG search failed: {r.status_code}"
    search_res = r.json()
    assert search_res["total_found"] > 0, "RAG search found 0 chunks"
    assert len(search_res["sources_cited"]) > 0, "RAG search missing citations"
    log(f"7. RAG Knowledge Search PASSED ({search_res['total_found']} chunks, cited: {search_res['sources_cited'][0]})")

    # 8. AI Assistant Conversational Query & Tool Execution
    chat_req = {"message": "What is blocking my applications?"}
    r = client.post(f"{BACKEND_URL}/api/v1/assistant/chat", json=chat_req, headers=auth_headers)
    assert r.status_code == 200, f"Assistant chat failed: {r.status_code}"
    chat_res = r.json()
    assert "Income Certificate" in chat_res["reply"]
    assert "find_application_blockers" in chat_res["tools_used"]
    assert chat_res["trust_category"] == "FACTS FROM USER DATA"
    log("8. AI Assistant Blocker Query PASSED (Trust Category: FACTS FROM USER DATA)")

    # 9. AI Assistant Action Confirmation Flow
    action_req = {"message": "Update my weekly hours to 6 hours."}
    r = client.post(f"{BACKEND_URL}/api/v1/assistant/chat", json=action_req, headers=auth_headers)
    assert r.status_code == 200
    confirm_res = r.json()
    assert confirm_res["pending_action_confirmation"] is not None
    assert confirm_res["pending_action_confirmation"]["action_type"] == "UPDATE_WEEKLY_HOURS"
    log("9. AI Assistant Action Confirmation Generation PASSED")

    # Confirm the action
    confirmed_payload = confirm_res["pending_action_confirmation"]
    confirmed_payload["status"] = "CONFIRMED"
    r = client.post(
        f"{BACKEND_URL}/api/v1/assistant/chat",
        json={"message": "Confirmed", "confirmed_action": confirmed_payload},
        headers=auth_headers
    )
    assert r.status_code == 200
    assert "Confirmed and updated" in r.json()["reply"]
    log("10. AI Assistant Action Confirmation Execution PASSED")

    # 11. AI Application Drafting (Grounded in Evidence Bank)
    r = client.get(f"{BACKEND_URL}/api/v1/applications", headers=auth_headers)
    assert r.status_code == 200
    apps = r.json()
    assert len(apps) > 0
    app_id = apps[0]["id"]

    draft_req = {"question": "Describe a technical project you are proud of."}
    r = client.post(f"{BACKEND_URL}/api/v1/applications/{app_id}/draft", json=draft_req, headers=auth_headers)
    assert r.status_code == 200
    draft_res = r.json()
    assert draft_res["student_approval_required"] is True
    assert "AI GENERATED DRAFT" in draft_res["trust_label"]
    assert len(draft_res["evidence_used"]) > 0
    log(f"11. AI Application Drafting PASSED (Evidence cited: {draft_res['evidence_used'][0]['title']})")

    # 12. Unsupported Claim Detection
    exaggerated_text = "I invented a new neural network architecture and led a 50-person research team to win a national award."
    r = client.post(
        f"{BACKEND_URL}/api/v1/applications/{app_id}/evidence-check",
        json={"draft_text": exaggerated_text},
        headers=auth_headers
    )
    assert r.status_code == 200
    check_res = r.json()
    assert len(check_res["unsupported_claims"]) > 0
    log(f"12. Unsupported Claim Detection PASSED ({len(check_res['unsupported_claims'])} claims flagged)")

    # 13. Voice Decoder with Tanglish Input
    voice_req = {"transcription": "Enakku 60000 rupees funding thevai irukku", "language": "ta-Latn"}
    r = client.post(f"{BACKEND_URL}/api/v1/voice/interpret", json=voice_req)
    assert r.status_code == 200
    voice_res = r.json()
    assert voice_res["intent"] == "funding_goal"
    assert voice_res["extracted_params"].get("target_funding") == 60000.0
    assert voice_res["requires_confirmation"] is True
    log("13. Voice Decoder (Tanglish intent extraction) PASSED")

    # 14. Notifications Center & Read State
    r = client.get(f"{BACKEND_URL}/api/v1/notifications", headers=auth_headers)
    assert r.status_code == 200
    notif_res = r.json()
    assert notif_res["unread_count"] >= 1
    log(f"14. Notifications Center PASSED ({notif_res['unread_count']} unread alerts)")

    # 15. Monitoring Change Detection & Alert Generation
    csr_app = next((a for a in apps if "CSR STEM" in a["scholarship_name"]), apps[0])
    sim_req = {
        "scholarship_id": csr_app["scholarship_id"],
        "simulate_change_type": "DEADLINE_CHANGED"
    }
    r = client.post(f"{BACKEND_URL}/api/v1/monitoring/check", json=sim_req, headers=auth_headers)
    assert r.status_code == 200
    mon_res = r.json()
    assert mon_res["change_detected"] is True
    assert mon_res["notification_created"] is True
    log("15. Monitoring Change Detection & Alert Generation PASSED")

    # 16. Frontend Routes Verification
    frontend_routes = ["/", "/discover", "/applications", "/documents", "/goal", "/evidence", "/assistant", "/login", "/register"]
    for route in frontend_routes:
        r_fe = client.get(f"{FRONTEND_URL}{route}")
        assert r_fe.status_code == 200, f"Frontend route {route} failed: {r_fe.status_code}"
    log("16. Frontend Routes SSR PASSED (all 9 primary routes rendered HTTP 200)")

    print("\n=======================================================")
    print("ALL 16 BLOCK 3 LIVE INTEGRATION CHECKS PASSED WITH ZERO ERRORS!")
    print("=======================================================\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FAILED: {e}")
        sys.exit(1)
