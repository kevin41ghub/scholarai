import pytest
from fastapi.testclient import TestClient


def test_no_fictional_scholarships_in_production(auth_client: TestClient):
    """
    Acceptance Criteria: Verify that NO fictional demo scholarships
    (e.g., CSR STEM Bursary, Future Tech Foundation, DeepTech, etc.) exist in the catalogue.
    """
    res = auth_client.get("/api/v1/scholarships")
    assert res.status_code == 200
    scholarships = res.json()
    assert len(scholarships) >= 11

    fictional_names = [
        "CSR STEM Bursary",
        "NextGen Technology Grant",
        "Future Tech Foundation (Demo)",
        "DeepTech Alliance",
        "Ministry of Education (Demo)",
        "National Merit-cum-Means Scholarship",
        "State Welfare Fellowship",
        "Empower Future Scholarship",
        "Women in Technology Scholarship",
    ]
    for s in scholarships:
        assert s["name"] not in fictional_names, f"Fictional scholarship found: {s['name']}"
        assert "(Demo)" not in s["provider"], f"Demo provider found: {s['provider']}"
        assert s["verification_status"] != "DEMO_DATA", f"Demo status found on {s['name']}"


def test_stream_filtering_arts_science_vs_engineering(auth_client: TestClient):
    """
    Verify stream filtering for Arts & Science and Engineering.
    """
    # 1. Arts & Science stream
    res_as = auth_client.get("/api/v1/scholarships?stream=ARTS_SCIENCE")
    assert res_as.status_code == 200
    as_schemes = res_as.json()
    assert len(as_schemes) > 0
    for s in as_schemes:
        assert s["stream"] in ["ARTS_SCIENCE", "BOTH"]

    as_names = [s["name"] for s in as_schemes]
    assert "Free Education Scheme for 3-Year Degree Students (BC/MBC/DNC)" in as_names
    # Engineering-only schemes must NOT be returned
    assert "First Graduate (FG) Tuition Fee Concession" not in as_names
    assert "AICTE Pragati Scholarship for Girl Students" not in as_names

    # 2. Engineering stream
    res_eng = auth_client.get("/api/v1/scholarships?stream=ENGINEERING")
    assert res_eng.status_code == 200
    eng_schemes = res_eng.json()
    assert len(eng_schemes) > 0
    for s in eng_schemes:
        assert s["stream"] in ["ENGINEERING", "BOTH"]

    eng_names = [s["name"] for s in eng_schemes]
    assert "First Graduate (FG) Tuition Fee Concession" in eng_names
    assert "AICTE Pragati Scholarship for Girl Students" in eng_names
    # Arts & Science only schemes must NOT be returned
    assert "Free Education Scheme for 3-Year Degree Students (BC/MBC/DNC)" not in eng_names
    assert "TANSCHE Fellowship for Postgraduate Students" not in eng_names


def test_category_tag_filtering(auth_client: TestClient):
    """
    Verify category tag filtering (Women, Postgraduate, Differently-Abled).
    """
    # Women in Higher Education
    res_women = auth_client.get("/api/v1/scholarships?category_tag=Women")
    assert res_women.status_code == 200
    women_schemes = [s["name"] for s in res_women.json()]
    assert "Moovalur Ramamirtham Ammaiyar Higher Education Assurance Scheme (Pudhumai Penn)" in women_schemes
    assert "AICTE Pragati Scholarship for Girl Students" in women_schemes

    # Disability Support
    res_disability = auth_client.get("/api/v1/scholarships?category_tag=Disability")
    assert res_disability.status_code == 200
    disability_schemes = [s["name"] for s in res_disability.json()]
    assert "AICTE Saksham Scholarship for Differently-Abled Students" in disability_schemes


def test_autonomous_college_compatibility_metadata(auth_client: TestClient):
    """
    Verify that every scholarship record explicitly documents autonomous college compatibility.
    """
    res = auth_client.get("/api/v1/scholarships")
    assert res.status_code == 200
    for s in res.json():
        assert s["autonomous_compatibility"], f"Missing autonomous compatibility for {s['name']}"
        assert len(s["autonomous_compatibility"]) > 10
        assert s["dossier_index"].startswith("№ ")
        assert s["source_verification_status"] in ["SOURCE_VERIFIED", "PARTIALLY_VERIFIED"]


def test_explainable_disqualifications_for_profile(auth_client: TestClient):
    """
    Verify explainable disqualification reasons for mismatched profiles:
    Arjun Kumar is enrolled in B.Sc Computer Science (Arts & Science, Male, UG, BC).
    """
    res = auth_client.get("/api/v1/scholarships")
    schemes = {s["name"]: s for s in res.json()}

    # 1. First Graduate: Disqualified due to stream mismatch
    fg = schemes["First Graduate (FG) Tuition Fee Concession"]
    assert fg["match_status"] == "ineligible"
    assert any("Engineering" in r for r in fg["fit_reasons"] if "Ineligible" in r)

    # 2. AICTE Pragati: Disqualified due to stream and gender mismatch
    pragati = schemes["AICTE Pragati Scholarship for Girl Students"]
    assert pragati["match_status"] == "ineligible"
    all_reasons = (pragati.get("disqualification_reasons") or []) + (pragati.get("fit_reasons") or [])
    assert any("female" in r.lower() or "engineering" in r.lower() for r in all_reasons)

    # 3. TANSCHE Fellowship: Disqualified due to UG level
    tansche = schemes["TANSCHE Fellowship for Postgraduate Students"]
    assert tansche["match_status"] == "ineligible"
    assert any("Postgraduate" in r for r in tansche["fit_reasons"] if "Ineligible" in r)


def test_scholarship_detail_official_links(auth_client: TestClient):
    """
    Verify scholarship detail integrity, primary official URLs, and funding impact calculation.
    """
    res_list = auth_client.get("/api/v1/scholarships")
    scholarships = res_list.json()

    for s_summary in scholarships[:5]:
        res_detail = auth_client.get(f"/api/v1/scholarships/{s_summary['id']}")
        assert res_detail.status_code == 200
        detail = res_detail.json()
        assert detail["id"] == s_summary["id"]
        assert detail["official_guideline_url"].startswith("http")
        assert detail["source_url"].startswith("http")
        assert detail["dossier_index"] == s_summary["dossier_index"]
        assert len(detail["requirements"]) > 0


def test_application_records_remain_intact_during_catalog_query(auth_client: TestClient):
    """
    Acceptance Criteria: Verify user application records remain intact and unchanged.
    """
    # 1. Fetch applications
    res_apps = auth_client.get("/api/v1/applications")
    assert res_apps.status_code == 200
    apps_before = res_apps.json()
    assert len(apps_before) == 3

    # 2. Query catalogue multiple times with diverse filters
    auth_client.get("/api/v1/scholarships?stream=ARTS_SCIENCE")
    auth_client.get("/api/v1/scholarships?stream=ENGINEERING")
    auth_client.get("/api/v1/scholarships?category_tag=Women")

    # 3. Verify applications are intact
    res_apps_after = auth_client.get("/api/v1/applications")
    assert res_apps_after.status_code == 200
    apps_after = res_apps_after.json()
    assert len(apps_after) == len(apps_before)
    for b, a in zip(apps_before, apps_after):
        assert b["id"] == a["id"]
        assert b["status"] == a["status"]
        assert b["progress"] == a["progress"]
