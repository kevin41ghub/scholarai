"""
Test Suite for Public vs. Authenticated Scholarship Discovery Endpoints.
Verifies that:
1. Unauthenticated guest visitors can discover active verified scholarships without getting HTTP 401.
2. Unauthenticated requests receive neutral match guidance and are not blocked from inspecting details.
3. Authenticated students receive full deterministic personalized evaluations and linked application status.
4. Protected operations (personalized recommendations, starting applications) still strictly enforce authentication.
"""
import pytest
from app.models.scholarship import Scholarship, KNOWN_FICTIONAL_DEMO_NAMES, RETIRED_DEMO_STATUSES


def test_unauthenticated_scholarship_catalogue_discovery(client):
    """
    Critical fix verification:
    Visiting /api/v1/scholarships without auth headers or cookies MUST return HTTP 200
    with active verified scholarships rather than throwing HTTP 401 Unauthorized.
    """
    res = client.get("/api/v1/scholarships")
    assert res.status_code == 200, f"Expected 200 OK for guest discovery, got {res.status_code}: {res.text}"
    
    scholarships = res.json()
    assert len(scholarships) >= 10, "Expected at least 10 active scholarships in verified catalogue"

    # Verify no fictional demo schemes appear in public results
    for s in scholarships:
        assert s["name"] not in KNOWN_FICTIONAL_DEMO_NAMES
        assert s["verification_status"] not in RETIRED_DEMO_STATUSES
        assert "(Demo)" not in (s.get("provider") or "")
        assert s["status"] == "ACTIVE"

        # Guest discovery must have neutral guidance
        assert s["application_status"] == "NOT_STARTED"
        assert s["application_id"] is None
        assert "Official statutory scheme" in s["fit_reasons"][0] or "Sign in" in s["fit_reasons"][0]


def test_unauthenticated_scholarship_detail_and_dossier(client):
    """
    Guest visitors can view details and statutory dossier excerpts without requiring login.
    """
    res_list = client.get("/api/v1/scholarships")
    assert res_list.status_code == 200
    s_id = res_list.json()[0]["id"]

    # Detail endpoint
    res_detail = client.get(f"/api/v1/scholarships/{s_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["id"] == s_id
    assert detail["name"] is not None
    assert detail["provider"] is not None
    # For unauthenticated guest, student-specific personalized fields are None
    assert detail["eligibility"] is None
    assert detail["funding_impact"] is None
    assert detail["current_application"] is None

    # Dossier endpoint
    res_dossier = client.get(f"/api/v1/scholarships/{s_id}/dossier")
    assert res_dossier.status_code == 200
    dossier = res_dossier.json()
    assert "chunks" in dossier
    assert "verification_status" in dossier


def test_authenticated_scholarship_discovery_personalization(auth_client):
    """
    Authenticated student receives personalized match status, match score, and funding coverage.
    """
    res = auth_client.get("/api/v1/scholarships")
    assert res.status_code == 200
    scholarships = {s["name"]: s for s in res.json()}

    # Arjun (Loyola B.Sc CS, BC category) meets BC/MBC Post-Matric
    bc = scholarships.get("Post-Matric Scholarship for BC, MBC & DNC Students")
    assert bc is not None
    assert bc["match_status"] == "eligible"
    assert bc["match_score"] >= 80.0
    assert any("meets verified" in r.lower() for r in bc["fit_reasons"])


def test_protected_endpoints_remain_strictly_authenticated(client):
    """
    Personalized recommendations, eligibility checks, and apply endpoints must STILL reject unauthenticated calls with HTTP 401.
    """
    res_recs = client.get("/api/v1/scholarships/recommendations")
    assert res_recs.status_code == 401
    assert "Authentication required" in res_recs.json()["detail"]

    res_elig = client.get("/api/v1/scholarships/1/eligibility")
    assert res_elig.status_code == 401
    assert "Authentication required" in res_elig.json()["detail"]

    res_apply = client.post("/api/v1/scholarships/1/apply")
    assert res_apply.status_code == 401
    assert "Authentication required" in res_apply.json()["detail"]

