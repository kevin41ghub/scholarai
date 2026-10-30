import logging
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_session_token
from app.core.auth import get_current_user, get_required_authenticated_user
from app.models.user import User
from app.models.student import Student
from app.models.student_profile import StudentProfile
from app.models.funding_profile import FundingProfile
from app.models.planner import PlannerGoal
from app.schemas.auth import UserRegisterRequest, UserLoginRequest, UserResponse, AuthResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(req: UserRegisterRequest, response: Response, db: Session = Depends(get_db)):
    """
    Register a new student account.
    Creates a User with salted PBKDF2 hash, plus linked Student profile and Funding profile.
    Sets secure HttpOnly session cookie.
    """
    existing_user = db.query(User).filter(User.email == req.email.lower()).first()
    existing_student = db.query(Student).filter(Student.email == req.email.lower()).first()
    if existing_user or existing_student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # 1. Create Student
    student = Student(
        name=req.name,
        email=req.email.lower(),
        phone=req.phone,
    )
    db.add(student)
    db.flush()

    # 2. Create StudentProfile with only student-provided values, no synthetic defaults
    profile = StudentProfile(
        student_id=student.id,
        institution=req.institution.strip() if req.institution else None,
        course=req.course.strip() if req.course else None,
        year=req.year.strip() if req.year else None,
        cgpa=req.cgpa,
        twelfth_percentage=req.twelfth_percentage,
        category=req.category.strip() if req.category else None,
        state=req.state.strip() if req.state else None,
        native_state=req.state.strip() if req.state else None,
        gender=req.gender.strip() if req.gender else None,
        education_level=None,
        stream=None,
        institution_type=None,
        bank_readiness="NOT_CONFIGURED",
        aadhaar_verification_status="NOT_PROVIDED",
    )
    db.add(profile)

    # 3. Create FundingProfile (initialized clean without synthetic prefill)
    funding = FundingProfile(
        student_id=student.id,
        annual_education_cost=req.annual_education_cost,
        existing_support=req.existing_support,
        annual_family_income=req.annual_family_income,
        income_certificate_status="NOT_UPLOADED",
    )
    db.add(funding)

    # 4. Create PlannerGoal (initialized clean with no synthetic defaults)
    goal_target = None
    if req.annual_education_cost is not None:
        goal_target = max(0.0, float(req.annual_education_cost) - float(req.existing_support or 0.0))
    goal = PlannerGoal(
        student_id=student.id,
        target_funding=goal_target,
        purpose=None,
        timeline=None,
        available_hours_per_week=None,
        priorities=None,
    )
    db.add(goal)

    # 5. Create User
    pwd_hash, salt = hash_password(req.password)
    user = User(
        email=req.email.lower(),
        password_hash=pwd_hash,
        salt=salt,
        student_id=student.id,
        is_active=True,
        is_demo=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 6. Generate Session Token and Cookie
    token = create_session_token(user_id=user.id, email=user.email)
    is_prod = settings.ENVIRONMENT.lower() == "production"
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="none" if is_prod else "lax",
        secure=is_prod,
        path="/"
    )

    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        role=user.role or "STUDENT",
        is_active=user.is_active,
        is_demo=user.is_demo,
        student_id=student.id,
        student_name=student.name,
    )

    return AuthResponse(
        message="Registration successful. Welcome to SCHOLARAi!",
        user=user_resp,
        session_token=token
    )


@router.post("/login", response_model=AuthResponse)
def login(req: UserLoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Authenticate user via email and password.
    Sets secure HttpOnly session cookie and returns session token.
    """
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.password_hash, user.salt):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is currently inactive.",
        )

    token = create_session_token(user_id=user.id, email=user.email)
    is_prod = settings.ENVIRONMENT.lower() == "production"
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="none" if is_prod else "lax",
        secure=is_prod,
        path="/"
    )

    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        role=user.role or "STUDENT",
        is_active=user.is_active,
        is_demo=user.is_demo,
        student_id=user.student_id,
        student_name=user.student.name if user.student else "Student",
    )

    return AuthResponse(
        message="Login successful.",
        user=user_resp,
        session_token=token
    )


@router.post("/logout")
def logout(response: Response):
    """
    Log out student and invalidate session cookie.
    """
    is_prod = settings.ENVIRONMENT.lower() == "production"
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="none" if is_prod else "lax",
        secure=is_prod
    )
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Retrieve currently logged in user profile.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role or "STUDENT",
        is_active=current_user.is_active,
        is_demo=current_user.is_demo,
        student_id=current_user.student_id,
        student_name=current_user.student.name if current_user.student else "Student",
    )
