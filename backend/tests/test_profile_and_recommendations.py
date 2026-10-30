import pytest
from datetime import date
from fastapi.testclient import TestClient

from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.funding_profile import FundingProfile
from app.models.scholarship import Scholarship
from app.models.user import User


def test_registration_without_cgpa_or_financial_fields(client: TestClient, db_session):
    """Verify students can register cleanly without CGPA, income, or funding gap requirements."""
    reg_payload = {
        "email": "fresh_tn_student@example.edu",
        "name": "Kavitha Raman",
        "password": "Password123!",
        "phone": "+91 98765 43210",
        "institution": "Loyola College (Autonomous)",
        "course": "B.Sc Mathematics",
        "year": "1st Year",
        "state": "Tamil Nadu",
        "gender": "Female",
    }
    resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert resp.status_code == 201, f"Registration failed: {resp.text}"
    data = resp.json()
    assert "session_token" in data
    assert data["user"]["email"] == "fresh_tn_student@example.edu"
    assert data["user"]["student_name"] == "Kavitha Raman"

    # Verify student record and default profiles in DB
    student = db_session.query(Student).filter(Student.email == "fresh_tn_student@example.edu").first()
    assert student is not None
    assert student.profile is not None
    # CGPA must be null by default
    assert student.profile.cgpa is None
    assert student.profile.state == "Tamil Nadu"
    assert student.profile.native_state == "Tamil Nadu"
    # Funding profile created with zeroed/default gap
    assert student.funding_profile is not None
    assert student.funding_profile.funding_gap == 0.0


def test_profile_update_and_persistence(client: TestClient, db_session):
    """Test detailed profile updating including personal, academic, and community attributes."""
    reg_payload = {
        "email": "update_student@example.edu",
        "name": "Senthil Nathan",
        "password": "Password123!",
        "phone": "+91 98765 11223",
        "institution": "PSG College of Arts and Science (Autonomous)",
        "course": "B.Com Corporate Secretaryship",
        "year": "2nd Year",
    }
    reg_resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201
    token = reg_resp.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Update profile with comprehensive Tamil Nadu collegiate details (no CGPA!)
    update_payload = {
        "dob": "2004-05-15",
        "district": "Coimbatore",
        "native_state": "Tamil Nadu",
        "education_level": "UG",
        "stream": "ARTS_SCIENCE",
        "institution_type": "GOVERNMENT_AIDED_AUTONOMOUS",
        "school_type": "TN_GOVT_6_TO_12",
        "school_study_history": "Studied in Govt Boys Higher Secondary School, Coimbatore from 6th to 12th standard",
        "community_category": "BC",
        "community_subcategory": "BC Muslim / BC Christian / Backward Class",
        "quota": "MERIT_GOVERNMENT_SEAT",
        "bank_readiness": "READY_FOR_DBT",
        "dbt_enabled": True,
        "bank_name": "Indian Overseas Bank",
        "bank_branch": "Gandhipuram, Coimbatore",
        "aadhaar_consent_given": True,
        "aadhaar_masked": "XXXX-XXXX-8921",
        "funding_gap": 45000.0,
        "income_range": "BELOW_1_LAKH",
        "annual_family_income": 95000.0,
        "income_certificate_status": "ISSUED_E_SEVAI",
    }
    update_resp = client.put("/api/v1/student/me", json=update_payload, headers=headers)
    assert update_resp.status_code == 200, f"Profile update failed: {update_resp.text}"
    updated = update_resp.json()

    # Verify persisted values
    assert updated["profile"]["dob"] == "2004-05-15"
    assert updated["profile"]["district"] == "Coimbatore"
    assert updated["profile"]["stream"] == "ARTS_SCIENCE"
    assert updated["profile"]["institution_type"] == "GOVERNMENT_AIDED_AUTONOMOUS"
    assert updated["profile"]["school_type"] == "TN_GOVT_6_TO_12"
    assert updated["profile"]["category"] == "BC"
    assert updated["profile"]["dbt_enabled"] is True
    assert updated["profile"]["aadhaar_masked"] == "XXXX-XXXX-8921"
    assert updated["profile"]["aadhaar_consent_given"] is True
    assert updated["funding_profile"]["funding_gap"] == 45000.0
    assert updated["funding_profile"]["annual_family_income"] == 95000.0
    assert updated["funding_profile"]["income_certificate_status"] == "ISSUED_E_SEVAI"


def test_cgpa_not_required_and_no_disqualification_for_null(client: TestClient, db_session):
    """Confirm CGPA is not required in student updates and null CGPA does not trigger hard crash."""
    reg_payload = {
        "email": "nocgpa_student@example.edu",
        "name": "Priya Murugan",
        "password": "Password123!",
        "institution": "Madras Christian College (Autonomous)",
        "course": "B.A. English Literature",
        "year": "1st Year",
    }
    reg_resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201
    token = reg_resp.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch profile - cgpa must be None
    get_resp = client.get("/api/v1/student/me", headers=headers)
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["profile"]["cgpa"] is None

    # Recommendations endpoint should succeed without CGPA
    rec_resp = client.get("/api/v1/scholarships/recommendations", headers=headers)
    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()
    assert "likely_eligible" in rec_data
    assert rec_data["total_recommendations"] > 0


def test_profile_completion_endpoint(client: TestClient, db_session):
    """Verify /api/v1/student/me/completion returns detailed section breakdowns."""
    reg_payload = {
        "email": "completion_student@example.edu",
        "name": "Dinesh Kumar",
        "password": "Password123!",
        "institution": "PSG Tech",
        "course": "B.E. Mechanical Engineering",
        "year": "3rd Year",
    }
    reg_resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201
    token = reg_resp.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/student/me/completion", headers=headers)
    assert resp.status_code == 200
    comp = resp.json()
    assert "overall_percentage" in comp
    assert "overall_status" in comp
    assert "sections" in comp
    assert "personal" in comp["sections"]
    assert "academic" in comp["sections"]
    assert "community" in comp["sections"]
    assert "financial" in comp["sections"]
    assert "bank_benefit" in comp["sections"]
    assert "identity" in comp["sections"]
    assert "missing_fields" in comp["sections"]["personal"]


def test_personalized_recommendations_four_categories(client: TestClient, db_session):
    """Verify /api/v1/scholarships/recommendations structures schemes into 4 required categories."""
    reg_payload = {
        "email": "rec_test_user@example.edu",
        "name": "Ananya Sundaram",
        "password": "Password123!",
        "institution": "Queen Mary's College (Autonomous)",
        "course": "B.Sc Computer Science",
        "year": "1st Year",
    }
    reg_resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201
    token = reg_resp.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Setup profile as Female from TN Govt School, BC community
    update_payload = {
        "gender": "Female",
        "state": "Tamil Nadu",
        "native_state": "Tamil Nadu",
        "stream": "ARTS_SCIENCE",
        "education_level": "UG",
        "institution_type": "GOVERNMENT_AIDED_AUTONOMOUS",
        "school_type": "TN_GOVT_6_TO_12",
        "community_category": "BC",
        "annual_family_income": 120000.0,
    }
    client.put("/api/v1/student/me", json=update_payload, headers=headers)

    resp = client.get("/api/v1/scholarships/recommendations", headers=headers)
    assert resp.status_code == 200
    body = resp.json()

    assert "likely_eligible" in body
    assert "potentially_eligible" in body
    assert "currently_ineligible" in body
    assert "window_needs_verification" in body

    all_items = (
        body["likely_eligible"]
        + body["potentially_eligible"]
        + body["currently_ineligible"]
        + body["window_needs_verification"]
    )
    assert len(all_items) > 0

    for item in all_items:
        assert "id" in item
        assert "name" in item
        assert "provider" in item
        assert "recommendation_category" in item
        assert item["recommendation_category"] in [
            "LIKELY_ELIGIBLE",
            "POTENTIALLY_ELIGIBLE",
            "CURRENTLY_INELIGIBLE",
            "WINDOW_NEEDS_VERIFICATION",
        ]
        assert "satisfied_requirements" in item
        assert "missing_information" in item
        assert "requirements_needing_verification" in item
        assert "official_source_url" in item


def test_tamil_pudhalvan_scheme_eligibility(client: TestClient, db_session):
    """Verify Tamil Pudhalvan Higher Education Assurance Scheme rules:
    - Male students who studied in TN Government Schools (6th to 12th)
    - Enrolled in recognized collegiate courses
    """
    # 1. Male student from TN Govt School -> Eligible
    male_reg = {
        "email": "tp_male@example.edu",
        "name": "Arun Kumar",
        "password": "Password123!",
        "institution": "Government Arts College (Autonomous), Coimbatore",
        "course": "B.A. History",
        "year": "1st Year",
    }
    m_resp = client.post("/api/v1/auth/register", json=male_reg)
    assert m_resp.status_code == 201
    m_token = m_resp.json()["session_token"]
    m_headers = {"Authorization": f"Bearer {m_token}"}

    client.put(
        "/api/v1/student/me",
        json={
            "gender": "Male",
            "state": "Tamil Nadu",
            "school_type": "TN_GOVT_6_TO_12",
            "institution_type": "GOVERNMENT_AUTONOMOUS",
            "stream": "ARTS_SCIENCE",
            "education_level": "UG",
        },
        headers=m_headers,
    )

    rec_resp = client.get("/api/v1/scholarships/recommendations", headers=m_headers)
    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()

    all_items = (
        rec_data["likely_eligible"]
        + rec_data["potentially_eligible"]
        + rec_data["currently_ineligible"]
        + rec_data["window_needs_verification"]
    )
    tp_items = [i for i in all_items if "Tamil Pudhalvan" in i["name"]]
    assert len(tp_items) > 0, "Tamil Pudhalvan scheme should exist in recommendations"
    tp_item = tp_items[0]
    assert tp_item["recommendation_category"] in ["LIKELY_ELIGIBLE", "POTENTIALLY_ELIGIBLE"]

    # 2. Female student -> Ineligible for Tamil Pudhalvan (since Pudhumai Penn is the counterpart)
    female_reg = {
        "email": "tp_female@example.edu",
        "name": "Revathi S",
        "password": "Password123!",
        "institution": "Government Arts College",
        "course": "B.Sc Physics",
        "year": "1st Year",
    }
    f_resp = client.post("/api/v1/auth/register", json=female_reg)
    assert f_resp.status_code == 201
    f_token = f_resp.json()["session_token"]
    f_headers = {"Authorization": f"Bearer {f_token}"}

    client.put(
        "/api/v1/student/me",
        json={
            "gender": "Female",
            "state": "Tamil Nadu",
            "school_type": "TN_GOVT_6_TO_12",
            "stream": "ARTS_SCIENCE",
        },
        headers=f_headers,
    )

    f_rec_resp = client.get("/api/v1/scholarships/recommendations", headers=f_headers)
    f_rec_data = f_rec_resp.json()
    inelig_items = f_rec_data["currently_ineligible"]
    tp_inelig = [i for i in inelig_items if "Tamil Pudhalvan" in i["name"]]
    assert len(tp_inelig) > 0, "Female students must be classified as ineligible for Tamil Pudhalvan"


def test_evr_nagammai_scheme_eligibility(client: TestClient, db_session):
    """Verify E.V.R. Nagammai Memorial Free Education Scheme rules:
    - Female students enrolled in PG courses (M.A., M.Sc., M.Com.)
    - Family income <= 250000
    - Enrolled in recognized collegiate courses
    """
    # 1. Female PG student, within income -> Eligible
    pg_reg = {
        "email": "evr_female@example.edu",
        "name": "Deepa Sundar",
        "password": "Password123!",
        "institution": "Ethiraj College for Women (Autonomous)",
        "course": "M.Sc Mathematics",
        "year": "1st Year",
    }
    resp = client.post("/api/v1/auth/register", json=pg_reg)
    assert resp.status_code == 201
    token = resp.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client.put(
        "/api/v1/student/me",
        json={
            "gender": "Female",
            "state": "Tamil Nadu",
            "education_level": "PG",
            "course": "M.Sc Mathematics",
            "community_category": "BC",
            "stream": "ARTS_SCIENCE",
            "annual_family_income": 180000.0,
        },
        headers=headers,
    )

    rec_resp = client.get("/api/v1/scholarships/recommendations", headers=headers)
    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()

    all_items = (
        rec_data["likely_eligible"]
        + rec_data["potentially_eligible"]
        + rec_data["currently_ineligible"]
        + rec_data["window_needs_verification"]
    )
    evr_items = [i for i in all_items if "Nagammai" in i["name"]]
    assert len(evr_items) > 0, "E.V.R. Nagammai scheme must exist in recommendations"
    assert evr_items[0]["recommendation_category"] in ["LIKELY_ELIGIBLE", "POTENTIALLY_ELIGIBLE"]

    # 2. Male student -> Ineligible
    male_reg = {
        "email": "evr_male@example.edu",
        "name": "Karthik R",
        "password": "Password123!",
        "institution": "Loyola College",
        "course": "M.Sc Chemistry",
        "year": "1st Year",
    }
    m_resp = client.post("/api/v1/auth/register", json=male_reg)
    assert m_resp.status_code == 201
    m_token = m_resp.json()["session_token"]
    m_headers = {"Authorization": f"Bearer {m_token}"}

    client.put(
        "/api/v1/student/me",
        json={
            "gender": "Male",
            "education_level": "PG",
            "course": "M.Sc Chemistry",
            "community_category": "BC",
        },
        headers=m_headers,
    )

    m_rec = client.get("/api/v1/scholarships/recommendations", headers=m_headers).json()
    inelig_evr = [i for i in m_rec["currently_ineligible"] if "Nagammai" in i["name"]]
    assert len(inelig_evr) > 0, "Male students must be marked ineligible for E.V.R. Nagammai"
