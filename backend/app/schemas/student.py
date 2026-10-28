from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.schemas.funding import FundingProfileResponse


class StudentProfileBase(BaseModel):
    institution: str = Field(..., min_length=1)
    course: str = Field(..., min_length=1)
    year: str = Field(..., min_length=1)
    cgpa: float = Field(..., ge=0.0, le=10.0, description="CGPA on a 10.0 scale")
    twelfth_percentage: float = Field(..., ge=0.0, le=100.0, description="12th grade percentage")
    category: str = Field(..., min_length=1)
    state: str = Field(..., min_length=1)
    gender: Optional[str] = "Male"

    # Institutional & Quota Attributes (Task 3)
    admission_quota: Optional[str] = Field("GOVERNMENT_QUOTA", description="Admission Quota: GOVERNMENT_QUOTA or MANAGEMENT_QUOTA")
    hosteller_status: Optional[str] = Field("DAY_SCHOLAR", description="Residential Status: DAY_SCHOLAR or HOSTELLER")
    is_first_graduate: Optional[bool] = Field(False, description="First generation graduate in immediate family")

    @field_validator("admission_quota", mode="before")
    @classmethod
    def validate_admission_quota(cls, v):
        if v is None:
            return v
        v_str = str(v).strip().upper()
        if v_str in ["GOVERNMENT_QUOTA", "GOVERNMENT", "GOVT", "COUNSELLING", "TNEA"]:
            return "GOVERNMENT_QUOTA"
        if v_str in ["MANAGEMENT_QUOTA", "MANAGEMENT", "SELF_FINANCING", "MQ"]:
            return "MANAGEMENT_QUOTA"
        return v_str

    @field_validator("hosteller_status", mode="before")
    @classmethod
    def validate_hosteller_status(cls, v):
        if v is None:
            return v
        v_str = str(v).strip().upper()
        if v_str in ["DAY_SCHOLAR", "DAYSCHOLAR", "DAY"]:
            return "DAY_SCHOLAR"
        if v_str in ["HOSTELLER", "HOSTEL"]:
            return "HOSTELLER"
        return v_str


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
    gender: Optional[str] = None

    # Institutional & Quota Attributes (Task 3)
    admission_quota: Optional[str] = None
    hosteller_status: Optional[str] = None
    is_first_graduate: Optional[bool] = None

    # Financial info
    annual_education_cost: Optional[float] = Field(None, ge=0.0)
    existing_support: Optional[float] = Field(None, ge=0.0)
    annual_family_income: Optional[float] = Field(None, ge=0.0)

    @field_validator("admission_quota", mode="before")
    @classmethod
    def validate_update_admission_quota(cls, v):
        if v is None:
            return v
        v_str = str(v).strip().upper()
        if v_str in ["GOVERNMENT_QUOTA", "GOVERNMENT", "GOVT", "COUNSELLING", "TNEA"]:
            return "GOVERNMENT_QUOTA"
        if v_str in ["MANAGEMENT_QUOTA", "MANAGEMENT", "SELF_FINANCING", "MQ"]:
            return "MANAGEMENT_QUOTA"
        return v_str

    @field_validator("hosteller_status", mode="before")
    @classmethod
    def validate_update_hosteller_status(cls, v):
        if v is None:
            return v
        v_str = str(v).strip().upper()
        if v_str in ["DAY_SCHOLAR", "DAYSCHOLAR", "DAY"]:
            return "DAY_SCHOLAR"
        if v_str in ["HOSTELLER", "HOSTEL"]:
            return "HOSTELLER"
        return v_str
