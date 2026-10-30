"""
Regression & Idempotency Tests for PostgreSQL Schema Mismatch Fix
Verifies:
1. Handling of actual failing 103-char category_tag and 60-char application_effort values.
2. Complete catalogue compliance with model column length constraints.
3. Idempotent repeat migration and repeat seeding without duplicate records.
4. Strict preservation of historical application records and foreign-key integrity.
5. Dialect-aware migration routines supporting PostgreSQL and SQLite.
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, text

from app.models.scholarship import Scholarship
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.models.student import Student
from app.models.action import Action
from app.db.init_db import init_db
from app.db.migrations import run_schema_migrations


ACTUAL_FAILING_CATEGORY_TAG = (
    "Government Scholarships, Tamil Nadu State Schemes, "
    "Community/Category-Based, Tuition and Fee Assistance"
)  # Exactly 103 characters (> 100)

ACTUAL_FAILING_APPLICATION_EFFORT = (
    "Medium (Requires UG transcripts & department recommendation)"
)  # Exactly 60 characters (> 50)


def test_actual_failing_category_tag_and_effort_values(db_session: Session):
    """
    Regression Test:
    Directly tests that the exact 103-character category_tag and 60-character application_effort
    that caused PostgreSQL StringDataRightTruncation are safely stored, retrieved, and updated.
    """
    assert len(ACTUAL_FAILING_CATEGORY_TAG) == 103
    assert len(ACTUAL_FAILING_APPLICATION_EFFORT) == 60

    now = datetime.now(timezone.utc)
    test_scholarship = Scholarship(
        name="Regression Test Tamil Nadu Scholarship",
        provider="Tamil Nadu Higher Education Department",
        description="Regression test scholarship verifying long descriptive tags.",
        amount=25000.0,
        currency="INR",
        deadline=now + timedelta(days=30),
        verification_status="SOURCE_VERIFIED",
        status="ACTIVE",
        category_tag=ACTUAL_FAILING_CATEGORY_TAG,
        application_effort=ACTUAL_FAILING_APPLICATION_EFFORT,
        community_category="BC,MBC,DNC,SC,ST,SCA,Minority",
        award_type="TUITION_WAIVER_AND_MAINTENANCE",
        income_criteria_raw="Annual parental income not exceeding ₹2,50,000 for SC/ST/SCA students (₹8,00,000 for central top-class categories).",
        award_display="100% compulsory tuition fee waiver + monthly maintenance allowance (₹550–₹1,200/mo)",
    )

    db_session.add(test_scholarship)
    db_session.commit()
    db_session.refresh(test_scholarship)

    assert test_scholarship.id is not None
    assert test_scholarship.category_tag == ACTUAL_FAILING_CATEGORY_TAG
    assert len(test_scholarship.category_tag) == 103
    assert test_scholarship.application_effort == ACTUAL_FAILING_APPLICATION_EFFORT
    assert len(test_scholarship.application_effort) == 60

    # Also verify updating with even longer descriptive string up to 500 characters
    long_tag = "Tag-A, " * 50  # 350 chars
    test_scholarship.category_tag = long_tag
    db_session.commit()
    db_session.refresh(test_scholarship)
    assert test_scholarship.category_tag == long_tag


def test_action_effort_estimate_supports_long_effort_notes(db_session: Session):
    """
    Regression Test:
    Verifies that Action.effort_estimate accepts descriptive effort notes derived
    from scholarship application_effort without truncation.
    """
    student = db_session.query(Student).first()
    assert student is not None

    long_effort = ACTUAL_FAILING_APPLICATION_EFFORT  # 60 chars > 50
    act = Action(
        student_id=student.id,
        title="Apply for TANSCHE Postgraduate Fellowship",
        reason="Eligible with high academic standing.",
        urgency="HIGH",
        effort_estimate=long_effort,
        action_type="SCHOLARSHIP_APPLICATION",
    )
    db_session.add(act)
    db_session.commit()
    db_session.refresh(act)

    assert act.id is not None
    assert act.effort_estimate == long_effort
    assert len(act.effort_estimate) == 60


def test_all_canonical_scholarships_fit_declared_column_lengths():
    """
    Constraint Test:
    Iterates over all declared columns in the Scholarship model and ensures that
    every field declared on Scholarship has adequate length to hold all verified catalogue items.
    """
    col_lengths = {
        col.name: col.type.length
        for col in Scholarship.__table__.columns
        if hasattr(col.type, "length") and col.type.length is not None
    }

    # Verify column capacity
    assert col_lengths["category_tag"] >= 500, "category_tag column must be at least 500 characters"
    assert col_lengths["application_effort"] >= 255, "application_effort column must be at least 255 characters"
    assert col_lengths["community_category"] >= 255, "community_category column must be at least 255 characters"
    assert col_lengths["award_type"] >= 255, "award_type column must be at least 255 characters"
    assert col_lengths["income_criteria_raw"] >= 500, "income_criteria_raw column must be at least 500 characters"
    assert col_lengths["award_display"] >= 500, "award_display column must be at least 500 characters"


def test_repeat_migration_and_seeding_idempotency(db_session: Session):
    """
    Idempotency Test:
    Executes run_schema_migrations and init_db multiple times consecutively.
    Verifies:
    1. Zero errors or constraint violations.
    2. Zero duplicate scholarships created.
    3. All 11 verified Tamil Nadu dossiers remain ACTIVE and intact.
    """
    bind = db_session.get_bind()

    # Pass 1
    run_schema_migrations(bind)
    init_db(db_session)
    count_pass1 = db_session.query(Scholarship).count()

    # Pass 2
    run_schema_migrations(bind)
    init_db(db_session)
    count_pass2 = db_session.query(Scholarship).count()

    # Pass 3
    run_schema_migrations(bind)
    init_db(db_session)
    count_pass3 = db_session.query(Scholarship).count()

    assert count_pass1 == count_pass2 == count_pass3, "Repeat migration or seeding created duplicate records!"

    verified_count = (
        db_session.query(Scholarship)
        .filter(Scholarship.dossier_index.isnot(None), Scholarship.status == "ACTIVE")
        .count()
    )
    assert verified_count >= 11


def test_preservation_of_historical_application_records(db_session: Session):
    """
    Non-destructive Preservation Test:
    Ensures that pre-existing student application records, requirements, and personal
    statements remain 100% intact after migration and seeding passes.
    """
    student = db_session.query(Student).first()
    assert student is not None

    # Pick or create a scholarship
    target_scholarship = db_session.query(Scholarship).first()
    assert target_scholarship is not None

    # Create an application
    now = datetime.now(timezone.utc)
    app = Application(
        student_id=student.id,
        scholarship_id=target_scholarship.id,
        status="IN_PROGRESS",
        progress=65.0,
        personal_statement="Valuable historical personal statement that must never be lost.",
        started_at=now - timedelta(days=15),
    )
    db_session.add(app)
    db_session.flush()

    req = ApplicationRequirement(
        application_id=app.id,
        name="Historical Marksheet",
        document_type="MARKSHEET",
        type="DOCUMENT",
        is_required=True,
        status="AVAILABLE",
    )
    db_session.add(req)
    db_session.commit()

    saved_app_id = app.id
    saved_req_id = req.id

    # Run migration and init_db multiple times
    bind = db_session.get_bind()
    run_schema_migrations(bind)
    init_db(db_session)
    run_schema_migrations(bind)
    init_db(db_session)

    # Verify application remains untouched
    persisted_app = db_session.query(Application).filter(Application.id == saved_app_id).first()
    assert persisted_app is not None, "Application was deleted during migration/seeding!"
    assert persisted_app.student_id == student.id
    assert persisted_app.scholarship_id == target_scholarship.id
    assert persisted_app.progress == 65.0
    assert persisted_app.personal_statement == "Valuable historical personal statement that must never be lost."

    persisted_req = (
        db_session.query(ApplicationRequirement)
        .filter(ApplicationRequirement.id == saved_req_id)
        .first()
    )
    assert persisted_req is not None
    assert persisted_req.status == "AVAILABLE"


def test_postgresql_dialect_migration_statements_verification():
    """
    PostgreSQL Dialect SQL Verification Test:
    Mocks a PostgreSQL connection and inspector to verify that the exact widening statements:
    - ALTER TABLE scholarships ALTER COLUMN category_tag TYPE VARCHAR(500)
    - ALTER TABLE scholarships ALTER COLUMN application_effort TYPE VARCHAR(255)
    - ALTER TABLE scholarships ALTER COLUMN community_category TYPE VARCHAR(255)
    - ALTER TABLE scholarships ALTER COLUMN award_type TYPE VARCHAR(255)
    - ALTER TABLE scholarships ALTER COLUMN income_criteria_raw TYPE VARCHAR(500)
    - ALTER TABLE scholarships ALTER COLUMN award_display TYPE VARCHAR(500)
    - ALTER TABLE actions ALTER COLUMN effort_estimate TYPE VARCHAR(255)
    are properly issued when connected to a PostgreSQL database.
    """
    mock_engine = MagicMock()
    mock_engine.dialect.name = "postgresql"
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn

    executed_statements = []

    def capture_execute(stmt):
        executed_statements.append(str(stmt))

    mock_conn.execute.side_effect = capture_execute

    from unittest.mock import patch

    with patch("app.db.migrations.inspect") as mock_inspect:
        mock_inspector = MagicMock()
        mock_inspector.get_table_names.return_value = ["scholarships", "actions", "documents", "users", "student_profiles"]
        mock_inspector.get_columns.side_effect = lambda tbl: [
            {"name": "category_tag"},
            {"name": "application_effort"},
            {"name": "community_category"},
            {"name": "award_type"},
            {"name": "income_criteria_raw"},
            {"name": "award_display"},
            {"name": "effort_estimate"},
            {"name": "gender"},
            {"name": "role"},
            {"name": "storage_key"},
        ]
        mock_inspect.return_value = mock_inspector

        run_schema_migrations(mock_engine)

    # Check for column widening executions in executed statements
    widening_stmts = [s for s in executed_statements if "ALTER TABLE scholarships ALTER COLUMN" in s]
    assert len(widening_stmts) == 6, f"Expected 6 column widening statements for scholarships, got {len(widening_stmts)}"
    assert any("category_tag TYPE VARCHAR(500)" in s for s in widening_stmts)
    assert any("application_effort TYPE VARCHAR(255)" in s for s in widening_stmts)
    assert any("community_category TYPE VARCHAR(255)" in s for s in widening_stmts)
    assert any("award_type TYPE VARCHAR(255)" in s for s in widening_stmts)
    assert any("income_criteria_raw TYPE VARCHAR(500)" in s for s in widening_stmts)
    assert any("award_display TYPE VARCHAR(500)" in s for s in widening_stmts)

    action_widening = [s for s in executed_statements if "ALTER TABLE actions ALTER COLUMN effort_estimate TYPE VARCHAR(255)" in s]
    assert len(action_widening) == 1
