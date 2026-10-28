import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.funding_profile import FundingProfile
from app.models.scholarship import Scholarship
from app.models.eligibility_rule import EligibilityRule
from app.services.eligibility_service import eligibility_service
from app.db.migrations import run_schema_migrations


def test_student_profile_creation_and_defaults(auth_client: TestClient):
    """
    Acceptance Criteria (Task 3):
    Verify that student profile includes admission_quota, hosteller_status,
    and is_first_graduate with appropriate defaults for legacy and newly seeded records.
    """
    res = auth_client.get("/api/v1/student/me")
    assert res.status_code == 200
    data = res.json()
    assert "profile" in data
    profile = data["profile"]
    assert profile is not None
    assert profile["admission_quota"] in ["GOVERNMENT_QUOTA", "MANAGEMENT_QUOTA"]
    assert profile["hosteller_status"] in ["DAY_SCHOLAR", "HOSTELLER"]
    assert isinstance(profile["is_first_graduate"], bool)


def test_student_profile_update(auth_client: TestClient):
    """
    Acceptance Criteria (Task 3):
    Verify that updating admission_quota, hosteller_status, and is_first_graduate
    validates, saves, and retrieves properly.
    """
    update_payload = {
        "admission_quota": "MANAGEMENT_QUOTA",
        "hosteller_status": "HOSTELLER",
        "is_first_graduate": True,
    }
    res_put = auth_client.put("/api/v1/student/me", json=update_payload)
    assert res_put.status_code == 200
    updated = res_put.json()
    assert updated["profile"]["admission_quota"] == "MANAGEMENT_QUOTA"
    assert updated["profile"]["hosteller_status"] == "HOSTELLER"
    assert updated["profile"]["is_first_graduate"] is True

    # Confirm persistence with a fresh GET
    res_get = auth_client.get("/api/v1/student/me")
    assert res_get.status_code == 200
    persisted = res_get.json()
    assert persisted["profile"]["admission_quota"] == "MANAGEMENT_QUOTA"
    assert persisted["profile"]["hosteller_status"] == "HOSTELLER"
    assert persisted["profile"]["is_first_graduate"] is True

    # Revert back to defaults
    revert_payload = {
        "admission_quota": "GOVERNMENT_QUOTA",
        "hosteller_status": "DAY_SCHOLAR",
        "is_first_graduate": False,
    }
    auth_client.put("/api/v1/student/me", json=revert_payload)


def test_student_profile_migration_idempotent(db_session: Session):
    """
    Acceptance Criteria (Task 3):
    Verify non-destructive schema migrations can run repeatedly without error
    and correctly ensure admission_quota, hosteller_status, and is_first_graduate columns exist.
    """
    bind = db_session.get_bind()
    # Execute multiple times
    run_schema_migrations(bind)
    run_schema_migrations(bind)

    student = db_session.query(Student).first()
    assert student is not None
    assert student.profile is not None
    assert hasattr(student.profile, "admission_quota")
    assert hasattr(student.profile, "hosteller_status")
    assert hasattr(student.profile, "is_first_graduate")


def test_legacy_record_with_null_attributes(db_session: Session):
    """
    Acceptance Criteria (Task 3):
    Verify that legacy records with NULL/missing quota or first-graduate attributes
    do not crash the eligibility engine and do NOT cause unrelated scholarships to be rejected.
    """
    # 1. Create a dummy legacy student with None for the new fields
    legacy_student = Student(
        name="Legacy Student",
        email="legacy.student@example.edu",
        phone="+91 99999 88888",
    )
    db_session.add(legacy_student)
    db_session.flush()

    legacy_profile = StudentProfile(
        student_id=legacy_student.id,
        institution="Madras Christian College",
        course="B.Sc Mathematics",
        year="1st Year",
        cgpa=8.0,
        twelfth_percentage=85.0,
        category="BC",
        state="Tamil Nadu",
        gender="Female",
        admission_quota=None,
        hosteller_status=None,
        is_first_graduate=None,
    )
    db_session.add(legacy_profile)

    legacy_funding = FundingProfile(
        student_id=legacy_student.id,
        annual_education_cost=40000.0,
        existing_support=0.0,
        annual_family_income=150000.0,
    )
    db_session.add(legacy_funding)
    db_session.commit()

    # 2. Check against scholarship with no quota rule (e.g. Free Education Scheme)
    free_ed = db_session.query(Scholarship).filter(
        Scholarship.name.ilike("%Free Education Scheme%")
    ).first()
    assert free_ed is not None

    eval_res = eligibility_service.evaluate_scholarship(legacy_student, free_ed)
    # Must NOT be hard-rejected because of null quota or null first_graduate
    assert eval_res["status"] in ["eligible", "needs_verification"]
    assert not any("quota" in r.lower() for r in eval_res["unmatched_rules"])
    assert not any("first-generation" in r.lower() for r in eval_res["unmatched_rules"])

    # 3. Check against a scholarship that specifically requires FIRST_GRADUATE
    fg_scheme = db_session.query(Scholarship).filter(
        Scholarship.name.ilike("%First Graduate%")
    ).first()
    assert fg_scheme is not None

    fg_eval = eligibility_service.evaluate_scholarship(legacy_student, fg_scheme)
    # Because legacy student has is_first_graduate=None, rule should be marked as needs_verification, not crashed
    assert any("First Graduate status needs verification" in note for note in fg_eval["verification_notes"])


def test_deterministic_eligibility_first_graduate_and_quota_rules(db_session: Session):
    """
    Acceptance Criteria (Task 3):
    Verify deterministic eligibility evaluates first graduate and quota attributes accurately
    only when documented on a scholarship.
    """
    # Create an Engineering candidate
    eng_student = Student(
        name="Karthik Raja",
        email="karthik.engineering@example.edu",
        phone="+91 91234 56789",
    )
    db_session.add(eng_student)
    db_session.flush()

    eng_profile = StudentProfile(
        student_id=eng_student.id,
        institution="PSG College of Technology (Autonomous), Coimbatore",
        course="B.E. Computer Science and Engineering",
        year="1st Year",
        cgpa=8.8,
        twelfth_percentage=94.5,
        category="BC",
        state="Tamil Nadu",
        gender="Male",
        admission_quota="GOVERNMENT_QUOTA",
        hosteller_status="DAY_SCHOLAR",
        is_first_graduate=True,
    )
    db_session.add(eng_profile)

    eng_funding = FundingProfile(
        student_id=eng_student.id,
        annual_education_cost=85000.0,
        existing_support=0.0,
        annual_family_income=300000.0,
    )
    db_session.add(eng_funding)
    db_session.commit()

    fg_scheme = db_session.query(Scholarship).filter(
        Scholarship.name.ilike("%First Graduate%")
    ).first()
    assert fg_scheme is not None

    # Case A: First Graduate = True, Government Quota = True -> Matches both
    res_a = eligibility_service.evaluate_scholarship(eng_student, fg_scheme)
    assert any("First graduate in immediate family verified" in m for m in res_a["matched_rules"])
    assert any("Admission quota 'GOVERNMENT_QUOTA' satisfies statutory requirement" in m for m in res_a["matched_rules"])
    assert res_a["status"] == "eligible"

    # Case B: First Graduate = False -> Hard Ineligible with clear explanation
    eng_profile.is_first_graduate = False
    db_session.commit()
    res_b = eligibility_service.evaluate_scholarship(eng_student, fg_scheme)
    assert res_b["status"] == "ineligible"
    assert any("Scheme is restricted to first-generation graduates" in u for u in res_b["unmatched_rules"])

    # Case C: First Graduate = True, Admission Quota = MANAGEMENT_QUOTA -> Hard Ineligible with clear explanation
    eng_profile.is_first_graduate = True
    eng_profile.admission_quota = "MANAGEMENT_QUOTA"
    db_session.commit()
    res_c = eligibility_service.evaluate_scholarship(eng_student, fg_scheme)
    assert res_c["status"] == "ineligible"
    assert any("Scheme restricted to GOVERNMENT_QUOTA admissions" in u for u in res_c["unmatched_rules"])


def test_hosteller_status_rule_evaluation(db_session: Session):
    """
    Acceptance Criteria (Task 3):
    Verify that HOSTELLER rule evaluates accurately when a scheme specifies hosteller restrictions.
    """
    student = db_session.query(Student).first()
    assert student is not None
    student.profile.hosteller_status = "DAY_SCHOLAR"
    db_session.commit()

    # Create dummy scholarship requiring hosteller status
    hostel_scheme = Scholarship(
        name="Test State Hostel Boarding Stipend",
        provider="Tamil Nadu Adi Dravidar and Tribal Welfare Department",
        description="State residential hostel allowance for higher education students.",
        amount=15000.0,
        currency="INR",
        deadline=student.created_at,
        verification_status="SOURCE_VERIFIED",
        status="ACTIVE",
        stream="BOTH",
        study_level="BOTH",
    )
    db_session.add(hostel_scheme)
    db_session.flush()

    rule = EligibilityRule(
        scholarship_id=hostel_scheme.id,
        rule_type="HOSTELLER_STATUS",
        criteria_value="HOSTELLER",
        operator="EQUALS",
        description="Must reside in recognized collegiate hostel",
        is_mandatory=True,
    )
    db_session.add(rule)
    db_session.commit()

    # Day Scholar student should be ineligible
    eval_day = eligibility_service.evaluate_scholarship(student, hostel_scheme)
    assert eval_day["status"] == "ineligible"
    assert any("Scheme restricted to HOSTELLER" in u for u in eval_day["unmatched_rules"])

    # Hosteller student should match
    student.profile.hosteller_status = "HOSTELLER"
    db_session.commit()
    eval_hostel = eligibility_service.evaluate_scholarship(student, hostel_scheme)
    assert any("Residential status 'HOSTELLER' satisfies scheme requirement" in m for m in eval_hostel["matched_rules"])
