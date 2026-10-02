import json
import httpx

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:3000"

def test_live_system():
    results = {}
    with httpx.Client(timeout=10.0) as client:
        # 1. Health endpoint
        res_health = client.get(f"{BACKEND_URL}/api/health")
        assert res_health.status_code == 200, f"Health check failed: {res_health.status_code}"
        results["health"] = res_health.json()
        print("PASS: /api/health", json.dumps(results["health"]))

        # 2. Student API (GET /api/v1/student/me)
        res_student = client.get(f"{BACKEND_URL}/api/v1/student/me")
        assert res_student.status_code == 200, f"Student get failed: {res_student.status_code}"
        results["student_me_initial"] = res_student.json()
        print("PASS: GET /api/v1/student/me -> Name:", results["student_me_initial"]["name"])
        print("Academic Course:", results["student_me_initial"]["profile"]["course"])
        print("Calculated Funding Gap:", results["student_me_initial"]["funding_profile"]["funding_gap"])

        # 3. Funding API (GET /api/v1/student/funding)
        res_funding = client.get(f"{BACKEND_URL}/api/v1/student/funding")
        assert res_funding.status_code == 200, f"Funding get failed: {res_funding.status_code}"
        results["funding"] = res_funding.json()
        print("PASS: GET /api/v1/student/funding -> Gap:", results["funding"]["funding_gap"], "Progress:", results["funding"]["funding_progress_percentage"], "%")

        # 4. Profile update (PUT /api/v1/student/me)
        update_data = {
            "name": "Arjun Kumar",
            "phone": "+91 98765 11111",
            "institution": "Demo Engineering College",
            "course": "B.Tech Computer Science",
            "year": "2nd Year",
            "cgpa": 8.55,
            "twelfth_percentage": 89.2,
            "category": "OBC",
            "state": "Karnataka",
            "annual_education_cost": 130000.0,
            "existing_support": 65000.0,
            "annual_family_income": 250000.0,
        }
        res_update = client.put(f"{BACKEND_URL}/api/v1/student/me", json=update_data)
        assert res_update.status_code == 200, f"Update failed: {res_update.status_code}"
        results["student_me_updated"] = res_update.json()
        print("PASS: PUT /api/v1/student/me -> Updated CGPA:", results["student_me_updated"]["profile"]["cgpa"])
        print("Updated Calculated Funding Gap (130000 - 65000):", results["student_me_updated"]["funding_profile"]["funding_gap"])
        assert results["student_me_updated"]["funding_profile"]["funding_gap"] == 65000.0

        # 5. Verify database persistence by reading back
        res_persisted = client.get(f"{BACKEND_URL}/api/v1/student/me")
        assert res_persisted.status_code == 200
        persisted_data = res_persisted.json()
        assert persisted_data["profile"]["cgpa"] == 8.55
        assert persisted_data["funding_profile"]["funding_gap"] == 65000.0
        print("PASS: Database persistence confirmed via subsequent GET")

        # 6. Reset back to exact prompt specifications for demo student
        reset_data = {
            "name": "Arjun Kumar",
            "phone": "+91 98765 43210",
            "institution": "Demo Engineering College",
            "course": "B.Tech Computer Science",
            "year": "2nd Year",
            "cgpa": 8.4,
            "twelfth_percentage": 89.2,
            "category": "OBC",
            "state": "Karnataka",
            "annual_education_cost": 120000.0,
            "existing_support": 60000.0,
            "annual_family_income": 240000.0,
        }
        res_reset = client.put(f"{BACKEND_URL}/api/v1/student/me", json=reset_data)
        assert res_reset.status_code == 200
        print("PASS: Reset to exact demo student baseline (120,000 cost, 60,000 support, 60,000 gap)")

        # 7. Test Frontend HTTP response
        res_frontend = client.get(f"{FRONTEND_URL}/")
        assert res_frontend.status_code == 200, f"Frontend failed: {res_frontend.status_code}"
        print("PASS: Frontend HTTP 200 on /")

        res_frontend_profile = client.get(f"{FRONTEND_URL}/profile")
        assert res_frontend_profile.status_code == 200, f"Frontend profile failed: {res_frontend_profile.status_code}"
        print("PASS: Frontend HTTP 200 on /profile")

    print("\nALL LIVE INTEGRATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_live_system()
