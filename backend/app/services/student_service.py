from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.funding_profile import FundingProfile
from app.schemas.student import StudentUpdate
from app.db.init_db import init_db, DEMO_STUDENT_EMAIL


class StudentService:
    @staticmethod
    def get_or_create_primary_student(db: Session) -> Student:
        """
        Retrieves the primary student (demo student for Phase 1).
        If database is unseeded, seeds it automatically.
        """
        student = db.query(Student).filter(Student.email == DEMO_STUDENT_EMAIL).first()
        if not student:
            # Fallback check for any student
            student = db.query(Student).first()

        if not student:
            init_db(db)
            student = db.query(Student).filter(Student.email == DEMO_STUDENT_EMAIL).first()

        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found",
            )
        return student

    @staticmethod
    def update_student(db: Session, student: Student, update_data: StudentUpdate) -> Student:
        """
        Updates personal, academic, and financial profile details.
        Recalculates funding gap automatically via the FundingProfile model.
        """
        # Personal updates
        if update_data.name is not None:
            student.name = update_data.name.strip()
        if update_data.email is not None:
            # Check email uniqueness if changed
            existing_email = (
                db.query(Student)
                .filter(Student.email == update_data.email.strip(), Student.id != student.id)
                .first()
            )
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email is already in use by another student",
                )
            student.email = update_data.email.strip()
        if update_data.phone is not None:
            student.phone = update_data.phone.strip() if update_data.phone else None

        # Academic updates
        profile = student.profile
        if not profile:
            profile = StudentProfile(student_id=student.id)
            db.add(profile)

        if update_data.institution is not None:
            profile.institution = update_data.institution.strip()
        if update_data.course is not None:
            profile.course = update_data.course.strip()
        if update_data.year is not None:
            profile.year = update_data.year.strip()
        if update_data.cgpa is not None:
            profile.cgpa = float(update_data.cgpa)
        if update_data.twelfth_percentage is not None:
            profile.twelfth_percentage = float(update_data.twelfth_percentage)
        if update_data.category is not None:
            profile.category = update_data.category.strip()
        if update_data.state is not None:
            profile.state = update_data.state.strip()

        # Financial updates
        funding = student.funding_profile
        if not funding:
            funding = FundingProfile(student_id=student.id)
            db.add(funding)

        if update_data.annual_education_cost is not None:
            funding.annual_education_cost = float(update_data.annual_education_cost)
        if update_data.existing_support is not None:
            funding.existing_support = float(update_data.existing_support)
        if update_data.annual_family_income is not None:
            funding.annual_family_income = float(update_data.annual_family_income)

        db.commit()
        db.refresh(student)
        return student


student_service = StudentService()
