"""
SCHOLARAi Database Schema Migrations
Provides safe, idempotent migration routines for PostgreSQL and SQLite.
Widens column types and ensures schema compatibility across releases without data loss.
"""
import logging
from sqlalchemy import inspect, text

logger = logging.getLogger("scholarai.migrations")


def run_schema_migrations(db_engine_or_conn):
    """
    Idempotent migration to ensure existing SQLite or PostgreSQL database tables
    have the new production document storage, verification, and user role columns,
    and column types correctly support legitimate long descriptive values.

    Non-destructive guarantees:
    - Never drops tables or columns.
    - Never deletes historical application, scholarship, or user records.
    - Idempotently safe to run repeatedly across releases.
    """
    inspector = inspect(db_engine_or_conn)
    existing_tables = set(inspector.get_table_names())
    dialect_name = db_engine_or_conn.dialect.name

    logger.info(f"Running safe schema migration checks for dialect: {dialect_name}...")

    def _apply_migrations(conn):
        def _exec(stmt):
            try:
                if hasattr(conn, "begin_nested"):
                    with conn.begin_nested():
                        conn.execute(stmt)
                else:
                    conn.execute(stmt)
            except Exception as e:
                logger.warning(f"Note during schema migration statement: {e}")

        def _sync_pg_sequences():
            if dialect_name == "postgresql":
                tables_with_id = [
                    "students",
                    "users",
                    "student_profiles",
                    "funding_profiles",
                    "planner_goals",
                    "scholarships",
                    "applications",
                    "documents",
                    "actions",
                    "evidence",
                    "knowledge_sources",
                    "knowledge_documents",
                    "knowledge_chunks",
                    "notifications",
                    "eligibility_rules",
                    "scholarship_requirements",
                    "application_requirements",
                ]
                for tbl in tables_with_id:
                    if tbl in existing_tables:
                        _exec(text(f"""
                            DO $$
                            DECLARE
                                seq_name TEXT;
                                max_id BIGINT;
                            BEGIN
                                seq_name := pg_get_serial_sequence('{tbl}', 'id');
                                IF seq_name IS NOT NULL THEN
                                    EXECUTE 'SELECT COALESCE(MAX(id), 0) FROM {tbl}' INTO max_id;
                                    IF max_id > 0 THEN
                                        PERFORM setval(seq_name, max_id, true);
                                    ELSE
                                        PERFORM setval(seq_name, 1, false);
                                    END IF;
                                END IF;
                            END $$;
                        """))

        # Pre-synchronize PostgreSQL sequences before inserting any rules
        _sync_pg_sequences()

        # 1. Update documents table if it exists
        if "documents" in existing_tables:
            doc_columns = {col["name"] for col in inspector.get_columns("documents")}
            new_columns = [
                ("storage_key", "VARCHAR(512)", "VARCHAR(512)"),
                ("storage_backend", "VARCHAR(50) DEFAULT 'local'", "VARCHAR(50) DEFAULT 'local'"),
                ("file_size", "INTEGER", "INTEGER"),
                ("mime_type", "VARCHAR(100)", "VARCHAR(100)"),
                ("content_hash", "VARCHAR(64)", "VARCHAR(64)"),
                ("original_filename", "VARCHAR(255)", "VARCHAR(255)"),
                ("extraction_status", "VARCHAR(50) DEFAULT 'PENDING'", "VARCHAR(50) DEFAULT 'PENDING'"),
                ("verification_status", "VARCHAR(50) DEFAULT 'UPLOADED'", "VARCHAR(50) DEFAULT 'UPLOADED'"),
                ("extracted_data", "JSON", "JSON"),
                ("verification_results", "JSON", "JSON"),
                ("failure_reasons", "JSON", "JSON"),
                ("reviewed_by", "VARCHAR(100)", "VARCHAR(100)"),
                ("reviewed_at", "DATETIME", "TIMESTAMP WITH TIME ZONE"),
                ("audit_history", "JSON", "JSON"),
            ]

            for col_name, sqlite_type, pg_type in new_columns:
                if col_name not in doc_columns:
                    logger.info(f"Adding column '{col_name}' to 'documents' table...")
                    if dialect_name == "postgresql":
                        _exec(text(f"ALTER TABLE documents ADD COLUMN IF NOT EXISTS {col_name} {pg_type}"))
                    else:
                        _exec(text(f"ALTER TABLE documents ADD COLUMN {col_name} {sqlite_type}"))

        # 2. Update users table if it exists
        if "users" in existing_tables:
            user_columns = {col["name"] for col in inspector.get_columns("users")}
            if "role" not in user_columns:
                logger.info("Adding column 'role' to 'users' table...")
                if dialect_name == "postgresql":
                    _exec(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'STUDENT'"))
                else:
                    _exec(text("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'STUDENT'"))

        # 3. Update scholarships table if it exists
        if "scholarships" in existing_tables:
            sch_columns = {col["name"] for col in inspector.get_columns("scholarships")}
            new_sch_columns = [
                ("dossier_index", "VARCHAR(50)", "VARCHAR(50)"),
                ("stream", "VARCHAR(50) DEFAULT 'BOTH'", "VARCHAR(50) DEFAULT 'BOTH'"),
                ("study_level", "VARCHAR(50) DEFAULT 'BOTH'", "VARCHAR(50) DEFAULT 'BOTH'"),
                ("category_tag", "VARCHAR(500) DEFAULT 'GOVERNMENT'", "VARCHAR(500) DEFAULT 'GOVERNMENT'"),
                ("institution_types", "VARCHAR(255)", "VARCHAR(255)"),
                ("autonomous_compatibility", "TEXT", "TEXT"),
                ("tn_residency_required", "VARCHAR(20) DEFAULT 'YES'", "VARCHAR(20) DEFAULT 'YES'"),
                ("community_category", "VARCHAR(255) DEFAULT 'ALL'", "VARCHAR(255) DEFAULT 'ALL'"),
                ("income_ceiling", "FLOAT", "DOUBLE PRECISION"),
                ("income_criteria_raw", "VARCHAR(500)", "VARCHAR(500)"),
                ("award_type", "VARCHAR(255) DEFAULT 'VARIABLE_ASSISTANCE'", "VARCHAR(255) DEFAULT 'VARIABLE_ASSISTANCE'"),
                ("award_display", "VARCHAR(500)", "VARCHAR(500)"),
                ("official_portal_name", "VARCHAR(255)", "VARCHAR(255)"),
                ("official_guideline_url", "VARCHAR(500)", "VARCHAR(500)"),
                ("academic_year", "VARCHAR(50) DEFAULT '2024-2025 / 2025-2026'", "VARCHAR(50) DEFAULT '2024-2025 / 2025-2026'"),
                ("source_verification_status", "VARCHAR(50) DEFAULT 'SOURCE_VERIFIED'", "VARCHAR(50) DEFAULT 'SOURCE_VERIFIED'"),
                ("application_window_status", "VARCHAR(50) DEFAULT 'OPEN'", "VARCHAR(50) DEFAULT 'OPEN'"),
                ("unresolved_questions", "TEXT", "TEXT"),
                ("benefit_type", "VARCHAR(50) DEFAULT 'SCHOLARSHIP'", "VARCHAR(50) DEFAULT 'SCHOLARSHIP'"),
            ]
            for col_name, sqlite_type, pg_type in new_sch_columns:
                if col_name not in sch_columns:
                    logger.info(f"Adding column '{col_name}' to 'scholarships' table...")
                    if dialect_name == "postgresql":
                        _exec(text(f"ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS {col_name} {pg_type}"))
                    else:
                        _exec(text(f"ALTER TABLE scholarships ADD COLUMN {col_name} {sqlite_type}"))

            # PostgreSQL column widening: safely widen existing columns to support legitimate long descriptive strings
            if dialect_name == "postgresql":
                widen_columns = [
                    ("category_tag", "VARCHAR(500)"),
                    ("application_effort", "VARCHAR(255)"),
                    ("community_category", "VARCHAR(255)"),
                    ("award_type", "VARCHAR(255)"),
                    ("income_criteria_raw", "VARCHAR(500)"),
                    ("award_display", "VARCHAR(500)"),
                ]
                for col_name, pg_type in widen_columns:
                    _exec(text(f"ALTER TABLE scholarships ALTER COLUMN {col_name} TYPE {pg_type}"))

        # 4. Update actions table if it exists
        if "actions" in existing_tables and dialect_name == "postgresql":
            _exec(text("ALTER TABLE actions ALTER COLUMN effort_estimate TYPE VARCHAR(255)"))

        # 5. Update student_profiles table if it exists
        if "student_profiles" in existing_tables:
            sp_columns = {col["name"] for col in inspector.get_columns("student_profiles")}
            new_sp_columns = [
                ("gender", "VARCHAR(50) DEFAULT 'Male'", "VARCHAR(50) DEFAULT 'Male'"),
                ("admission_quota", "VARCHAR(50) DEFAULT 'GOVERNMENT_QUOTA'", "VARCHAR(50) DEFAULT 'GOVERNMENT_QUOTA'"),
                ("hosteller_status", "VARCHAR(50) DEFAULT 'DAY_SCHOLAR'", "VARCHAR(50) DEFAULT 'DAY_SCHOLAR'"),
                ("is_first_graduate", "BOOLEAN DEFAULT 0", "BOOLEAN DEFAULT FALSE"),
                ("dob", "VARCHAR(50)", "VARCHAR(50)"),
                ("district", "VARCHAR(100)", "VARCHAR(100)"),
                ("native_state", "VARCHAR(100) DEFAULT 'Tamil Nadu'", "VARCHAR(100) DEFAULT 'Tamil Nadu'"),
                ("education_level", "VARCHAR(50) DEFAULT 'Undergraduate'", "VARCHAR(50) DEFAULT 'Undergraduate'"),
                ("stream", "VARCHAR(100) DEFAULT 'Engineering & Technology'", "VARCHAR(100) DEFAULT 'Engineering & Technology'"),
                ("university", "VARCHAR(255)", "VARCHAR(255)"),
                ("admission_year", "VARCHAR(20)", "VARCHAR(20)"),
                ("current_semester", "VARCHAR(20)", "VARCHAR(20)"),
                ("qualifying_exam", "VARCHAR(100)", "VARCHAR(100)"),
                ("qualifying_marks", "FLOAT", "DOUBLE PRECISION"),
                ("institution_type", "VARCHAR(50) DEFAULT 'Government-aided'", "VARCHAR(50) DEFAULT 'Government-aided'"),
                ("school_type", "VARCHAR(100)", "VARCHAR(100)"),
                ("school_study_history", "TEXT", "TEXT"),
                ("community_subcategory", "VARCHAR(100)", "VARCHAR(100)"),
                ("bank_readiness", "VARCHAR(50) DEFAULT 'NOT_CONFIGURED'", "VARCHAR(50) DEFAULT 'NOT_CONFIGURED'"),
                ("account_holder_name", "VARCHAR(255)", "VARCHAR(255)"),
                ("dbt_enabled", "BOOLEAN DEFAULT 0", "BOOLEAN DEFAULT FALSE"),
                ("bank_name", "VARCHAR(100)", "VARCHAR(100)"),
                ("bank_branch", "VARCHAR(100)", "VARCHAR(100)"),
                ("aadhaar_verification_status", "VARCHAR(50) DEFAULT 'NOT_PROVIDED'", "VARCHAR(50) DEFAULT 'NOT_PROVIDED'"),
                ("aadhaar_masked", "VARCHAR(50)", "VARCHAR(50)"),
                ("aadhaar_consent_given", "BOOLEAN DEFAULT 0", "BOOLEAN DEFAULT FALSE"),
                ("mode_of_study", "VARCHAR(50) DEFAULT 'Regular / Full-Time'", "VARCHAR(50) DEFAULT 'Regular / Full-Time'"),
                ("studied_govt_school_6_to_12", "BOOLEAN DEFAULT 0", "BOOLEAN DEFAULT FALSE"),
                ("board_of_education", "VARCHAR(100) DEFAULT 'Tamil Nadu State Board'", "VARCHAR(100) DEFAULT 'Tamil Nadu State Board'"),
                ("minority_status", "VARCHAR(100) DEFAULT 'None'", "VARCHAR(100) DEFAULT 'None'"),
                ("special_category", "VARCHAR(100) DEFAULT 'None'", "VARCHAR(100) DEFAULT 'None'"),
                ("dbt_seeding_status", "VARCHAR(50) DEFAULT 'Don''t Know'", "VARCHAR(50) DEFAULT 'Don''t Know'"),
                ("ration_card_type", "VARCHAR(100) DEFAULT 'Not Available / Don''t Know'", "VARCHAR(100) DEFAULT 'Not Available / Don''t Know'"),
                ("domicile_status", "VARCHAR(100) DEFAULT 'Tamil Nadu Domicile'", "VARCHAR(100) DEFAULT 'Tamil Nadu Domicile'"),
                ("participates_in_sports", "BOOLEAN DEFAULT 0", "BOOLEAN DEFAULT FALSE"),
                ("sport_discipline", "VARCHAR(100)", "VARCHAR(100)"),
                ("sports_competition_level", "VARCHAR(50)", "VARCHAR(50)"),
                ("sports_achievement_type", "VARCHAR(100)", "VARCHAR(100)"),
                ("sports_certificate_status", "VARCHAR(50) DEFAULT 'Not Available'", "VARCHAR(50) DEFAULT 'Not Available'"),
                ("sports_achievement_year", "VARCHAR(20)", "VARCHAR(20)"),
                ("has_disability", "BOOLEAN DEFAULT 0", "BOOLEAN DEFAULT FALSE"),
                ("disability_consent_given", "BOOLEAN DEFAULT 0", "BOOLEAN DEFAULT FALSE"),
                ("disability_category", "VARCHAR(100)", "VARCHAR(100)"),
                ("disability_percentage", "FLOAT", "DOUBLE PRECISION"),
                ("udid_card_status", "VARCHAR(50) DEFAULT 'Not Available'", "VARCHAR(50) DEFAULT 'Not Available'"),
                ("accessibility_needs", "VARCHAR(255)", "VARCHAR(255)"),
            ]
            for col_name, sqlite_type, pg_type in new_sp_columns:
                if col_name not in sp_columns:
                    logger.info(f"Adding column '{col_name}' to 'student_profiles' table...")
                    if dialect_name == "postgresql":
                        _exec(text(f"ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS {col_name} {pg_type}"))
                    else:
                        _exec(text(f"ALTER TABLE student_profiles ADD COLUMN {col_name} {sqlite_type}"))

            if dialect_name == "postgresql":
                _exec(text("ALTER TABLE student_profiles ALTER COLUMN cgpa DROP NOT NULL"))
                _exec(text("ALTER TABLE student_profiles ALTER COLUMN twelfth_percentage DROP NOT NULL"))

        # 5b. Update funding_profiles table if it exists
        if "funding_profiles" in existing_tables:
            fp_columns = {col["name"] for col in inspector.get_columns("funding_profiles")}
            new_fp_columns = [
                ("income_range", "VARCHAR(50)", "VARCHAR(50)"),
                ("income_certificate_status", "VARCHAR(50) DEFAULT 'NOT_UPLOADED'", "VARCHAR(50) DEFAULT 'NOT_UPLOADED'"),
                ("financial_circumstances_notes", "TEXT", "TEXT"),
            ]
            for col_name, sqlite_type, pg_type in new_fp_columns:
                if col_name not in fp_columns:
                    logger.info(f"Adding column '{col_name}' to 'funding_profiles' table...")
                    if dialect_name == "postgresql":
                        _exec(text(f"ALTER TABLE funding_profiles ADD COLUMN IF NOT EXISTS {col_name} {pg_type}"))
                    else:
                        _exec(text(f"ALTER TABLE funding_profiles ADD COLUMN {col_name} {sqlite_type}"))

        # 6. Update applications table if it exists
        if "applications" in existing_tables:
            app_columns = {col["name"] for col in inspector.get_columns("applications")}
            new_app_columns = [
                ("status_reason", "TEXT", "TEXT"),
                ("status_history", "JSON", "JSON"),
                ("reviewed_by", "VARCHAR(100)", "VARCHAR(100)"),
                ("reviewed_at", "DATETIME", "TIMESTAMP WITH TIME ZONE"),
                ("preparation_status", "VARCHAR(50) DEFAULT 'IN_PROGRESS'", "VARCHAR(50) DEFAULT 'IN_PROGRESS'"),
                ("submission_status", "VARCHAR(50) DEFAULT 'NOT_SUBMITTED'", "VARCHAR(50) DEFAULT 'NOT_SUBMITTED'"),
                ("submission_mode", "VARCHAR(50) DEFAULT 'STUDENT_COMPLETED_EXTERNAL_SUBMISSION'", "VARCHAR(50) DEFAULT 'STUDENT_COMPLETED_EXTERNAL_SUBMISSION'"),
                ("form_data", "JSON", "JSON"),
                ("external_application_id", "VARCHAR(255)", "VARCHAR(255)"),
                ("external_submission_at", "DATETIME", "TIMESTAMP WITH TIME ZONE"),
                ("external_receipt_document_id", "INTEGER", "INTEGER"),
                ("external_response_payload", "JSON", "JSON"),
                ("student_consented_at", "DATETIME", "TIMESTAMP WITH TIME ZONE"),
                ("submission_notes", "TEXT", "TEXT"),
            ]
            for col_name, sqlite_type, pg_type in new_app_columns:
                if col_name not in app_columns:
                    logger.info(f"Adding column '{col_name}' to 'applications' table...")
                    if dialect_name == "postgresql":
                        _exec(text(f"ALTER TABLE applications ADD COLUMN IF NOT EXISTS {col_name} {pg_type}"))
                    else:
                        _exec(text(f"ALTER TABLE applications ADD COLUMN {col_name} {sqlite_type}"))

        # 7. Ensure performance and constraint indexes exist
        index_definitions = [
            ("documents", "ix_documents_content_hash", "documents(content_hash)"),
            ("scholarships", "ix_scholarships_dossier_index", "scholarships(dossier_index)"),
            ("scholarships", "ix_scholarships_stream", "scholarships(stream)"),
            ("scholarships", "ix_scholarships_study_level", "scholarships(study_level)"),
            ("scholarships", "ix_scholarships_category_tag", "scholarships(category_tag)"),
            ("scholarships", "ix_scholarships_source_verification_status", "scholarships(source_verification_status)"),
            ("scholarships", "ix_scholarships_application_window_status", "scholarships(application_window_status)"),
            ("student_profiles", "ix_student_profiles_admission_quota", "student_profiles(admission_quota)"),
            ("student_profiles", "ix_student_profiles_hosteller_status", "student_profiles(hosteller_status)"),
            ("student_profiles", "ix_student_profiles_district", "student_profiles(district)"),
            ("student_profiles", "ix_student_profiles_education_level", "student_profiles(education_level)"),
            ("student_profiles", "ix_student_profiles_stream", "student_profiles(stream)"),
            ("student_profiles", "ix_student_profiles_institution_type", "student_profiles(institution_type)"),
            ("student_profiles", "ix_student_profiles_sports", "student_profiles(participates_in_sports)"),
            ("student_profiles", "ix_student_profiles_disability", "student_profiles(has_disability)"),
            ("scholarships", "ix_scholarships_benefit_type", "scholarships(benefit_type)"),
            ("applications", "ix_applications_preparation_status", "applications(preparation_status)"),
            ("applications", "ix_applications_submission_status", "applications(submission_status)"),
            ("applications", "ix_applications_submission_mode", "applications(submission_mode)"),
            ("applications", "ix_applications_external_application_id", "applications(external_application_id)"),
        ]
        for tbl, idx_name, cols in index_definitions:
            if tbl in existing_tables:
                _exec(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {cols}"))

        # 8. Idempotent default backfill for legacy rows with NULLs
        first_grad_backfill = "is_first_graduate = FALSE WHERE is_first_graduate IS NULL" if dialect_name == "postgresql" else "is_first_graduate = 0 WHERE is_first_graduate IS NULL"
        backfill_updates = [
            ("users", "role = 'STUDENT' WHERE role IS NULL"),
            ("documents", "storage_backend = 'local' WHERE storage_backend IS NULL"),
            ("documents", "extraction_status = 'PENDING' WHERE extraction_status IS NULL"),
            ("documents", "verification_status = 'UPLOADED' WHERE verification_status IS NULL"),
            ("scholarships", "stream = 'BOTH' WHERE stream IS NULL"),
            ("scholarships", "study_level = 'BOTH' WHERE study_level IS NULL"),
            ("scholarships", "category_tag = 'GOVERNMENT' WHERE category_tag IS NULL"),
            ("scholarships", "tn_residency_required = 'YES' WHERE tn_residency_required IS NULL"),
            ("scholarships", "community_category = 'ALL' WHERE community_category IS NULL"),
            ("scholarships", "award_type = 'VARIABLE_ASSISTANCE' WHERE award_type IS NULL"),
            ("scholarships", "source_verification_status = 'SOURCE_VERIFIED' WHERE source_verification_status IS NULL"),
            ("scholarships", "application_window_status = 'OPEN' WHERE application_window_status IS NULL"),
            ("scholarships", "benefit_type = 'SCHOLARSHIP' WHERE benefit_type IS NULL"),
            ("student_profiles", "gender = 'Male' WHERE gender IS NULL"),
            ("student_profiles", "admission_quota = 'GOVERNMENT_QUOTA' WHERE admission_quota IS NULL"),
            ("student_profiles", "hosteller_status = 'DAY_SCHOLAR' WHERE hosteller_status IS NULL"),
            ("student_profiles", first_grad_backfill),
            ("student_profiles", "state = 'Tamil Nadu' WHERE state IS NULL"),
            ("student_profiles", "native_state = 'Tamil Nadu' WHERE native_state IS NULL"),
            ("student_profiles", "education_level = 'Undergraduate' WHERE education_level IS NULL"),
            ("student_profiles", "stream = 'Engineering & Technology' WHERE stream IS NULL"),
            ("student_profiles", "institution_type = 'Government-aided' WHERE institution_type IS NULL"),
            ("student_profiles", "bank_readiness = 'NOT_CONFIGURED' WHERE bank_readiness IS NULL"),
            ("student_profiles", "aadhaar_verification_status = 'NOT_PROVIDED' WHERE aadhaar_verification_status IS NULL"),
            ("funding_profiles", "income_certificate_status = 'NOT_UPLOADED' WHERE income_certificate_status IS NULL"),
            ("applications", "status_history = '[]' WHERE status_history IS NULL"),
            ("applications", "preparation_status = 'READY_TO_SUBMIT' WHERE status = 'SUBMITTED' AND preparation_status IS NULL"),
            ("applications", "preparation_status = 'READY_FOR_REVIEW' WHERE status = 'READY' AND preparation_status IS NULL"),
            ("applications", "preparation_status = 'IN_PROGRESS' WHERE preparation_status IS NULL"),
            ("applications", "submission_status = 'SUBMITTED_EXTERNALLY' WHERE status = 'SUBMITTED' AND submission_status IS NULL"),
            ("applications", "submission_status = 'NOT_SUBMITTED' WHERE submission_status IS NULL"),
            ("applications", "submission_mode = 'STUDENT_COMPLETED_EXTERNAL_SUBMISSION' WHERE submission_mode IS NULL"),
            ("applications", "status_reason = 'Required documents are still missing.' WHERE status = 'IN_PROGRESS' AND status_reason IS NULL"),
            ("applications", "status_reason = 'All required documents have been uploaded and passed automated checks.' WHERE status = 'READY' AND status_reason IS NULL"),
            ("applications", "status_reason = 'Application submitted and recorded.' WHERE status = 'SUBMITTED' AND status_reason IS NULL"),
            ("applications", "status_reason = 'Application status: ' || status WHERE status_reason IS NULL"),
        ]
        for tbl, set_clause in backfill_updates:
            if tbl in existing_tables:
                _exec(text(f"UPDATE {tbl} SET {set_clause}"))

        # 8b. Ensure Pudhumai Penn has SCHOOL_TYPE rule in eligibility_rules
        if "eligibility_rules" in existing_tables and "scholarships" in existing_tables:
            if dialect_name == "postgresql":
                _exec(text("ALTER TABLE eligibility_rules ALTER COLUMN is_mandatory SET DEFAULT TRUE"))
            like_clause = "s.name ILIKE '%Pudhumai Penn%'" if dialect_name == "postgresql" else "s.name LIKE '%Pudhumai Penn%'"
            _exec(text(f"""
                INSERT INTO eligibility_rules (scholarship_id, rule_type, criteria_value, operator, description, is_mandatory)
                SELECT s.id, 'SCHOOL_TYPE', 'Government School', 'EQUALS', 'Studied Classes 6 to 12 in Tamil Nadu Government School', true
                FROM scholarships s
                WHERE {like_clause}
                AND NOT EXISTS (
                    SELECT 1 FROM eligibility_rules er
                    WHERE er.scholarship_id = s.id AND er.rule_type = 'SCHOOL_TYPE'
                )
            """))

        # 8c. Ensure Saksham has DISABILITY_BENCHMARK rule in eligibility_rules
        if "eligibility_rules" in existing_tables and "scholarships" in existing_tables:
            saksham_like = "s.name ILIKE '%Saksham%'" if dialect_name == "postgresql" else "s.name LIKE '%Saksham%'"
            _exec(text(f"""
                INSERT INTO eligibility_rules (scholarship_id, rule_type, criteria_value, operator, description, is_mandatory)
                SELECT s.id, 'DISABILITY_BENCHMARK', '40', 'GTE', 'Benchmark disability of 40% or above certified by UDID or Medical Board', true
                FROM scholarships s
                WHERE {saksham_like}
                AND NOT EXISTS (
                    SELECT 1 FROM eligibility_rules er
                    WHERE er.scholarship_id = s.id AND er.rule_type IN ('DISABILITY', 'DISABILITY_BENCHMARK', 'PWD')
                )
            """))

        # 9. Sync PostgreSQL primary key sequences with MAX(id) to prevent duplicate key violations
        _sync_pg_sequences()

    # Determine if db_engine_or_conn is an Engine or a Connection
    from sqlalchemy.engine import Engine, Connection
    if isinstance(db_engine_or_conn, Engine):
        with db_engine_or_conn.begin() as conn:
            _apply_migrations(conn)
    elif isinstance(db_engine_or_conn, Connection):
        _apply_migrations(db_engine_or_conn)
    elif hasattr(db_engine_or_conn, "begin") and callable(getattr(db_engine_or_conn, "connect", None)):
        with db_engine_or_conn.begin() as conn:
            _apply_migrations(conn)
    elif hasattr(db_engine_or_conn, "execute"):
        _apply_migrations(db_engine_or_conn)
    else:
        with db_engine_or_conn.begin() as conn:
            _apply_migrations(conn)

    logger.info("Safe schema migration checks completed.")
