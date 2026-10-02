import json
import httpx

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:3000"

def test_live_block2():
    with httpx.Client(timeout=10.0) as client:
        print("--- 1. Testing /api/health ---")
        res = client.get(f"{BACKEND_URL}/api/health")
        assert res.status_code == 200, f"Health failed: {res.status_code}"
        health = res.json()
        assert health["status"] == "healthy"
        print("PASS: /api/health ->", health["service"])

        print("\n--- 2. Testing Demo Student Baseline ---")
        res = client.get(f"{BACKEND_URL}/api/v1/student/me")
        assert res.status_code == 200
        student = res.json()
        assert student["name"] == "Arjun Kumar"
        funding = student["funding_profile"]
        assert funding["annual_education_cost"] == 120000.0
        assert funding["existing_support"] == 60000.0
        assert funding["funding_gap"] == 60000.0
        print(f"PASS: Demo Student: {student['name']}, Cost: INR {int(funding['annual_education_cost']):,}, Support: INR {int(funding['existing_support']):,}, Gap: INR {int(funding['funding_gap']):,}")

        print("\n--- 3. Testing Scholarships Discovery ---")
        res = client.get(f"{BACKEND_URL}/api/v1/scholarships")
        assert res.status_code == 200
        scholarships = res.json()
        assert len(scholarships) >= 8
        print(f"PASS: Retrieved {len(scholarships)} scholarships.")

        # Check specific demo scholarships
        names = {s["name"]: s for s in scholarships}
        assert "National Merit-cum-Means Scholarship" in names
        assert "NextGen Technology Grant" in names
        assert "State Welfare Fellowship" in names
        assert "PG Excellence Fellowship" in names
        assert "CSR STEM Bursary" in names
        assert "Regional Student Stipend" in names
        assert "Empower Future Scholarship" in names
        assert "Women in Technology Scholarship" in names

        # Eligibility checks
        assert names["National Merit-cum-Means Scholarship"]["match_status"] == "eligible"
        assert names["PG Excellence Fellowship"]["match_status"] == "ineligible"
        assert names["Women in Technology Scholarship"]["match_status"] == "ineligible"
        assert names["Regional Student Stipend"]["match_status"] == "needs_verification"
        print("PASS: Deterministic eligibility evaluations confirmed (Arjun is eligible for National Merit, ineligible for PG & Women in Tech).")

        print("\n--- 4. Testing Scholarship Detail & Funding Impact ---")
        nmm_id = names["National Merit-cum-Means Scholarship"]["id"]
        res = client.get(f"{BACKEND_URL}/api/v1/scholarships/{nmm_id}")
        assert res.status_code == 200
        detail = res.json()
        impact = detail["funding_impact"]
        assert impact["current_funding_gap"] == 60000.0
        assert impact["scholarship_amount"] == 50000.0
        assert impact["potential_remaining_gap"] == 10000.0
        print("PASS: Funding Impact: Gap INR 60,000 - Award INR 50,000 = Potential Remaining Gap INR 10,000")

        print("\n--- 5. Testing Shared Blocker & Cascade Unblocking ---")
        # Check initial documents
        res = client.get(f"{BACKEND_URL}/api/v1/documents")
        assert res.status_code == 200
        docs = {d["document_type"]: d for d in res.json()}
        income_doc = docs["INCOME_CERTIFICATE"]
        assert income_doc["status"] == "MISSING"
        assert income_doc["is_shared_blocker"] is True
        assert income_doc["affected_applications_count"] == 3
        assert income_doc["potential_funding_affected"] == 135000.0
        print(f"PASS: 'Income Certificate' is shared blocker blocking {income_doc['affected_applications_count']} apps (INR {int(income_doc['potential_funding_affected']):,} affected).")

        # Check initial portfolio summary
        res = client.get(f"{BACKEND_URL}/api/v1/applications/portfolio-summary")
        assert res.status_code == 200
        summary = res.json()
        assert summary["blocked_count"] == 3

        # Simulate student marking Income Certificate as AVAILABLE
        res = client.patch(
            f"{BACKEND_URL}/api/v1/documents/{income_doc['id']}",
            json={"status": "AVAILABLE"}
        )
        assert res.status_code == 200
        print("PASS: Patched Income Certificate to AVAILABLE.")

        # Verify cascade unblocking across active applications
        res = client.get(f"{BACKEND_URL}/api/v1/applications")
        assert res.status_code == 200
        apps = res.json()
        for app in apps:
            if app["scholarship_name"] in [
                "National Merit-cum-Means Scholarship",
                "CSR STEM Bursary",
                "State Welfare Fellowship"
            ]:
                assert app["progress"] == 100.0
                assert app["status"] == "READY"
        print("PASS: Cascade unblocking confirmed: dependent applications advanced to 100% progress and READY status!")

        # Verify portfolio summary shows 0 blocked
        res = client.get(f"{BACKEND_URL}/api/v1/applications/portfolio-summary")
        summary_after = res.json()
        assert summary_after["blocked_count"] == 0
        print("PASS: Blocked applications count dropped to 0.")

        # Reset Income Certificate back to MISSING for clean demo state
        client.patch(f"{BACKEND_URL}/api/v1/documents/{income_doc['id']}", json={"status": "MISSING"})
        print("PASS: Reset Income Certificate to MISSING for demo baseline.")

        print("\n--- 6. Testing Next-Best-Action & Planner ---")
        res = client.get(f"{BACKEND_URL}/api/v1/actions")
        assert res.status_code == 200
        actions = res.json()
        assert len(actions) > 0
        print(f"PASS: Generated {len(actions)} ranked next-best actions. Top action: '{actions[0]['title']}'.")

        res = client.get(f"{BACKEND_URL}/api/v1/planner")
        assert res.status_code == 200
        planner = res.json()
        assert planner["funding_overview"]["funding_gap"] == 60000.0
        assert len(planner["suggested_weekly_plan"]["allocations"]) > 0
        print(f"PASS: Weekly plan allocations generated for {planner['suggested_weekly_plan']['total_hours']} hours.")

        print("\n--- 7. Testing Frontend HTTP Routes ---")
        routes = ["/", "/discover", f"/discover/{nmm_id}", "/applications", "/documents", "/goal", "/profile"]
        for r in routes:
            res = client.get(f"{FRONTEND_URL}{r}")
            assert res.status_code == 200, f"Route {r} failed with {res.status_code}"
            print(f"PASS: Frontend HTTP 200 on {r}")

    print("\n=======================================================")
    print("ALL BLOCK 2 LIVE INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("=======================================================")

if __name__ == "__main__":
    test_live_block2()
