from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class UserRegisterRequest(BaseModel):
    email: str = Field(..., description="Email address")
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    name: str = Field(..., min_length=2)
    phone: Optional[str] = None
    institution: Optional[str] = "Engineering College"
    course: Optional[str] = "B.Tech Computer Science"
    year: Optional[str] = "2nd Year"
    cgpa: Optional[float] = 8.0
    twelfth_percentage: Optional[float] = 85.0
    category: Optional[str] = "General"
    state: Optional[str] = "Karnataka"
    gender: Optional[str] = "Other"
    annual_family_income: Optional[float] = 250000.0
    annual_education_cost: Optional[float] = 120000.0
    existing_support: Optional[float] = 60000.0


class UserLoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    is_active: bool
    is_demo: bool
    student_id: int
    student_name: str

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    message: str
    user: UserResponse
    session_token: str
