from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.funding import FundingProfileResponse


class StudentProfileBase(BaseModel):
    institution: str = Field(..., min_length=1)
    course: str = Field(..., min_length=1)
    year: str = Field(..., min_length=1)
    cgpa: float = Field(..., ge=0.0, le=10.0, description="CGPA on a 10.0 scale")
    twelfth_percentage: float = Field(..., ge=0.0, le=100.0, description="12th grade percentage")
    category: str = Field(..., min_length=1)
    state: str = Field(..., min_length=1)


class StudentProfileResponse(StudentProfileBase):
    id: int
    student_id: int

    model_config = ConfigDict(from_attributes=True)


class StudentBase(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    phone: Optional[str] = None


class StudentDetailResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    profile: Optional[StudentProfileResponse] = None
    funding_profile: Optional[FundingProfileResponse] = None

    model_config = ConfigDict(from_attributes=True)


class StudentUpdate(BaseModel):
    # Personal info
    name: Optional[str] = Field(None, min_length=1)
    email: Optional[str] = Field(None, min_length=3)
    phone: Optional[str] = None

    # Academic info
    institution: Optional[str] = Field(None, min_length=1)
    course: Optional[str] = Field(None, min_length=1)
    year: Optional[str] = Field(None, min_length=1)
    cgpa: Optional[float] = Field(None, ge=0.0, le=10.0)
    twelfth_percentage: Optional[float] = Field(None, ge=0.0, le=100.0)
    category: Optional[str] = Field(None, min_length=1)
    state: Optional[str] = Field(None, min_length=1)

    # Financial info
    annual_education_cost: Optional[float] = Field(None, ge=0.0)
    existing_support: Optional[float] = Field(None, ge=0.0)
    annual_family_income: Optional[float] = Field(None, ge=0.0)
