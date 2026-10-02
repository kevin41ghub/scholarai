from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.student_service import student_service
from app.schemas.student import StudentDetailResponse, StudentUpdate
from app.schemas.funding import FundingOverviewResponse

router = APIRouter()


@router.get("/me", response_model=StudentDetailResponse, summary="Get Current Student Profile")
def get_current_student(db: Session = Depends(get_db)):
    """
    Returns the primary student's personal, academic, and financial profile.
    In Phase 1, automatically retrieves the seeded demo student.
    """
    student = student_service.get_or_create_primary_student(db)
    return student


@router.put("/me", response_model=StudentDetailResponse, summary="Update Student Profile")
def update_current_student(
    update_data: StudentUpdate,
    db: Session = Depends(get_db),
):
    """
    Updates the student's personal, academic, and/or financial details.
    Validates all numeric boundaries (CGPA 0-10, percentage 0-100, income/cost/support >= 0).
    Recalculates the funding gap dynamically from updated stored values.
    Persists changes to the database.
    """
    student = student_service.get_or_create_primary_student(db)
    updated_student = student_service.update_student(db, student, update_data)
    return updated_student


@router.get("/funding", response_model=FundingOverviewResponse, summary="Get Student Funding Overview")
def get_student_funding(db: Session = Depends(get_db)):
    """
    Returns the student's funding breakdown:
    - Annual Education Cost
    - Existing Support
    - Calculated Remaining Funding Gap: max(0, cost - support)
    - Funding Progress Percentage
    - Annual Family Income
    """
    student = student_service.get_or_create_primary_student(db)
    funding = student.funding_profile
    return FundingOverviewResponse(
        annual_education_cost=funding.annual_education_cost,
        existing_support=funding.existing_support,
        funding_gap=funding.funding_gap,
        funding_progress_percentage=funding.funding_progress_percentage,
        annual_family_income=funding.annual_family_income,
    )
