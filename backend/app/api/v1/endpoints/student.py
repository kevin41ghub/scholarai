from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.auth import get_current_student
from app.models.student import Student
from app.services.student_service import student_service
from app.schemas.student import StudentDetailResponse, StudentUpdate
from app.schemas.funding import FundingOverviewResponse

router = APIRouter()


@router.get("/me", response_model=StudentDetailResponse, summary="Get Current Student Profile")
def get_current_student_profile(
    current_student: Student = Depends(get_current_student),
):
    """
    Returns the authenticated student's personal, academic, and financial profile.
    """
    return current_student


@router.put("/me", response_model=StudentDetailResponse, summary="Update Student Profile")
def update_current_student_profile(
    update_data: StudentUpdate,
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """
    Updates the authenticated student's personal, academic, and/or financial details.
    Validates all numeric boundaries (CGPA 0-10, percentage 0-100, income/cost/support >= 0).
    Recalculates the funding gap dynamically from updated stored values.
    Persists changes to the database.
    """
    updated_student = student_service.update_student(db, current_student, update_data)
    return updated_student


@router.get("/funding", response_model=FundingOverviewResponse, summary="Get Student Funding Overview")
def get_student_funding(
    current_student: Student = Depends(get_current_student),
):
    """
    Returns the authenticated student's funding breakdown:
    - Annual Education Cost
    - Existing Support
    - Calculated Remaining Funding Gap: max(0, cost - support)
    - Funding Progress Percentage
    - Annual Family Income
    """
    funding = current_student.funding_profile
    if not funding:
        return FundingOverviewResponse(
            annual_education_cost=0.0,
            existing_support=0.0,
            funding_gap=0.0,
            funding_progress_percentage=0.0,
            annual_family_income=0.0,
        )
    return FundingOverviewResponse(
        annual_education_cost=funding.annual_education_cost,
        existing_support=funding.existing_support,
        funding_gap=funding.funding_gap,
        funding_progress_percentage=funding.funding_progress_percentage,
        annual_family_income=funding.annual_family_income,
    )
