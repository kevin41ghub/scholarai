#!/usr/bin/env python3
"""
SCHOLARAi Administrator Provisioning Script
Safely creates or promotes an administrator account.
Can be executed in local SQLite and production PostgreSQL environments.
"""
import sys
import os
import argparse
import logging
from pathlib import Path

# Ensure backend root directory is in sys.path
backend_root = str(Path(__file__).resolve().parent.parent)
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from sqlalchemy.orm import Session
from app.db.session import SessionLocal, engine
from app.models.user import User
from app.models.student import Student
from app.core.security import hash_password
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("provision_admin")


def provision_admin(email: str, password: str) -> None:
    db: Session = SessionLocal()
    try:
        norm_email = email.strip().lower()
        user = db.query(User).filter(User.email == norm_email).first()

        if user:
            logger.info(f"User '{norm_email}' already exists. Promoting to role='ADMIN'...")
            user.role = "ADMIN"
            user.is_active = True
            if password:
                pwd_hash, salt = hash_password(password)
                user.password_hash = pwd_hash
                user.salt = salt
            db.commit()
            logger.info(f"Admin account '{norm_email}' updated successfully.")
            return

        student = db.query(Student).filter(Student.email == norm_email).first()
        if not student:
            student = Student(
                name="System Administrator",
                email=norm_email,
                phone="0000000000",
            )
            db.add(student)
            db.flush()
        student_id = student.id

        pwd_hash, salt = hash_password(password)
        admin_user = User(
            email=norm_email,
            password_hash=pwd_hash,
            salt=salt,
            role="ADMIN",
            student_id=student_id,
            is_active=True,
            is_demo=False,
        )
        db.add(admin_user)
        db.commit()
        logger.info(f"Successfully provisioned new administrator account for '{norm_email}'.")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to provision administrator: {e}", exc_info=True)
        sys.exit(1)
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Provision a SCHOLARAi administrator account")
    parser.add_argument(
        "--email",
        default=os.environ.get("ADMIN_INITIAL_EMAIL", settings.ADMIN_INITIAL_EMAIL),
        help="Administrator email address",
    )
    parser.add_argument(
        "--password",
        default=os.environ.get("ADMIN_INITIAL_PASSWORD", settings.ADMIN_INITIAL_PASSWORD),
        help="Administrator initial password",
    )
    args = parser.parse_args()

    if not args.email:
        logger.error("Admin email must not be empty.")
        sys.exit(1)
    if not args.password:
        logger.error("Admin password must not be empty.")
        sys.exit(1)

    provision_admin(args.email, args.password)


if __name__ == "__main__":
    main()
