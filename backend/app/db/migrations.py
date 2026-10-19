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
                    try:
                        if dialect_name == "postgresql":
                            conn.execute(text(f"ALTER TABLE documents ADD COLUMN IF NOT EXISTS {col_name} {pg_type}"))
                        else:
                            conn.execute(text(f"ALTER TABLE documents ADD COLUMN {col_name} {sqlite_type}"))
                    except Exception as col_err:
                        logger.warning(f"Could not add column {col_name} to documents: {col_err}")

        # 2. Update users table if it exists
        if "users" in existing_tables:
            user_columns = {col["name"] for col in inspector.get_columns("users")}
            if "role" not in user_columns:
                logger.info("Adding column 'role' to 'users' table...")
                try:
                    if dialect_name == "postgresql":
                        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'STUDENT'"))
                    else:
                        conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'STUDENT'"))
                except Exception as role_err:
                    logger.warning(f"Could not add column role to users: {role_err}")

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
            ]
            for col_name, sqlite_type, pg_type in new_sch_columns:
                if col_name not in sch_columns:
                    logger.info(f"Adding column '{col_name}' to 'scholarships' table...")
                    try:
                        if dialect_name == "postgresql":
                            conn.execute(text(f"ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS {col_name} {pg_type}"))
                        else:
                            conn.execute(text(f"ALTER TABLE scholarships ADD COLUMN {col_name} {sqlite_type}"))
                    except Exception as col_err:
                        logger.warning(f"Could not add column {col_name} to scholarships: {col_err}")

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
                    try:
                        conn.execute(text(f"ALTER TABLE scholarships ALTER COLUMN {col_name} TYPE {pg_type}"))
                    except Exception as alter_err:
                        logger.warning(f"Note widening column {col_name} on scholarships: {alter_err}")

        # 4. Update actions table if it exists
        if "actions" in existing_tables and dialect_name == "postgresql":
            try:
                conn.execute(text("ALTER TABLE actions ALTER COLUMN effort_estimate TYPE VARCHAR(255)"))
            except Exception as act_err:
                logger.warning(f"Note widening effort_estimate on actions: {act_err}")

        # 5. Update student_profiles table if it exists
        if "student_profiles" in existing_tables:
            sp_columns = {col["name"] for col in inspector.get_columns("student_profiles")}
            if "gender" not in sp_columns:
                logger.info("Adding column 'gender' to 'student_profiles' table...")
                try:
                    if dialect_name == "postgresql":
                        conn.execute(text("ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(50) DEFAULT 'Male'"))
                    else:
                        conn.execute(text("ALTER TABLE student_profiles ADD COLUMN gender VARCHAR(50) DEFAULT 'Male'"))
                except Exception as sp_err:
                    logger.warning(f"Could not add column gender to student_profiles: {sp_err}")

        # 6. Ensure performance and constraint indexes exist
        index_definitions = [
            ("documents", "ix_documents_content_hash", "documents(content_hash)"),
            ("scholarships", "ix_scholarships_dossier_index", "scholarships(dossier_index)"),
            ("scholarships", "ix_scholarships_stream", "scholarships(stream)"),
            ("scholarships", "ix_scholarships_study_level", "scholarships(study_level)"),
            ("scholarships", "ix_scholarships_category_tag", "scholarships(category_tag)"),
            ("scholarships", "ix_scholarships_source_verification_status", "scholarships(source_verification_status)"),
            ("scholarships", "ix_scholarships_application_window_status", "scholarships(application_window_status)"),
        ]
        for tbl, idx_name, cols in index_definitions:
            if tbl in existing_tables:
                try:
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {cols}"))
                except Exception as idx_err:
                    logger.warning(f"Note creating index {idx_name}: {idx_err}")

        # 7. Idempotent default backfill for legacy rows with NULLs
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
            ("student_profiles", "gender = 'Male' WHERE gender IS NULL"),
        ]
        for tbl, set_clause in backfill_updates:
            if tbl in existing_tables:
                try:
                    conn.execute(text(f"UPDATE {tbl} SET {set_clause}"))
                except Exception as bf_err:
                    logger.warning(f"Note backfilling {tbl}: {bf_err}")

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
