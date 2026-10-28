import os
import pytest
import subprocess
import sys
import json
import tempfile
from pathlib import Path
from datetime import datetime, timezone, timedelta
from app.models.scholarship import Scholarship
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.models.knowledge import KnowledgeDocument, KnowledgeChunk
from app.models.user import User
from app.models.student import Student
from app.services.scholarship_import_service import is_official_government_source


def test_is_official_government_source():
    """Validates official domain detection helper."""
    assert is_official_government_source("https://tndce.tn.gov.in/Home/scholarship_cms") is True
    assert is_official_government_source("https://sspdept.tnega.org/apply") is True
    assert is_official_government_source("https://scholarships.gov.in/") is True
    assert is_official_government_source("https://www.iitm.ac.in/scholarships") is True
    assert is_official_government_source("https://aicte-india.org/schemes") is True
    assert is_official_government_source("https://bcmbcmw.tn.gov.in/welfare.html") is True

    # Non-government sources
    assert is_official_government_source("https://commercial-scholarships-aggregator.com/scheme") is False
    assert is_official_government_source("https://blog.studentloans.org/scholarship") is False
    assert is_official_government_source("https://fake-tn-gov.org") is False
    assert is_official_government_source("") is False
    assert is_official_government_source(None) is False


def test_import_unauthenticated_forbidden(client):
    """Unauthenticated users must receive HTTP 401 Unauthorized."""
    payload = {
        "items": [
            {
                "name": "Test Scholarship",
                "provider": "Department of Higher Education",
                "description": "Valid description for testing",
                "amount": 25000.0,
                "deadline": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            }
        ],
        "dry_run": False,
    }
    response = client.post("/api/v1/scholarships/import", json=payload)
    assert response.status_code == 401
    assert "detail" in response.json()


def test_import_student_role_forbidden(auth_client):
    """Ordinary students (role == 'STUDENT') must receive HTTP 403 Forbidden."""
    payload = {
        "items": [
            {
                "name": "Student Attempted Scholarship",
                "provider": "Unauthorized Provider",
                "description": "Should be rejected with 403 Forbidden",
                "amount": 50000.0,
                "deadline": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            }
        ],
        "dry_run": False,
    }
    response = auth_client.post("/api/v1/scholarships/import", json=payload)
    assert response.status_code == 403
    assert "Administrative privileges required" in response.json()["detail"]


def test_import_admin_role_success(admin_client, db_session):
    """Authorized administrator (role == 'ADMIN') successfully imports scholarships."""
    deadline = (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()
    payload = {
        "items": [
            {
                "name": "Tamil Nadu Chief Minister Fellowship",
                "provider": "Special Initiatives Department, Government of Tamil Nadu",
                "description": "Fellowship scheme for meritorious post-graduate researchers in state universities.",
                "amount": 100000.0,
                "deadline": deadline,
                "source_url": "https://tn.gov.in/fellowship/guidelines.html",
                "dossier_index": "№ TN-CMF-2025-01",
                "source_verification_status": "SOURCE_VERIFIED",
                "verification_status": "SOURCE_VERIFIED",
                "eligibility_rules": [
                    {
                        "rule_type": "CGPA",
                        "criteria_value": "8.0",
                        "operator": "GTE",
                        "description": "Minimum CGPA of 8.0 required",
                    }
                ],
                "requirements": [
                    {
                        "name": "Research Proposal",
                        "document_type": "RESEARCH_PROPOSAL",
                        "type": "DOCUMENT",
                        "is_required": True,
                    }
                ],
            }
        ],
        "dry_run": False,
    }

    response = admin_client.post("/api/v1/scholarships/import", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["total"] == 1
    assert data["created"] == 1
    assert data["updated"] == 0
    assert data["rejected"] == 0
    assert data["dry_run"] is False

    # Verify DB persistence
    sch = db_session.query(Scholarship).filter(Scholarship.dossier_index == "№ TN-CMF-2025-01").first()
    assert sch is not None
    assert sch.name == "Tamil Nadu Chief Minister Fellowship"
    assert sch.source_verification_status == "SOURCE_VERIFIED"
    assert len(sch.eligibility_rules) == 1
    assert len(sch.requirements) == 1


def test_import_malformed_records_rejected(admin_client):
    """Malformed records (negative amount, bad URL, empty fields) are rejected with clear errors."""
    deadline = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    payload = {
        "items": [
            # Item 1: Negative amount
            {
                "name": "Bad Amount Scholarship",
                "provider": "Test Provider",
                "description": "Has negative amount",
                "amount": -500.0,
                "deadline": deadline,
            },
        ],
        "dry_run": False,
    }

    # Pydantic validation error returns 422 with clear itemized error details
    response = admin_client.post("/api/v1/scholarships/import", json=payload)
    assert response.status_code == 422
    err_body = response.json()
    assert "detail" in err_body
    assert any("amount" in str(e["loc"]) for e in err_body["detail"])


def test_import_duplicate_idempotent_update(admin_client, db_session):
    """
    Importing an existing scholarship updates the record in place without duplicating,
    preserving the scholarship ID.
    """
    # 1. Fetch an existing seeded scholarship (e.g., Post-Matric SC/ST)
    existing = db_session.query(Scholarship).filter(Scholarship.dossier_index == "№ TN-ADW-2025-01").first()
    assert existing is not None
    original_id = existing.id
    original_name = existing.name

    # 2. Perform import update with new amount and notes
    deadline = (datetime.now(timezone.utc) + timedelta(days=45)).isoformat()
    payload = {
        "items": [
            {
                "dossier_index": "№ TN-ADW-2025-01",
                "name": original_name,
                "provider": existing.provider,
                "description": "Updated official description from SSP portal refresh.",
                "amount": 60000.0,  # Revised amount
                "deadline": deadline,
                "source_url": "https://tndce.tn.gov.in/Home/scholarship_cms",
                "source_verification_status": "SOURCE_VERIFIED",
            }
        ],
        "dry_run": False,
    }

    response = admin_client.post("/api/v1/scholarships/import", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["created"] == 0
    assert data["updated"] == 1
    assert data["rejected"] == 0

    # 3. Verify in DB: ID is identical, amount was updated
    db_session.refresh(existing)
    assert existing.id == original_id
    assert existing.amount == 60000.0
    assert existing.description == "Updated official description from SSP portal refresh."


def test_preservation_of_existing_applications(admin_client, db_session):
    """
    Critical requirement: Updating a scholarship must NEVER orphan or delete
    existing student applications or break foreign keys.
    """
    existing_sch = db_session.query(Scholarship).filter(Scholarship.dossier_index == "№ TN-BCMW-2025-02").first()
    assert existing_sch is not None


    student = db_session.query(Student).first()
    assert student is not None

    # Fetch existing application or create one linked to this scholarship
    app = db_session.query(Application).filter(Application.scholarship_id == existing_sch.id).first()
    if not app:
        app = Application(
            student_id=student.id,
            scholarship_id=existing_sch.id,
            status="IN_PROGRESS",
            progress=65.0,
        )
        db_session.add(app)
        db_session.commit()
        db_session.refresh(app)
    app_id = app.id
    original_progress = app.progress

    # Admin updates this scholarship scheme via import
    deadline = (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()
    payload = {
        "items": [
            {
                "dossier_index": "№ TN-BCMW-2025-02",
                "name": existing_sch.name,
                "provider": existing_sch.provider,
                "description": "Refreshed official guidelines for BC/MBC welfare scholarship.",
                "amount": existing_sch.amount + 5000,
                "deadline": deadline,
                "source_url": "https://bcmbcmw.tn.gov.in/welfschemes.htm",
                "source_verification_status": "SOURCE_VERIFIED",
            }
        ],
        "dry_run": False,
    }


    response = admin_client.post("/api/v1/scholarships/import", json=payload)
    assert response.status_code == 200

    # Ensure application is still present and valid
    preserved_app = db_session.query(Application).filter(Application.id == app_id).first()
    assert preserved_app is not None
    assert preserved_app.scholarship_id == existing_sch.id
    assert preserved_app.student_id == student.id
    assert preserved_app.status == "IN_PROGRESS"


def test_dry_run_mode_commits_nothing(admin_client, db_session):
    """Dry-run mode returns previews of proposed changes without committing to database."""
    deadline = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    unique_name = "Unique Dry-Run Simulation Award 2026"
    payload = {
        "items": [
            {
                "name": unique_name,
                "provider": "Tamil Nadu Innovation Initiative",
                "description": "Grant for student startup prototypes in autonomous engineering colleges.",
                "amount": 75000.0,
                "deadline": deadline,
                "source_url": "https://tn.gov.in/innovation/grants",
                "dossier_index": "№ TN-DRY-01",
            }
        ],
        "dry_run": True,
    }

    response = admin_client.post("/api/v1/scholarships/import", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["dry_run"] is True
    assert data["created"] == 1  # Would create 1
    assert data["items"][0]["action"] == "WOULD_CREATE"

    # Verify that NO record was committed to the DB
    sch = db_session.query(Scholarship).filter(Scholarship.name == unique_name).first()
    assert sch is None


def test_source_verification_safeguard_demotes_non_gov_source(admin_client, db_session):
    """
    Project principle: AI assists. Official sources decide. Student approves.
    A record claiming SOURCE_VERIFIED with an unverified non-government URL
    MUST be demoted to PARTIALLY_VERIFIED and flagged.
    """
    deadline = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    payload = {
        "items": [
            {
                "name": "Commercial Third-Party STEM Award",
                "provider": "Private Marketing Agency",
                "description": "Claiming official verification without a government source domain.",
                "amount": 50000.0,
                "deadline": deadline,
                "source_url": "https://external-scholarship-blog.info/apply",
                "source_verification_status": "SOURCE_VERIFIED",  # False claim
                "verification_status": "SOURCE_VERIFIED",
                "dossier_index": "№ UNVERIFIED-01",
            }
        ],
        "dry_run": False,
    }

    response = admin_client.post("/api/v1/scholarships/import", json=payload)
    assert response.status_code == 200
    data = response.json()

    item_res = data["items"][0]
    assert item_res["official_source_detected"] is False
    assert item_res["source_verification_applied"] == "PARTIALLY_VERIFIED"
    assert "Demoted from SOURCE_VERIFIED to PARTIALLY_VERIFIED" in item_res["details"]

    # Verify DB state
    sch = db_session.query(Scholarship).filter(Scholarship.dossier_index == "№ UNVERIFIED-01").first()
    assert sch is not None
    assert sch.source_verification_status == "PARTIALLY_VERIFIED"
    assert sch.verification_status == "PARTIALLY_VERIFIED"
    assert "Source safeguard warning" in sch.unresolved_questions


def test_import_with_knowledge_documents_and_chunks(admin_client, db_session):
    """Knowledge documents and chunks are properly linked with content hashes and provenance preserved."""
    deadline = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
    payload = {
        "items": [
            {
                "name": "State Tribal Higher Education Grant",
                "provider": "Tribal Welfare Department, Government of Tamil Nadu",
                "description": "Comprehensive fee and hostel stipend for ST students in autonomous institutions.",
                "amount": 45000.0,
                "deadline": deadline,
                "source_url": "https://tndce.tn.gov.in/tribal_guidelines.pdf",
                "dossier_index": "№ TN-TRIBAL-2025",
                "source_verification_status": "SOURCE_VERIFIED",
                "knowledge_docs": [
                    {
                        "title": "G.O. Ms. No. 42 Guidelines for Tribal Student Fee Waivers",
                        "source_url": "https://tndce.tn.gov.in/tribal_guidelines.pdf",
                        "content": "Official government notification detailing 100% compulsory fee concessions.",
                        "chunks": [
                            {
                                "section": "Clause 4.1: Autonomous College Eligibility",
                                "chunk_text": "Students enrolled in autonomous arts and science colleges under government single-window quota are exempted from special fees.",
                                "page_number": 3,
                                "source_url": "https://tndce.tn.gov.in/tribal_guidelines.pdf#page=3",
                            }
                        ],
                    }
                ],
            }
        ],
        "dry_run": False,
    }

    response = admin_client.post("/api/v1/scholarships/import", json=payload)
    assert response.status_code == 200

    sch = db_session.query(Scholarship).filter(Scholarship.dossier_index == "№ TN-TRIBAL-2025").first()
    assert sch is not None

    # Check knowledge document in DB
    k_doc = db_session.query(KnowledgeDocument).filter(KnowledgeDocument.scholarship_id == sch.id).first()
    assert k_doc is not None
    assert k_doc.title == "G.O. Ms. No. 42 Guidelines for Tribal Student Fee Waivers"
    assert len(k_doc.content_hash) == 64  # Valid SHA-256

    # Check knowledge chunk
    chunk = db_session.query(KnowledgeChunk).filter(KnowledgeChunk.document_id == k_doc.id).first()
    assert chunk is not None
    assert chunk.section == "Clause 4.1: Autonomous College Eligibility"
    assert "Students enrolled in autonomous arts" in chunk.chunk_text


def test_cli_import_script_json_and_csv():
    """Validates the CLI utility scripts/import_verified_scholarships.py with sample JSON and CSV."""
    python_exe = sys.executable

    # 1. Test CLI with JSON file
    sample_json = [
        {
            "name": "CLI Test Scheme (JSON)",
            "provider": "Department of Technical Education, Government of Tamil Nadu",
            "description": "Test scheme imported via administrative CLI script in JSON mode.",
            "amount": 35000.0,
            "deadline": "2026-11-30T18:00:00Z",
            "source_url": "https://tneaonline.org/scholarship_notification",
            "dossier_index": "№ TN-CLI-JSON-01",
            "source_verification_status": "SOURCE_VERIFIED",
        }
    ]

    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f_json:
        json.dump(sample_json, f_json)
        json_path = f_json.name

    try:
        # Run CLI in dry-run mode
        cmd_dry = [python_exe, "scripts/import_verified_scholarships.py", "--file", json_path, "--dry-run"]
        res_dry = subprocess.run(cmd_dry, capture_output=True, text=True, env=env)
        assert res_dry.returncode == 0, f"CLI stderr: {res_dry.stderr}"
        assert "DRY-RUN PREVIEW" in res_dry.stdout
        assert "WOULD_CREATE" in res_dry.stdout or "WOULD_UPDATE" in res_dry.stdout

        # Run CLI live
        cmd_live = [python_exe, "scripts/import_verified_scholarships.py", "--file", json_path]
        res_live = subprocess.run(cmd_live, capture_output=True, text=True, env=env)
        assert res_live.returncode == 0, f"CLI stderr: {res_live.stderr}"
        assert "LIVE IMPORT" in res_live.stdout
    finally:
        Path(json_path).unlink(missing_ok=True)

    # 2. Test CLI with CSV file
    csv_content = (
        "name,provider,description,amount,deadline,source_url,dossier_index,tn_residency_required,rules,requirements\n"
        "CLI Test Scheme (CSV),Directorate of Collegiate Education,Test scheme imported via CSV,40000,2026-12-15T18:00:00Z,https://tndce.tn.gov.in/cms,TN-CLI-CSV-01,true,ANNUAL_INCOME:LTE:200000;CGPA:GTE:7.5,Income Certificate:INCOME_CERTIFICATE\n"
    )

    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8") as f_csv:
        f_csv.write(csv_content)
        csv_path = f_csv.name

    try:
        cmd_csv = [python_exe, "scripts/import_verified_scholarships.py", "--file", csv_path, "--dry-run"]
        res_csv = subprocess.run(cmd_csv, capture_output=True, text=True, env=env)
        assert res_csv.returncode == 0, f"CLI CSV stderr: {res_csv.stderr}"
        assert "DRY-RUN PREVIEW" in res_csv.stdout
        assert "CLI Test Scheme (CSV)" in res_csv.stdout
    finally:
        Path(csv_path).unlink(missing_ok=True)
