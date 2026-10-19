import pytest


def test_scholarships_listing_and_recommendation(auth_client):
    res = auth_client.get("/api/v1/scholarships")
    assert res.status_code == 200
    scholarships = res.json()
    assert len(scholarships) >= 11

    # Verify verified Tamil Nadu and Central schemes exist
    names = [s["name"] for s in scholarships]
    assert "Post-Matric Scholarship for SC/ST/SCA Students" in names
    assert "Post-Matric Scholarship for BC, MBC & DNC Students" in names
    assert "Free Education Scheme for 3-Year Degree Students (BC/MBC/DNC)" in names
    assert "Moovalur Ramamirtham Ammaiyar Higher Education Assurance Scheme (Pudhumai Penn)" in names
    assert "First Graduate (FG) Tuition Fee Concession" in names
    assert "Central Sector Scheme of Scholarship for College and University Students (PM-USP CSSS)" in names
    assert "AICTE Pragati Scholarship for Girl Students" in names
    assert "TANSCHE Fellowship for Postgraduate Students" in names

    # Critical Phase 1 acceptance check: NO fictional demo scholarships in production results!
    assert "CSR STEM Bursary" not in names
    assert "NextGen Technology Grant" not in names
    assert "Future Tech Foundation (Demo)" not in [s["provider"] for s in scholarships]
    assert "Ministry of Education (Demo)" not in [s["provider"] for s in scholarships]

    # Verification statuses must be authentic source statuses
    for s in scholarships:
        assert s["verification_status"] in ["SOURCE_VERIFIED", "PARTIALLY_VERIFIED", "ELIGIBILITY_CONFIRMATION_REQUIRED"]


def test_deterministic_eligibility_evaluation(auth_client):
    res = auth_client.get("/api/v1/scholarships")
    scholarships = {s["name"]: s for s in res.json()}

    # 1. Arjun (Loyola College Chennai, B.Sc Computer Science, BC Category, Tamil Nadu domicile, Family Income 2.1L <= 2.5L, 12th 89.2%):
    # Should be ELIGIBLE for BC/MBC Post-Matric Scholarship
    bc = scholarships["Post-Matric Scholarship for BC, MBC & DNC Students"]
    assert bc["match_status"] == "eligible"
    assert bc["match_score"] >= 80.0

    # 2. Arjun should be ELIGIBLE for Free Education Scheme for 3-Year Degree Students
    fe = scholarships["Free Education Scheme for 3-Year Degree Students (BC/MBC/DNC)"]
    assert fe["match_status"] == "eligible"

    # 3. Arjun should be ELIGIBLE for PM-USP Central Sector Scheme (12th 89.2% >= 80th percentile, Income <= 4.5L)
    csss = scholarships["Central Sector Scheme of Scholarship for College and University Students (PM-USP CSSS)"]
    assert csss["match_status"] == "eligible"

    # 4. Arjun should be INELIGIBLE for First Graduate Concession (Restricted to Engineering B.E./B.Tech, Arjun is B.Sc Arts & Science)
    fg = scholarships["First Graduate (FG) Tuition Fee Concession"]
    assert fg["match_status"] == "ineligible"

    # 5. Arjun should be INELIGIBLE for AICTE Pragati (Restricted to female applicants, Arjun is Male)
    pragati = scholarships["AICTE Pragati Scholarship for Girl Students"]
    assert pragati["match_status"] == "ineligible"

    # 6. Arjun should be INELIGIBLE for TANSCHE Fellowship (Restricted to PG, Arjun is UG 2nd Year)
    tansche = scholarships["TANSCHE Fellowship for Postgraduate Students"]
    assert tansche["match_status"] == "ineligible"


def test_scholarship_detail_and_funding_impact(auth_client):
    res_list = auth_client.get("/api/v1/scholarships")
    s_id = res_list.json()[0]["id"]

    res_detail = auth_client.get(f"/api/v1/scholarships/{s_id}")
    assert res_detail.status_code == 200
    data = res_detail.json()

    assert "funding_impact" in data
    impact = data["funding_impact"]
    assert impact["current_funding_gap"] == 65000.0
    assert impact["potential_remaining_gap"] >= 0.0
    assert "potential funding impact only" in impact["disclaimer"].lower()

    # Verify Tamil Nadu dossier attributes
    assert "dossier_index" in data
    assert "stream" in data
    assert "autonomous_compatibility" in data
    assert "official_guideline_url" in data


def test_duplicate_application_prevention(auth_client):
    # Application for BC/MBC Post-Matric already exists from seed
    res_list = auth_client.get("/api/v1/scholarships")
    bc_scheme = next(s for s in res_list.json() if "BC, MBC" in s["name"])

    # Trying to apply again via POST /api/v1/scholarships/{id}/apply
    res_apply = auth_client.post(f"/api/v1/scholarships/{bc_scheme['id']}/apply")
    assert res_apply.status_code == 200
    assert res_apply.json()["is_new"] is False
    assert "already exists" in res_apply.json()["message"]

    # Trying to apply via POST /api/v1/applications
    res_app_post = auth_client.post("/api/v1/applications", json={"scholarship_id": bc_scheme["id"]})
    assert res_app_post.status_code == 400


def test_shared_blocker_and_cascade_unblocking(auth_client):
    # 1. Fetch initial documents
    res_docs = auth_client.get("/api/v1/documents")
    assert res_docs.status_code == 200
    docs = {d["document_type"]: d for d in res_docs.json()}

    income_doc = docs["INCOME_CERTIFICATE"]
    assert income_doc["status"] == "MISSING"
    assert income_doc["is_shared_blocker"] is True
    # Income certificate blocks 3 active Tamil Nadu applications in seed
    assert income_doc["affected_applications_count"] == 3
    assert income_doc["potential_funding_affected"] == 52000.0  # 25,000 + 12,000 + 15,000

    # 2. Check initial portfolio summary
    res_summary = auth_client.get("/api/v1/applications/portfolio-summary")
    assert res_summary.status_code == 200
    summary = res_summary.json()
    assert summary["blocked_count"] == 3
    assert summary["primary_shared_blocker"] is not None
    assert summary["primary_shared_blocker"]["document_type"] == "INCOME_CERTIFICATE"

    # 3. Simulate student marking Income Certificate as AVAILABLE
    res_patch = auth_client.patch(
        f"/api/v1/documents/{income_doc['id']}",
        json={"status": "AVAILABLE"}
    )
    assert res_patch.status_code == 200
    updated_doc = res_patch.json()
    assert updated_doc["status"] == "AVAILABLE"
    assert updated_doc["is_shared_blocker"] is False

    # 4. Verify CASCADE UNBLOCKING:
    # Applications that required Income Certificate should now have 100% progress and READY status!
    res_apps = auth_client.get("/api/v1/applications")
    assert res_apps.status_code == 200
    apps = res_apps.json()

    for app in apps:
        if app["scholarship_name"] in [
            "Post-Matric Scholarship for BC, MBC & DNC Students",
            "Central Sector Scheme of Scholarship for College and University Students (PM-USP CSSS)",
            "Free Education Scheme for 3-Year Degree Students (BC/MBC/DNC)"
        ]:
            # All requirements are now AVAILABLE -> progress 100%, status READY
            assert app["progress"] == 100.0
            assert app["status"] == "READY"
            for req in app["requirements"]:
                if req["document_type"] == "INCOME_CERTIFICATE":
                    assert req["status"] == "AVAILABLE"

    # 5. Check portfolio summary after unblocking
    res_summary_after = auth_client.get("/api/v1/applications/portfolio-summary")
    summary_after = res_summary_after.json()
    assert summary_after["blocked_count"] == 0


def test_next_best_action_ranking(auth_client):
    res_actions = auth_client.get("/api/v1/actions")
    assert res_actions.status_code == 200
    actions = res_actions.json()
    assert len(actions) > 0

    # First action should be highest urgency (Income certificate shared blocker)
    assert actions[0]["urgency"] in ["URGENT", "HIGH"]
    assert "potential_funding_impact" in actions[0]


def test_planner_and_weekly_allocation(auth_client):
    # 1. Get initial planner overview
    res_planner = auth_client.get("/api/v1/planner")
    assert res_planner.status_code == 200
    data = res_planner.json()

    assert data["funding_overview"]["annual_education_cost"] == 65000.0
    assert data["funding_overview"]["existing_support"] == 0.0
    assert data["funding_overview"]["funding_gap"] == 65000.0

    allocations = data["suggested_weekly_plan"]["allocations"]
    assert len(allocations) > 0

    # 2. Update available hours to 8 hours and verify allocation recalculation
    res_update = auth_client.post("/api/v1/planner", json={"available_hours_per_week": 8.0})
    assert res_update.status_code == 200
    updated_plan = res_update.json()
    assert updated_plan["suggested_weekly_plan"]["total_hours"] == 8.0
