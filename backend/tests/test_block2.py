import pytest


def test_scholarships_listing_and_recommendation(client):
    res = client.get("/api/v1/scholarships")
    assert res.status_code == 200
    scholarships = res.json()
    assert len(scholarships) >= 8

    # Verify at least the 8 demo scholarships exist
    names = [s["name"] for s in scholarships]
    assert "National Merit-cum-Means Scholarship" in names
    assert "NextGen Technology Grant" in names
    assert "State Welfare Fellowship" in names
    assert "PG Excellence Fellowship" in names
    assert "CSR STEM Bursary" in names
    assert "Regional Student Stipend" in names
    assert "Empower Future Scholarship" in names
    assert "Women in Technology Scholarship" in names

    # All should be marked DEMO_DATA (or NEEDS_VERIFICATION for Regional)
    for s in scholarships:
        assert s["verification_status"] in ["DEMO_DATA", "NEEDS_VERIFICATION"]


def test_deterministic_eligibility_evaluation(client):
    res = client.get("/api/v1/scholarships")
    scholarships = {s["name"]: s for s in res.json()}

    # 1. Arjun should be eligible for National Merit-cum-Means (CGPA 8.4 >= 7.0, Income 2.4L <= 2.5L, 12th 89.2% >= 75%)
    nmm = scholarships["National Merit-cum-Means Scholarship"]
    assert nmm["match_status"] == "eligible"
    assert nmm["match_score"] >= 80.0

    # 2. Arjun should be INELIGIBLE for PG Excellence Fellowship (Requires Postgraduate, Arjun is B.Tech 2nd Year)
    pg = scholarships["PG Excellence Fellowship"]
    assert pg["match_status"] == "ineligible"

    # 3. Arjun should be INELIGIBLE for Women in Technology Scholarship (Restricted to female applicants, Arjun is Male)
    wit = scholarships["Women in Technology Scholarship"]
    assert wit["match_status"] == "ineligible"

    # 4. Regional Student Stipend should be NEEDS_VERIFICATION
    rss = scholarships["Regional Student Stipend"]
    assert rss["match_status"] == "needs_verification"


def test_scholarship_detail_and_funding_impact(client):
    res_list = client.get("/api/v1/scholarships")
    s_id = res_list.json()[0]["id"]

    res_detail = client.get(f"/api/v1/scholarships/{s_id}")
    assert res_detail.status_code == 200
    data = res_detail.json()

    assert "funding_impact" in data
    impact = data["funding_impact"]
    assert impact["current_funding_gap"] == 60000.0
    assert impact["potential_remaining_gap"] >= 0.0
    assert "potential funding impact only" in impact["disclaimer"].lower()


def test_duplicate_application_prevention(client):
    # Application for National Merit already exists from seed
    res_list = client.get("/api/v1/scholarships")
    nmm = next(s for s in res_list.json() if s["name"] == "National Merit-cum-Means Scholarship")

    # Trying to apply again via POST /api/v1/scholarships/{id}/apply
    res_apply = client.post(f"/api/v1/scholarships/{nmm['id']}/apply")
    assert res_apply.status_code == 200
    assert res_apply.json()["is_new"] is False
    assert "already exists" in res_apply.json()["message"]

    # Trying to apply via POST /api/v1/applications
    res_app_post = client.post("/api/v1/applications", json={"scholarship_id": nmm["id"]})
    assert res_app_post.status_code == 400


def test_shared_blocker_and_cascade_unblocking(client):
    # 1. Fetch initial documents
    res_docs = client.get("/api/v1/documents")
    assert res_docs.status_code == 200
    docs = {d["document_type"]: d for d in res_docs.json()}

    income_doc = docs["INCOME_CERTIFICATE"]
    assert income_doc["status"] == "MISSING"
    assert income_doc["is_shared_blocker"] is True
    # Income certificate blocks 3 active applications in seed
    assert income_doc["affected_applications_count"] == 3
    assert income_doc["potential_funding_affected"] == 135000.0  # 50,000 + 60,000 + 25,000

    # 2. Check initial portfolio summary
    res_summary = client.get("/api/v1/applications/portfolio-summary")
    assert res_summary.status_code == 200
    summary = res_summary.json()
    assert summary["blocked_count"] == 3
    assert summary["primary_shared_blocker"] is not None
    assert summary["primary_shared_blocker"]["document_type"] == "INCOME_CERTIFICATE"

    # 3. Simulate student marking Income Certificate as AVAILABLE
    res_patch = client.patch(
        f"/api/v1/documents/{income_doc['id']}",
        json={"status": "AVAILABLE"}
    )
    assert res_patch.status_code == 200
    updated_doc = res_patch.json()
    assert updated_doc["status"] == "AVAILABLE"
    assert updated_doc["is_shared_blocker"] is False

    # 4. Verify CASCADE UNBLOCKING:
    # Applications that required Income Certificate should now have 100% progress and READY status!
    res_apps = client.get("/api/v1/applications")
    assert res_apps.status_code == 200
    apps = res_apps.json()

    for app in apps:
        if app["scholarship_name"] in [
            "National Merit-cum-Means Scholarship",
            "CSR STEM Bursary",
            "State Welfare Fellowship"
        ]:
            # All 3 requirements are now AVAILABLE -> progress 100%, status READY
            assert app["progress"] == 100.0
            assert app["status"] == "READY"
            for req in app["requirements"]:
                if req["document_type"] == "INCOME_CERTIFICATE":
                    assert req["status"] == "AVAILABLE"

    # 5. Check portfolio summary after unblocking
    res_summary_after = client.get("/api/v1/applications/portfolio-summary")
    summary_after = res_summary_after.json()
    assert summary_after["blocked_count"] == 0


def test_next_best_action_ranking(client):
    res_actions = client.get("/api/v1/actions")
    assert res_actions.status_code == 200
    actions = res_actions.json()
    assert len(actions) > 0

    # First action should be highest urgency
    assert actions[0]["urgency"] in ["URGENT", "HIGH"]
    assert "potential_funding_impact" in actions[0]


def test_planner_and_weekly_allocation(client):
    # 1. Get initial planner overview
    res_planner = client.get("/api/v1/planner")
    assert res_planner.status_code == 200
    data = res_planner.json()

    assert data["funding_overview"]["annual_education_cost"] == 120000.0
    assert data["funding_overview"]["existing_support"] == 60000.0
    assert data["funding_overview"]["funding_gap"] == 60000.0

    allocations = data["suggested_weekly_plan"]["allocations"]
    assert len(allocations) > 0

    # Check concurrent award caveat
    strat = data["funding_strategy"]
    assert "Needs verification" in strat["concurrent_award_rule"]

    # 2. Update available hours to 8 hours and verify allocation recalculation
    res_update = client.post("/api/v1/planner", json={"available_hours_per_week": 8.0})
    assert res_update.status_code == 200
    updated_plan = res_update.json()
    assert updated_plan["suggested_weekly_plan"]["total_hours"] == 8.0
