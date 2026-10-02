import pytest


def test_get_demo_student(client):
    response = client.get("/api/v1/student/me")
    assert response.status_code == 200
    data = response.json()

    # Personal info
    assert data["name"] == "Arjun Kumar"
    assert data["email"] == "arjun.kumar@demo.edu"
    assert data["phone"] == "+91 98765 43210"

    # Academic profile
    profile = data["profile"]
    assert profile is not None
    assert profile["course"] == "B.Tech Computer Science"
    assert profile["year"] == "2nd Year"
    assert profile["institution"] == "Demo Engineering College"
    assert profile["cgpa"] == 8.4
    assert profile["twelfth_percentage"] == 89.2
    assert profile["category"] == "OBC"
    assert profile["state"] == "Karnataka"

    # Funding profile
    funding = data["funding_profile"]
    assert funding is not None
    assert funding["annual_education_cost"] == 120000.0
    assert funding["existing_support"] == 60000.0
    assert funding["annual_family_income"] == 240000.0
    # Funding gap dynamically calculated: 120000 - 60000 = 60000
    assert funding["funding_gap"] == 60000.0
    assert funding["funding_progress_percentage"] == 50.0


def test_get_student_funding(client):
    response = client.get("/api/v1/student/funding")
    assert response.status_code == 200
    data = response.json()
    assert data["annual_education_cost"] == 120000.0
    assert data["existing_support"] == 60000.0
    assert data["funding_gap"] == 60000.0
    assert data["funding_progress_percentage"] == 50.0
    assert data["annual_family_income"] == 240000.0


def test_update_student_profile_and_funding(client):
    update_payload = {
        "name": "Arjun K. Updated",
        "phone": "+91 99999 88888",
        "institution": "Apex Institute of Technology",
        "course": "B.Tech AI & Data Science",
        "year": "3rd Year",
        "cgpa": 9.1,
        "twelfth_percentage": 91.5,
        "category": "General",
        "state": "Maharashtra",
        "annual_education_cost": 200000.0,
        "existing_support": 50000.0,
        "annual_family_income": 300000.0,
    }

    response = client.put("/api/v1/student/me", json=update_payload)
    assert response.status_code == 200
    data = response.json()

    assert data["name"] == "Arjun K. Updated"
    assert data["phone"] == "+91 99999 88888"
    assert data["profile"]["institution"] == "Apex Institute of Technology"
    assert data["profile"]["course"] == "B.Tech AI & Data Science"
    assert data["profile"]["year"] == "3rd Year"
    assert data["profile"]["cgpa"] == 9.1
    assert data["profile"]["twelfth_percentage"] == 91.5
    assert data["profile"]["category"] == "General"
    assert data["profile"]["state"] == "Maharashtra"

    # Funding gap dynamically recalculated: 200000 - 50000 = 150000
    assert data["funding_profile"]["annual_education_cost"] == 200000.0
    assert data["funding_profile"]["existing_support"] == 50000.0
    assert data["funding_profile"]["funding_gap"] == 150000.0
    assert data["funding_profile"]["funding_progress_percentage"] == 25.0

    # Persistence verification via GET
    get_res = client.get("/api/v1/student/me")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Arjun K. Updated"
    assert get_res.json()["funding_profile"]["funding_gap"] == 150000.0

    # Funding endpoint also returns updated values
    funding_res = client.get("/api/v1/student/funding")
    assert funding_res.status_code == 200
    assert funding_res.json()["funding_gap"] == 150000.0
    assert funding_res.json()["funding_progress_percentage"] == 25.0


def test_validation_cgpa_range(client):
    # CGPA > 10.0 should fail
    response = client.put("/api/v1/student/me", json={"cgpa": 10.5})
    assert response.status_code == 422

    # CGPA < 0.0 should fail
    response = client.put("/api/v1/student/me", json={"cgpa": -1.0})
    assert response.status_code == 422


def test_validation_percentage_range(client):
    # 12th percentage > 100.0 should fail
    response = client.put("/api/v1/student/me", json={"twelfth_percentage": 105.0})
    assert response.status_code == 422

    # 12th percentage < 0.0 should fail
    response = client.put("/api/v1/student/me", json={"twelfth_percentage": -5.0})
    assert response.status_code == 422


def test_validation_financial_non_negative(client):
    # Cost < 0 should fail
    response = client.put("/api/v1/student/me", json={"annual_education_cost": -500.0})
    assert response.status_code == 422

    # Support < 0 should fail
    response = client.put("/api/v1/student/me", json={"existing_support": -100.0})
    assert response.status_code == 422

    # Income < 0 should fail
    response = client.put("/api/v1/student/me", json={"annual_family_income": -1000.0})
    assert response.status_code == 422


def test_funding_gap_non_negative_when_support_exceeds_cost(client):
    # If support > cost, gap must be 0 (max(0, cost - support))
    response = client.put(
        "/api/v1/student/me",
        json={
            "annual_education_cost": 50000.0,
            "existing_support": 80000.0,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["funding_profile"]["funding_gap"] == 0.0
    assert data["funding_profile"]["funding_progress_percentage"] == 100.0
