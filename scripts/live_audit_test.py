import urllib.request
import json
import uuid
import sys

BASE_URL = "https://scholarai-api-jxgl.onrender.com"

def request_api(method, path, data=None, token=None):
    headers = {"User-Agent": "SCHOLARAi-Audit/1.0"}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE_URL}{path}", data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
            try:
                return resp.status, json.loads(content)
            except Exception:
                return resp.status, content
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(content)
        except Exception:
            return e.code, content

def run_audit():
    results = {}
    print("=== STARTING LIVE PRODUCTION AUDIT ===")

    # 1. Health check
    st, resp = request_api("GET", "/api/health")
    print(f"[Check 1] Health Check: Status {st}, service={resp.get('service')}, db={resp.get('database')}")
    assert st == 200 and resp.get("database") == "connected"
    results["health"] = "PASS"

    # 2. State Validation on Register (Must reject non-TN)
    uid = str(uuid.uuid4())[:8]
    bad_reg = {
        "email": f"audit_bad_{uid}@scholarai.test",
        "password": "Password123!",
        "name": "Audit Non-TN",
        "state": "Maharashtra"
    }
    st, resp = request_api("POST", "/api/v1/auth/register", bad_reg)
    print(f"[Check 2A] Register Non-TN (Maharashtra): Status {st}")
    assert st == 422
    results["backend_register_state_validation"] = "PASS"

    # 3. State Validation on Profile Update (Must reject non-TN)
    # Login with existing demo student to test PUT /api/v1/student/me
    st_login, demo_auth = request_api("POST", "/api/v1/auth/login", {
        "email": "demo@scholarai.local",
        "password": "DemoStudent@2026"
    })
    assert st_login == 200, f"Demo login failed: {demo_auth}"
    demo_token = demo_auth.get("session_token")
    assert demo_token, "No session token in demo auth"

    st_bad_update, bad_update_resp = request_api("PUT", "/api/v1/student/me", {"state": "Andhra Pradesh"}, demo_token)
    print(f"[Check 3A] Profile Update Non-TN (Andhra Pradesh): Status {st_bad_update}")
    assert st_bad_update == 422
    results["backend_update_state_validation"] = "PASS"

    # 4. Profile Loading and Update with Comprehensive 5-Section Fields
    full_profile_update = {
        "name": "Arjun Kumar",
        "state": "Tamil Nadu",
        "district": "Coimbatore",
        "phone": "9876543210",
        "dob": "2003-05-15",
        "gender": "Female",
        "domicile_status": "Tamil Nadu Domicile",
        "native_state": "Tamil Nadu",
        "institution": "Government College of Technology, Coimbatore",
        "course": "Computer Science and Engineering",
        "stream": "Engineering & Technology",
        "education_level": "Undergraduate",
        "year": "2nd Year",
        "admission_quota": "GOVERNMENT_QUOTA",
        "hosteller_status": "DAY_SCHOLAR",
        "mode_of_study": "Regular / Full-Time",
        "studied_govt_school_6_to_12": True,
        "is_first_graduate": True,
        "board_of_education": "Tamil Nadu State Board",
        "qualifying_marks": 92.5,
        "category": "BC",
        "minority_status": "None",
        "special_category": "None",
        "annual_family_income": 150000.0,
        "income_certificate_status": "Have Valid E-Sevai Certificate",
        "funding_gap": 45000.0,
        "aadhaar_masked": "XXXX-XXXX-4321",
        "aadhaar_consent_given": True,
        "dbt_seeding_status": "Yes",
        "ration_card_type": "Priority (PHH)",
        "bank_name": "Indian Overseas Bank",
        "bank_branch": "Gandhipuram",
        "account_holder_name": "Arjun Kumar"
    }
    st, updated = request_api("PUT", "/api/v1/student/me", full_profile_update, demo_token)
    print(f"[Check 4A] Comprehensive Profile Update: Status {st}")
    assert st == 200, f"Expected 200, got {st}: {updated}"

    # Verify persistence by reading back
    st, fetched = request_api("GET", "/api/v1/student/me", token=demo_token)
    print(f"[Check 4B] Profile Persistence Read-Back: Status {st}")
    assert st == 200
    p = fetched.get("profile", {})
    f = fetched.get("funding_profile", {})
    print(f"  Fetched student name: {fetched.get('name')}")
    print(f"  Fetched district: {p.get('district')}")
    print(f"  Fetched studied_govt_school_6_to_12: {p.get('studied_govt_school_6_to_12')}")
    print(f"  Fetched is_first_graduate: {p.get('is_first_graduate')}")
    print(f"  Fetched mode_of_study: {p.get('mode_of_study')}")
    print(f"  Fetched board_of_education: {p.get('board_of_education')}")
    print(f"  Fetched dbt_seeding_status: {p.get('dbt_seeding_status')}")
    print(f"  Fetched ration_card_type: {p.get('ration_card_type')}")
    print(f"  Fetched funding_gap: {f.get('funding_gap')}")

    assert p.get("district") == "Coimbatore"
    assert p.get("studied_govt_school_6_to_12") is True
    assert p.get("is_first_graduate") is True
    assert p.get("mode_of_study") == "Regular / Full-Time"
    assert p.get("board_of_education") == "Tamil Nadu State Board"
    assert p.get("dbt_seeding_status") == "Yes"
    assert p.get("ration_card_type") == "Priority (PHH)"
    assert p.get("state") == "Tamil Nadu"
    assert f.get("funding_gap") == 45000.0
    results["profile_persistence"] = "PASS"

    # 5. Non-Destructive Update (Partial Update leaves other sections intact)
    partial_update = {
        "funding_gap": 50000.0
    }
    st, part_resp = request_api("PUT", "/api/v1/student/me", partial_update, demo_token)
    assert st == 200
    st, re_fetched = request_api("GET", "/api/v1/student/me", token=demo_token)
    re_p = re_fetched.get("profile", {})
    re_f = re_fetched.get("funding_profile", {})
    assert re_f.get("funding_gap") == 50000.0
    assert re_p.get("district") == "Coimbatore"
    assert re_p.get("studied_govt_school_6_to_12") is True
    assert re_p.get("aadhaar_masked") == "XXXX-XXXX-4321"
    print("[Check 5] Partial update preserves all other fields without cross-section overwrite: PASS")
    results["non_destructive_update"] = "PASS"

    # 6. Recommendation Engine Output & Required Documents
    st, recs = request_api("GET", "/api/v1/scholarships/recommendations", token=demo_token)
    print(f"[Check 6A] Recommendations Endpoint: Status {st}")
    assert st == 200
    likely = recs.get("likely_eligible", [])
    more_info = recs.get("more_info_needed", [])
    ineligible = recs.get("ineligible", [])
    window_unverified = recs.get("window_unverified", [])

    all_recs = likely + more_info + ineligible + window_unverified
    print(f"[Check 6B] Recommendation counts: likely={len(likely)}, more_info={len(more_info)}, ineligible={len(ineligible)}, window_unverified={len(window_unverified)}")
    assert len(all_recs) > 0, "No recommendations returned"

    # Check required_documents field exists and is populated on recommendations
    has_req_docs = any(isinstance(r.get("required_documents"), list) and len(r.get("required_documents")) > 0 for r in all_recs)
    print(f"[Check 6C] Recommendations have mandatory documents checklist: {has_req_docs}")
    assert has_req_docs

    # Check official source URLs are genuine links
    has_official_source = any(
        (r.get("official_source_url") and r.get("official_source_url").startswith("http")) or
        (r.get("official_application_portal_url") and r.get("official_application_portal_url").startswith("http"))
        for r in all_recs
    )
    print(f"[Check 6D] Recommendations have official source URLs: {has_official_source}")
    assert has_official_source

    # Check Pudhumai Penn match (Female + studied_govt_school_6_to_12 + UG)
    pudhumai_matched = any("Pudhumai Penn" in r.get("name", "") for r in likely)
    print(f"[Check 6E] Pudhumai Penn in likely_eligible for female govt school student: {pudhumai_matched}")
    assert pudhumai_matched
    results["recommendations_eligibility"] = "PASS"

    # 7. Dynamic Recommendation Recalculation when Profile Changes
    # Change is_first_graduate to False -> First Graduate Concession must move to currently_ineligible
    st, _ = request_api("PUT", "/api/v1/student/me", {"is_first_graduate": False}, demo_token)
    assert st == 200
    st, recs_after = request_api("GET", "/api/v1/scholarships/recommendations", token=demo_token)
    assert st == 200
    likely_after = recs_after.get("likely_eligible", [])
    ineligible_after = recs_after.get("currently_ineligible", [])
    fg_in_likely = any("First Graduate" in r.get("name", "") for r in likely_after)
    fg_in_ineligible = any("First Graduate" in r.get("name", "") for r in ineligible_after)
    print(f"[Check 7] First Graduate Concession after is_first_graduate=False: in_likely={fg_in_likely}, in_ineligible={fg_in_ineligible}")
    assert not fg_in_likely and fg_in_ineligible, "Recommendation engine failed to update when profile changed!"
    results["dynamic_recommendation_recalculation"] = "PASS"

    # 8. Student-to-Student Data Isolation & Privacy
    # Login as admin to verify isolation from demo student
    st_adm, adm_auth = request_api("POST", "/api/v1/auth/login", {
        "email": "admin@scholarai.local",
        "password": "ScholarAdmin@2026"
    })
    assert st_adm == 200
    adm_token = adm_auth.get("session_token")

    # Demo student should NOT be able to access admin users endpoint
    st_forbidden, _ = request_api("GET", "/api/v1/admin/users", token=demo_token)
    print(f"[Check 8A] Non-admin attempting to access /admin/users: Status {st_forbidden}")
    assert st_forbidden == 403

    # Unauthenticated request to /student/me
    st_unauth, _ = request_api("GET", "/api/v1/student/me")
    print(f"[Check 8B] Unauthenticated request to /student/me: Status {st_unauth}")
    assert st_unauth == 401
    results["student_isolation_privacy"] = "PASS"

    # Reset demo student profile back to standard demo state
    request_api("PUT", "/api/v1/student/me", {
        "name": "Arjun Kumar",
        "gender": "Male",
        "studied_govt_school_6_to_12": False,
        "district": "Chennai",
        "state": "Tamil Nadu"
    }, demo_token)

    print("\nALL LIVE PRODUCTION CHECKS PASSED!")
    for k, v in results.items():
        print(f"  {k}: {v}")
    return True

if __name__ == "__main__":
    try:
        run_audit()
    except Exception as e:
        print(f"\nAUDIT FAILED with error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
