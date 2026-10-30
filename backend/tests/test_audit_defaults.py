"""
Comprehensive tests verifying that SCHOLARAi does not inject unintended default or prefilled values
for new users, across profile, funding, goal planner, and recommendation logic.
Also verifies that legitimately saved information for existing students (e.g. demo user) is preserved.
"""

import pytest


def test_new_user_registration_has_no_assumed_defaults(client):
    """
    Registering a new student with minimal fields must NOT populate synthetic defaults
    like "Male", "BC", "Tamil Nadu", "1st Year", "Collegiate Institution", "Undergraduate Degree",
    or default funding amounts / weekly study hours.
    """
    register_payload = {
        "name": "Priya Lakshmi",
        "email": "priya.lakshmi@test.edu",
        "password": "SecurePassword123!",
    }

    # 1. Register
    reg_res = client.post("/api/v1/auth/register", json=register_payload)
    assert reg_res.status_code == 201, reg_res.text
    reg_data = reg_res.json()
    assert reg_data["user"]["email"] == "priya.lakshmi@test.edu"
    token = reg_data["session_token"]

    authed_headers = {"Authorization": f"Bearer {token}"}

    # 2. Fetch profile
    me_res = client.get("/api/v1/student/me", headers=authed_headers)
    assert me_res.status_code == 200
    student_data = me_res.json()

    # Identity info
    assert student_data["name"] == "Priya Lakshmi"
    assert student_data["email"] == "priya.lakshmi@test.edu"

    # Profile demographics & academics must be null/empty, NOT synthetic defaults
    profile = student_data["profile"]
    assert profile is not None
    assert profile.get("gender") is None
    assert profile.get("category") is None
    assert profile.get("state") is None
    assert profile.get("district") is None
    assert profile.get("domicile_status") is None
    assert profile.get("institution") is None
    assert profile.get("course") is None
    assert profile.get("year") is None
    assert profile.get("education_level") is None
    assert profile.get("stream") is None
    assert profile.get("institution_type") is None
    assert profile.get("admission_quota") is None
    assert profile.get("hosteller_status") is None
    assert profile.get("mode_of_study") is None
    assert profile.get("board_of_education") is None
    assert profile.get("is_first_graduate") is None
    assert profile.get("minority_status") is None
    assert profile.get("special_category") is None
    assert profile.get("participates_in_sports") is None
    assert profile.get("has_disability") is None
    assert profile.get("dbt_seeding_status") is None
    assert profile.get("ration_card_type") is None

    # Funding metrics must be null/empty, NOT assumed 0 or 65,000
    funding = student_data["funding_profile"]
    assert funding is not None
    assert funding.get("annual_family_income") is None
    assert funding.get("annual_education_cost") is None
    assert funding.get("existing_support") is None
    assert funding.get("funding_gap") is None
    assert funding.get("funding_progress_percentage") is None


def test_new_user_goal_planner_hours_not_defaulted_to_5(client):
    """
    A newly registered user must NOT have weekly goal hours defaulted to 5.0.
    Until the user specifies hours, total_hours must be 0 and disclaimer must be present.
    """
    # Register
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Karthik R",
            "email": "karthik.r@test.edu",
            "password": "Password123!",
        },
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    planner_res = client.get("/api/v1/planner", headers=headers)
    assert planner_res.status_code == 200
    data = planner_res.json()

    # Goal preferences
    goal = data["goal_preferences"]
    assert goal.get("available_hours_per_week") is None
    assert data["funding_overview"].get("target_funding") is None

    # Suggested weekly plan
    plan = data["suggested_weekly_plan"]
    assert plan["total_hours"] == 0.0
    assert len(plan["allocations"]) == 0
    assert "no weekly hours configured" in plan["methodology_disclaimer"].lower()


def test_new_user_recommendations_do_not_assume_eligibility(client):
    """
    When profile data is unpopulated, recommendation engine must not assume the student
    meets category or income requirements. Schemes must require verification or prompt completion.
    """
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Ananya S",
            "email": "ananya.s@test.edu",
            "password": "Password123!",
        },
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    recs_res = client.get("/api/v1/scholarships/recommendations", headers=headers)
    assert recs_res.status_code == 200
    data = recs_res.json()

    # Schemes needing profile data must be categorized as potentially eligible or currently ineligible
    assert len(data["potentially_eligible"]) > 0 or len(data["currently_ineligible"]) > 0
    # Any schemes that are in likely_eligible must not claim 100% confidence if criteria are unset
    for item in data.get("likely_eligible", []):
        assert item["match_score"] < 100 or item["eligibility_confidence"] != "LIKELY_ELIGIBLE"


def test_demo_user_preserves_legitimately_saved_data(auth_client):
    """
    Regression check: Existing demo student (Arjun Kumar) must retain his legitimately saved profile,
    funding numbers, and community details without any wiping.
    """
    res = auth_client.get("/api/v1/student/me")
    assert res.status_code == 200
    data = res.json()

    assert data["name"] == "Arjun Kumar"
    assert data["email"] == "arjun.kumar@demo.edu"
    assert data["profile"]["category"] == "BC"
    assert data["profile"]["state"] == "Tamil Nadu"
    assert data["profile"]["course"] == "B.Sc Computer Science"
    assert data["profile"]["year"] == "2nd Year"
    assert data["profile"]["cgpa"] == 8.4
    assert data["funding_profile"]["annual_education_cost"] == 65000.0
    assert data["funding_profile"]["annual_family_income"] == 210000.0
    assert data["funding_profile"]["funding_gap"] == 65000.0
