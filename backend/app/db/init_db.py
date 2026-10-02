import logging
from sqlalchemy.orm import Session
from app.db.base import Base
from app.db.session import engine
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.funding_profile import FundingProfile

logger = logging.getLogger(__name__)

DEMO_STUDENT_EMAIL = "arjun.kumar@demo.edu"


def init_db(db: Session) -> None:
    """
    Initialize tables and seed the demo student if not present.
    Safe and idempotent.
    """
    # Create all tables defined in Base metadata on the active engine/connection
    Base.metadata.create_all(bind=db.get_bind())

    # Check if demo student exists
    student = db.query(Student).filter(Student.email == DEMO_STUDENT_EMAIL).first()
    if not student:
        logger.info("Seeding demo student: Arjun Kumar")
        student = Student(
            name="Arjun Kumar",
            email=DEMO_STUDENT_EMAIL,
            phone="+91 98765 43210",
        )
        db.add(student)
        db.flush()  # to obtain student.id

        profile = StudentProfile(
            student_id=student.id,
            institution="Demo Engineering College",
            course="B.Tech Computer Science",
            year="2nd Year",
            cgpa=8.4,
            twelfth_percentage=89.2,
            category="OBC",
            state="Karnataka",
        )
        db.add(profile)

        funding = FundingProfile(
            student_id=student.id,
            annual_education_cost=120000.0,
            existing_support=60000.0,
            annual_family_income=240000.0,
        )
        db.add(funding)

        db.commit()
        logger.info("Demo student seeded successfully.")
    else:
        logger.info("Demo student already present. Skipping seed.")
