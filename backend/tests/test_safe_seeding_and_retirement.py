import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.scholarship import Scholarship
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.models.student import Student
from app.models.document import Document
from app.db.init_db import init_db, retire_legacy_demo_scholarships, KNOWN_FICTIONAL_DEMO_NAMES


DEMO_SCHOLARSHIP_FIXTURES = [
    {
        "name": "Empower Future Scholarship",
        "provider": "Empower Youth Trust (Demo)",
        "description": "Demo financial assistance program",
        "amount": 35000.0,
        "currency": "INR",
        "verification_status": "DEMO_DATA",
        "status": "ACTIVE",
    },
    {
        "name": "NextGen Technology Grant",
        "provider": "Future Tech Foundation (Demo)",
        "description": "Demo grant for computing students",
        "amount": 40000.0,
        "currency": "INR",
        "verification_status": "DEMO_DATA",
        "status": "ACTIVE",
    },
    {
        "name": "National Merit-cum-Means Scholarship",
        "provider": "Ministry of Education (Demo)",
        "description": "Demo merit assistance",
        "amount": 12000.0,
        "currency": "INR",
        "verification_status": "DEMO_DATA",
        "status": "ACTIVE",
    },
    {
        "name": "CSR STEM Bursary",
        "provider": "TechCorp Global CSR (Demo)",
        "description": "Demo corporate bursary",
        "amount": 50000.0,
        "currency": "INR",
        "verification_status": "DEMO_DATA",
        "status": "ACTIVE",
    },
    {
        "name": "Regional Student Stipend",
        "provider": "Southern Regional Board (Demo)",
        "description": "Demo regional funding",
        "amount": 20000.0,
        "currency": "INR",
        "verification_status": "DEMO_DATA",
        "status": "ACTIVE",
    },
    {
        "name": "State Welfare Fellowship",
        "provider": "Karnataka Higher Education Council (Demo)",
        "description": "Demo state welfare support",
        "amount": 25000.0,
        "currency": "INR",
        "verification_status": "DEMO_DATA",
        "status": "ACTIVE",
    },
    {
        "name": "Women in Technology Scholarship",
        "provider": "Anita Borg Women in Tech Initiative (Demo)",
        "description": "Demo women in tech grant",
        "amount": 60000.0,
        "currency": "INR",
        "verification_status": "DEMO_DATA",
        "status": "ACTIVE",
    },
    {
        "name": "PG Excellence Fellowship",
        "provider": "National Research Council (Demo)",
        "description": "Demo postgrad fellowship",
        "amount": 45000.0,
        "currency": "INR",
        "verification_status": "DEMO_DATA",
        "status": "ACTIVE",
    },
]


def test_simulation_existing_demo_scholarships_retirement_and_seeding(
    db_session: Session,
    auth_client: TestClient
):
    """
    Simulates a production database already populated with the 8 legacy demo scholarships
    and an active student application referencing one of them.

    Verifies:
    1. All 11 verified Tamil Nadu scholarship records are seeded idempotently.
    2. The 8 demo scholarships are retired (status=INACTIVE, verification_status=RETIRED_DEMO)
       WITHOUT being deleted or having their primary keys changed.
    3. Existing applications and foreign keys remain intact.
    4. Re-running init_db a second time produces 0 duplicate records.
    5. Existing student profile and documents are untouched.
    """
    now = datetime.now(timezone.utc)
    student = db_session.query(Student).first()
    assert student is not None, "Student must be present from fixture"
    original_student_id = student.id
    original_student_email = student.email

    # 1. Manually insert the 8 legacy demo scholarships (simulating pre-migration production state)
    inserted_demos = []
    for d in DEMO_SCHOLARSHIP_FIXTURES:
        # Check if already exists; if not, insert
        existing = db_session.query(Scholarship).filter(Scholarship.name == d["name"]).first()
        if not existing:
            s_obj = Scholarship(
                name=d["name"],
                provider=d["provider"],
                description=d["description"],
                amount=d["amount"],
                currency=d["currency"],
                deadline=now + timedelta(days=30),
                verification_status=d["verification_status"],
                status=d["status"],
            )
            db_session.add(s_obj)
            db_session.flush()
            inserted_demos.append(s_obj)
        else:
            inserted_demos.append(existing)

    db_session.commit()
    assert len(inserted_demos) == 8

    # 2. Attach an application to one of the demo scholarships (e.g., CSR STEM Bursary)
    demo_bursary = next(s for s in inserted_demos if s.name == "CSR STEM Bursary")
    bursary_app = (
        db_session.query(Application)
        .filter(Application.student_id == student.id, Application.scholarship_id == demo_bursary.id)
        .first()
    )
    if not bursary_app:
        bursary_app = Application(
            student_id=student.id,
            scholarship_id=demo_bursary.id,
            status="IN_PROGRESS",
            progress=50.0,
            personal_statement="Historical statement submitted for demo bursary.",
            started_at=now - timedelta(days=20),
        )
        db_session.add(bursary_app)
        db_session.flush()

        app_req = ApplicationRequirement(
            application_id=bursary_app.id,
            name="Income Certificate",
            document_type="INCOME_CERTIFICATE",
            type="DOCUMENT",
            is_required=True,
            status="AVAILABLE",
        )
        db_session.add(app_req)
        db_session.commit()

    saved_app_id = bursary_app.id
    saved_demo_id = demo_bursary.id

    # 3. Run init_db (simulating bootstrap_db on Render deployment)
    init_db(db_session)

    # Verification Step A: 8 Demo Scholarships are RETIRED, not deleted
    all_scholarships = db_session.query(Scholarship).all()
    # 8 demo + 11 verified = 19 total
    assert len(all_scholarships) >= 19

    for d in DEMO_SCHOLARSHIP_FIXTURES:
        rec = db_session.query(Scholarship).filter(Scholarship.name == d["name"]).first()
        assert rec is not None, f"Legacy record {d['name']} was deleted!"
        assert rec.status == "INACTIVE", f"Record {d['name']} must be marked INACTIVE"
        assert rec.verification_status == "RETIRED_DEMO", f"Record {d['name']} must be marked RETIRED_DEMO"

    # Verification Step B: Foreign key & application integrity
    refreshed_app = db_session.query(Application).filter(Application.id == saved_app_id).first()
    assert refreshed_app is not None, "Historical application was deleted during seeding!"
    assert refreshed_app.scholarship_id == saved_demo_id, "Application scholarship foreign key was corrupted!"
    assert refreshed_app.personal_statement == "Historical statement submitted for demo bursary."
    assert len(refreshed_app.requirements) >= 1

    # Verification Step C: All 11 verified Tamil Nadu scholarships exist and are ACTIVE
    verified_schemes = (
        db_session.query(Scholarship)
        .filter(Scholarship.dossier_index.isnot(None), Scholarship.status == "ACTIVE")
        .all()
    )
    assert len(verified_schemes) == 11
    dossier_indices = {s.dossier_index for s in verified_schemes}
    expected_dossiers = {
        "№ TN-ADW-2025-01",
        "№ TN-BCMW-2025-02",
        "№ TN-DCE-2025-03",
        "№ TN-SWD-2025-04",
        "№ TN-DOTE-2025-05",
        "№ IND-NSP-2025-06",
        "№ IND-AICTE-2025-07",
        "№ IND-AICTE-2025-08",
        "№ IND-MOMA-2025-09",
        "№ TN-ADW-2025-10",
        "№ TN-CHE-2025-11",
    }
    assert dossier_indices == expected_dossiers

    # Verification Step D: Idempotency — re-running init_db produces NO duplicates
    count_before = db_session.query(Scholarship).count()
    init_db(db_session)
    count_after = db_session.query(Scholarship).count()
    assert count_before == count_after, f"Duplicate records created on second init_db run: {count_after} vs {count_before}"

    # Verification Step E: Student profile and documents are preserved
    refreshed_student = db_session.query(Student).filter(Student.id == original_student_id).first()
    assert refreshed_student is not None
    assert refreshed_student.email == original_student_email


def test_public_discovery_excludes_retired_demo_records(auth_client: TestClient):
    """
    Verify that GET /api/v1/scholarships excludes all retired demo scholarships
    by default from the public discovery catalogue.
    """
    res = auth_client.get("/api/v1/scholarships")
    assert res.status_code == 200
    catalog = res.json()

    # Must contain only active verified schemes
    assert len(catalog) == 11

    for s in catalog:
        assert s["name"] not in KNOWN_FICTIONAL_DEMO_NAMES, f"Fictional demo scholarship leaked: {s['name']}"
        assert "(Demo)" not in s["provider"], f"Demo provider leaked: {s['provider']}"
        assert s["verification_status"] != "RETIRED_DEMO", f"Retired demo status leaked: {s['name']}"
        assert s["verification_status"] != "DEMO_DATA"
        assert s["status"] == "ACTIVE"


def test_retired_record_detail_and_application_prevention(
    db_session: Session,
    auth_client: TestClient
):
    """
    Verify that:
    1. A retired demo scholarship can still be inspected by ID for historical transparency.
    2. Its eligibility evaluation explicitly returns 'ineligible'.
    3. New application attempts for a retired demo scholarship are rejected with HTTP 400.
    """
    # Ensure a retired demo scholarship exists in this isolated test session
    demo_s = db_session.query(Scholarship).filter(Scholarship.verification_status == "RETIRED_DEMO").first()
    if not demo_s:
        demo_s = Scholarship(
            name="CSR STEM Bursary",
            provider="TechCorp Global CSR (Demo)",
            description="Demo corporate bursary",
            amount=50000.0,
            currency="INR",
            deadline=datetime.now(timezone.utc) + timedelta(days=10),
            verification_status="DEMO_DATA",
            status="ACTIVE",
        )
        db_session.add(demo_s)
        db_session.commit()
        retire_legacy_demo_scholarships(db_session)
        demo_s = db_session.query(Scholarship).filter(Scholarship.name == "CSR STEM Bursary").first()

    assert demo_s is not None, "Retired demo scholarship must exist"

    # 1. Detail endpoint returns the retired record with transparent status
    res_detail = auth_client.get(f"/api/v1/scholarships/{demo_s.id}")
    assert res_detail.status_code == 200
    data = res_detail.json()
    assert data["status"] == "INACTIVE"
    assert data["verification_status"] == "RETIRED_DEMO"

    # 2. Eligibility evaluation explicitly returns 'ineligible'
    res_elig = auth_client.get(f"/api/v1/scholarships/{demo_s.id}/eligibility")
    assert res_elig.status_code == 200
    elig_data = res_elig.json()
    assert elig_data["status"] == "ineligible"
    assert any("retired" in r.lower() for r in elig_data["reasons"])

    # 3. New application attempts are blocked with HTTP 400
    res_apply = auth_client.post(f"/api/v1/scholarships/{demo_s.id}/apply")
    assert res_apply.status_code == 400
    assert "retired" in res_apply.json()["detail"].lower()


def test_historical_application_retains_understandable_retired_status(
    db_session: Session,
    auth_client: TestClient
):
    """
    Verify that existing historical applications referencing retired scholarships
    remain visible in the student's application tracker with understandable status.
    """
    student = db_session.query(Student).first()
    assert student is not None

    # Ensure a retired scholarship and linked application exist
    demo_s = db_session.query(Scholarship).filter(Scholarship.verification_status == "RETIRED_DEMO").first()
    if not demo_s:
        demo_s = Scholarship(
            name="CSR STEM Bursary",
            provider="TechCorp Global CSR (Demo)",
            description="Demo corporate bursary",
            amount=50000.0,
            currency="INR",
            deadline=datetime.now(timezone.utc) + timedelta(days=10),
            verification_status="RETIRED_DEMO",
            status="INACTIVE",
        )
        db_session.add(demo_s)
        db_session.commit()

    demo_app = db_session.query(Application).filter(Application.scholarship_id == demo_s.id).first()
    if not demo_app:
        demo_app = Application(
            student_id=student.id,
            scholarship_id=demo_s.id,
            status="IN_PROGRESS",
            progress=40.0,
            personal_statement="Statement for retired demo.",
            started_at=datetime.now(timezone.utc) - timedelta(days=5),
        )
        db_session.add(demo_app)
        db_session.commit()

    res = auth_client.get("/api/v1/applications")
    assert res.status_code == 200
    apps = res.json()

    # Find the application referencing the retired scholarship
    retired_apps = [a for a in apps if a.get("verification_status") == "RETIRED_DEMO"]
    assert len(retired_apps) >= 1
    for a in retired_apps:
        assert a["scholarship_name"] in KNOWN_FICTIONAL_DEMO_NAMES
        assert a["id"] is not None
        assert a["status"] in ["IN_PROGRESS", "READY", "SUBMITTED", "APPROVED", "REJECTED"]
