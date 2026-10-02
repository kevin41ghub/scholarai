#!/usr/bin/env python3
"""
SCHOLARAi Database Bootstrap & Migration Script
Initializes database schema and populates canonical baseline data (demo student, catalog, knowledge base).
Safe to run in both local SQLite and production PostgreSQL environments.
"""
import sys
import os
import logging
from pathlib import Path

# Ensure backend root directory is in sys.path
backend_root = str(Path(__file__).resolve().parent.parent)
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.db.init_db import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("db_bootstrap")


def main():
    logger.info("Connecting to database and verifying schema...")
    try:
        # Create all tables if not present
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified.")

        # Seed canonical baseline data
        db = SessionLocal()
        try:
            init_db(db)
            logger.info("Database seeding completed successfully.")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Database bootstrap failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
