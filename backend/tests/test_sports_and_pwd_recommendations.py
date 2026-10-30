import pytest
from fastapi.testclient import TestClient

from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.scholarship import Scholarship


def test_subcaste_not_required_or_exposed(client: TestClient, db_session):
    """
    Verify that caste/sub-caste names are not required or exposed in the student profile API.
    Only statutory community categories (BC, MBC/DNC, SC, SCA, ST, OC) are accepted.
    """
    reg_payload = {
        "email": "statutory_student@example.edu",
        "name": "Meenakshi Sundaram",
        "password": "Password123!",
        "institution": "Loyola College (Autonomous)",
        "course": "B.Sc Computer Science",
        "year": "2nd Year",
        "state": "Tamil Nadu",
        "gender": "Female",
    }
    resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert resp.status_code == 201
    auth_token = resp.json()["session_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}

    # Update profile with statutory community category BC and verify persistence
    update_payload = {
        "category": "BC",
        "state": "Tamil Nadu",
        "native_state": "Tamil Nadu",
    }
    update_resp = client.put("/api/v1/student/me", json=update_payload, headers=headers)
    assert update_resp.status_code == 200
    student_data = update_resp.json()
    assert student_data["profile"]["category"] == "BC"

    # Verify that get profile / me response does not require sub-caste
    me_resp = client.get("/api/v1/student/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["profile"]["category"] == "BC"


def test_sports_profile_persistence_and_matching(client: TestClient, db_session):
    """
    Test sports profile persistence and matching for SDAT scholarships & TNEA sports quota.
    """
    reg_payload = {
        "email": "athlete_student@example.edu",
        "name": "Dinesh Karthik",
        "password": "Password123!",
        "institution": "College of Engineering Guindy (Anna University)",
        "course": "B.E. Computer Science and Engineering",
        "year": "1st Year",
        "state": "Tamil Nadu",
        "gender": "Male",
    }
    resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert resp.status_code == 201
    auth_token = resp.json()["session_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}

    # Update with verified athletic achievements
    sports_update = {
        "participates_in_sports": True,
        "sport_discipline": "Athletics - 400m Track",
        "sports_competition_level": "State",
        "sports_achievement_type": "Winner / Gold Medalist",
        "sports_certificate_status": "Have Verified Official Certificate",
        "sports_achievement_year": "2024",
    }
    update_resp = client.put("/api/v1/student/me", json=sports_update, headers=headers)
    assert update_resp.status_code == 200
    p = update_resp.json()["profile"]
    assert p["participates_in_sports"] is True
    assert p["sport_discipline"] == "Athletics - 400m Track"
    assert p["sports_competition_level"] == "State"
    assert p["sports_achievement_type"] == "Winner / Gold Medalist"

    # Query personalized recommendations
    recs_resp = client.get("/api/v1/scholarships/recommendations", headers=headers)
    assert recs_resp.status_code == 200
    recs = recs_resp.json()

    eligible_names = [item["name"] for item in recs["likely_eligible"] + recs["potentially_eligible"]]
    ineligible_names = [item["name"] for item in recs["currently_ineligible"]]

    # SDAT Sports scholarship should be eligible
    sdat_found = any("SDAT" in name or "Champions Foundation" in name for name in eligible_names)
    assert sdat_found, f"Expected SDAT sports scheme in eligible recommendations, got: {eligible_names}"

    # TNEA Sports quota should be eligible and have benefit_type == ADMISSION_BENEFIT
    all_recs = recs["likely_eligible"] + recs["potentially_eligible"] + recs["currently_ineligible"] + recs["window_needs_verification"]
    tnea_sports = next((r for r in all_recs if "Sports Quota Special Reservation" in r["name"]), None)
    assert tnea_sports is not None, "Expected TNEA Sports Quota scheme in catalogue"
    assert tnea_sports["benefit_type"] == "ADMISSION_BENEFIT"
    assert tnea_sports["recommendation_category"] in ["LIKELY_ELIGIBLE", "POTENTIALLY_ELIGIBLE"]

    # Now toggle sports participation to False and verify they become ineligible
    client.put("/api/v1/student/me", json={"participates_in_sports": False}, headers=headers)
    recs_resp2 = client.get("/api/v1/scholarships/recommendations", headers=headers)
    recs2 = recs_resp2.json()
    ineligible_names2 = [item["name"] for item in recs2["currently_ineligible"]]
    assert any("SDAT" in name for name in ineligible_names2)
    assert any("Sports Quota" in name for name in ineligible_names2)


def test_pwd_profile_persistence_privacy_and_matching(client: TestClient, db_session):
    """
    Test disability profile persistence with voluntary consent, and matching for
    AICTE Saksham, DEPwD Post-Matric, and Tamil Nadu Differently Abled Welfare assistance.
    """
    reg_payload = {
        "email": "pwd_student@example.edu",
        "name": "Ananya Krishnan",
        "password": "Password123!",
        "institution": "PSG College of Technology (Autonomous), Coimbatore",
        "course": "B.Tech Information Technology",
        "year": "1st Year",
        "state": "Tamil Nadu",
        "gender": "Female",
    }
    resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert resp.status_code == 201
    auth_token = resp.json()["session_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}

    # Set family income to <= 2.5L to satisfy DEPwD and Saksham income criteria
    income_update = {
        "annual_family_income": 200000.0,
        "has_disability": True,
        "disability_consent_given": True,
        "disability_category": "Locomotor Disability",
        "disability_percentage": 50.0,
        "udid_card_status": "UDID Card Available",
        "accessibility_needs": "None / Independent",
    }
    update_resp = client.put("/api/v1/student/me", json=income_update, headers=headers)
    assert update_resp.status_code == 200
    p = update_resp.json()["profile"]
    assert p["has_disability"] is True
    assert p["disability_consent_given"] is True
    assert p["disability_percentage"] == 50.0
    assert p["udid_card_status"] == "UDID Card Available"

    # Query personalized recommendations
    recs_resp = client.get("/api/v1/scholarships/recommendations", headers=headers)
    assert recs_resp.status_code == 200
    recs = recs_resp.json()

    all_recs = recs["likely_eligible"] + recs["potentially_eligible"] + recs["currently_ineligible"] + recs["window_needs_verification"]

    # 1. AICTE Saksham
    saksham = next((r for r in all_recs if "Saksham" in r["name"]), None)
    assert saksham is not None, "Expected Saksham scholarship in catalogue"
    assert saksham["benefit_type"] == "SCHOLARSHIP"
    assert saksham["recommendation_category"] in ["LIKELY_ELIGIBLE", "POTENTIALLY_ELIGIBLE"]

    # 2. DEPwD Post-Matric
    depwd = next((r for r in all_recs if "DEPwD" in r["name"]), None)
    assert depwd is not None, "Expected DEPwD Post-Matric in catalogue"
    assert depwd["benefit_type"] == "SCHOLARSHIP"
    assert depwd["recommendation_category"] in ["LIKELY_ELIGIBLE", "POTENTIALLY_ELIGIBLE"]

    # 3. TN Differently Abled Welfare Readers Allowance
    tn_pwd = next((r for r in all_recs if "Readers Allowance" in r["name"]), None)
    assert tn_pwd is not None, "Expected TN Readers Allowance in catalogue"
    assert tn_pwd["benefit_type"] == "FINANCIAL_ASSISTANCE"
    assert tn_pwd["recommendation_category"] in ["LIKELY_ELIGIBLE", "POTENTIALLY_ELIGIBLE"]

    # When student does NOT have a disability, verify they are in currently_ineligible
    client.put("/api/v1/student/me", json={"has_disability": False}, headers=headers)
    recs_resp2 = client.get("/api/v1/scholarships/recommendations", headers=headers)
    recs2 = recs_resp2.json()
    ineligible2 = [r["name"] for r in recs2["currently_ineligible"]]
    assert any("Saksham" in name for name in ineligible2)
    assert any("DEPwD" in name for name in ineligible2)
    assert any("Readers Allowance" in name for name in ineligible2)


def test_govt_school_7_point_5_quota_as_admission_benefit(client: TestClient, db_session):
    """
    Test that the Tamil Nadu 7.5% Government School preferential quota is explicitly
    tagged as an ADMISSION_BENEFIT and matches students who studied Classes 6-12 in TN Govt schools.
    """
    reg_payload = {
        "email": "govtschool_student@example.edu",
        "name": "Santhosh Murugan",
        "password": "Password123!",
        "institution": "Government College of Technology (Autonomous), Coimbatore",
        "course": "B.E. Mechanical Engineering",
        "year": "1st Year",
        "state": "Tamil Nadu",
        "gender": "Male",
    }
    resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert resp.status_code == 201
    auth_token = resp.json()["session_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}

    # Mark as having studied in TN Govt school continuously
    update_payload = {
        "studied_govt_school_6_to_12": True,
        "school_type": "Tamil Nadu Government School (Classes 6-12)",
    }
    client.put("/api/v1/student/me", json=update_payload, headers=headers)

    recs_resp = client.get("/api/v1/scholarships/recommendations", headers=headers)
    assert recs_resp.status_code == 200
    recs = recs_resp.json()

    all_recs = recs["likely_eligible"] + recs["potentially_eligible"] + recs["currently_ineligible"] + recs["window_needs_verification"]
    quota_scheme = next((r for r in all_recs if "7.5%" in r["name"]), None)
    assert quota_scheme is not None, "Expected 7.5% Government School Quota in catalogue"
    assert quota_scheme["benefit_type"] == "ADMISSION_BENEFIT"
    assert quota_scheme["recommendation_category"] in ["LIKELY_ELIGIBLE", "POTENTIALLY_ELIGIBLE"]

    # When student is from a private school, verify marked ineligible
    client.put(
        "/api/v1/student/me",
        json={"studied_govt_school_6_to_12": False, "school_type": "Private / Matriculation School"},
        headers=headers,
    )
    recs_resp2 = client.get("/api/v1/scholarships/recommendations", headers=headers)
    recs2 = recs_resp2.json()
    ineligible2 = [r["name"] for r in recs2["currently_ineligible"]]
    assert any("7.5%" in name for name in ineligible2)


def test_benefit_types_present_on_all_recommendations(auth_client: TestClient, db_session):
    """
    Confirm that every recommendation item returned by the API has a valid benefit_type.
    """
    recs_resp = auth_client.get("/api/v1/scholarships/recommendations")
    assert recs_resp.status_code == 200
    recs = recs_resp.json()

    valid_types = {"SCHOLARSHIP", "ADMISSION_BENEFIT", "FEE_CONCESSION", "FINANCIAL_ASSISTANCE"}
    all_items = (
        recs["likely_eligible"]
        + recs["potentially_eligible"]
        + recs["currently_ineligible"]
        + recs["window_needs_verification"]
    )
    assert len(all_items) >= 10, f"Expected at least 10 recommendation items, got {len(all_items)}"

    for item in all_items:
        assert "benefit_type" in item, f"Missing benefit_type on {item['name']}"
        assert item["benefit_type"] in valid_types, f"Invalid benefit_type '{item['benefit_type']}' on {item['name']}"
