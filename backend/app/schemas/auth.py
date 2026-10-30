from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator


class UserRegisterRequest(BaseModel):
    """
    Simplified registration schema:
    Only requires name, email, and password.
    CGPA, family income, and funding gap are completely removed from required registration.
    """
    email: str = Field(..., description="Email address")
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    name: str = Field(..., min_length=2, description="Student full name")
    phone: Optional[str] = None
    institution: Optional[str] = None
    course: Optional[str] = None
    year: Optional[str] = "1st Year"
    state: Optional[str] = "Tamil Nadu"
    gender: Optional[str] = None

    # Backward compatibility for existing payloads (optional, ignored or used safely)
    cgpa: Optional[float] = None
    twelfth_percentage: Optional[float] = None
    category: Optional[str] = None
    annual_family_income: Optional[float] = None
    annual_education_cost: Optional[float] = None
    existing_support: Optional[float] = None

    @field_validator("state", mode="before")
    @classmethod
    def validate_state(cls, v):
        if v is None:
            return "Tamil Nadu"
        v_str = str(v).strip()
        if v_str and v_str.lower() not in ["tamil nadu", "tamilnadu", "tn"]:
            raise ValueError("SCHOLARAi is exclusively available for higher education in Tamil Nadu. State must be 'Tamil Nadu'.")
        return "Tamil Nadu"


class UserLoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: str = "STUDENT"
    is_active: bool
    is_demo: bool
    student_id: int
    student_name: str

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    message: str
    user: UserResponse
    session_token: str
