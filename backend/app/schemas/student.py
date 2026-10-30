from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.schemas.funding import FundingProfileResponse


class StudentProfileBase(BaseModel):
    institution: Optional[str] = Field(None, min_length=1)
    course: Optional[str] = Field(None, min_length=1)
    year: Optional[str] = Field(None, min_length=1)
    cgpa: Optional[float] = Field(None, ge=0.0, le=10.0, description="Optional CGPA (not mandatory)")
    twelfth_percentage: Optional[float] = Field(None, ge=0.0, le=100.0, description="Optional 12th percentage")
    category: Optional[str] = Field("BC", min_length=1)
    state: Optional[str] = Field("Tamil Nadu", min_length=1)
    gender: Optional[str] = "Male"

    # Personal Information Extensions
    dob: Optional[str] = None
    district: Optional[str] = None
    native_state: Optional[str] = "Tamil Nadu"
    domicile_status: Optional[str] = "Tamil Nadu Domicile"

    # Academic Information Extensions
    education_level: Optional[str] = "Undergraduate"
    stream: Optional[str] = "Engineering & Technology"
    university: Optional[str] = None
    admission_year: Optional[str] = None
    current_semester: Optional[str] = None
    qualifying_exam: Optional[str] = None
    qualifying_marks: Optional[float] = None
    institution_type: Optional[str] = "Government-aided"
    admission_quota: Optional[str] = Field("GOVERNMENT_QUOTA", description="Admission Quota: GOVERNMENT_QUOTA or MANAGEMENT_QUOTA")
    hosteller_status: Optional[str] = Field("DAY_SCHOLAR", description="Residential Status: DAY_SCHOLAR or HOSTELLER")
    mode_of_study: Optional[str] = "Regular / Full-Time"
    studied_govt_school_6_to_12: Optional[bool] = None
    board_of_education: Optional[str] = "Tamil Nadu State Board"
    is_first_graduate: Optional[bool] = Field(False, description="First generation graduate in immediate family")
    school_type: Optional[str] = None
    school_study_history: Optional[str] = None

    # Community & Sensitive Reservation Attributes (Sub-caste deprecated & not collected)
    community_subcategory: Optional[str] = Field(None, description="Deprecated, not collected from students")
    minority_status: Optional[str] = "None"
    special_category: Optional[str] = "None"

    # Sports & Athletic Achievements
    participates_in_sports: Optional[bool] = False
    sport_discipline: Optional[str] = None
    sports_competition_level: Optional[str] = None
    sports_achievement_type: Optional[str] = None
    sports_certificate_status: Optional[str] = "Not Available"
    sports_achievement_year: Optional[str] = None

    # Disability & Accessibility Accommodations (Privacy-conscious & Optional)
    has_disability: Optional[bool] = False
    disability_consent_given: Optional[bool] = False
    disability_category: Optional[str] = None
    disability_percentage: Optional[float] = None
    udid_card_status: Optional[str] = "Not Available"
    accessibility_needs: Optional[str] = None

    # Bank & Benefit Distribution
    bank_readiness: Optional[str] = "NOT_CONFIGURED"
    account_holder_name: Optional[str] = None
    dbt_enabled: Optional[bool] = False
    dbt_seeding_status: Optional[str] = "Don't Know"
    ration_card_type: Optional[str] = "Not Available / Don't Know"
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None

    # Identity & Aadhaar Status
    aadhaar_verification_status: Optional[str] = "NOT_PROVIDED"
    aadhaar_masked: Optional[str] = None
    aadhaar_consent_given: Optional[bool] = False

    @field_validator("state", mode="before")
    @classmethod
    def validate_state(cls, v):
        if v is None:
            return "Tamil Nadu"
        v_str = str(v).strip()
        if v_str and v_str.lower() not in ["tamil nadu", "tamilnadu", "tn"]:
            raise ValueError("SCHOLARAi is exclusively available for higher education in Tamil Nadu. State of residence must be 'Tamil Nadu'.")
        return "Tamil Nadu"

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
    dob: Optional[str] = None
    district: Optional[str] = None
    native_state: Optional[str] = None
    domicile_status: Optional[str] = None
    gender: Optional[str] = None
    state: Optional[str] = None

    # Academic info (No CGPA requirement)
    institution: Optional[str] = Field(None, min_length=1)
    course: Optional[str] = Field(None, min_length=1)
    year: Optional[str] = Field(None, min_length=1)
    education_level: Optional[str] = None
    stream: Optional[str] = None
    university: Optional[str] = None
    admission_year: Optional[str] = None
    current_semester: Optional[str] = None
    qualifying_exam: Optional[str] = None
    qualifying_marks: Optional[float] = None
    institution_type: Optional[str] = None
    admission_quota: Optional[str] = None
    hosteller_status: Optional[str] = None
    mode_of_study: Optional[str] = None
    studied_govt_school_6_to_12: Optional[bool] = None
    board_of_education: Optional[str] = None
    is_first_graduate: Optional[bool] = None
    school_type: Optional[str] = None
    school_study_history: Optional[str] = None

    # Optional legacy academic scores (for test compatibility)
    cgpa: Optional[float] = Field(None, ge=0.0, le=10.0)
    twelfth_percentage: Optional[float] = Field(None, ge=0.0, le=100.0)

    # Community & Reservation (Sub-caste deprecated & not collected)
    category: Optional[str] = None
    community_subcategory: Optional[str] = Field(None, description="Deprecated, ignored")
    minority_status: Optional[str] = None
    special_category: Optional[str] = None

    # Sports & Athletic Achievements
    participates_in_sports: Optional[bool] = None
    sport_discipline: Optional[str] = None
    sports_competition_level: Optional[str] = None
    sports_achievement_type: Optional[str] = None
    sports_certificate_status: Optional[str] = None
    sports_achievement_year: Optional[str] = None

    # Disability & Accessibility Accommodations
    has_disability: Optional[bool] = None
    disability_consent_given: Optional[bool] = None
    disability_category: Optional[str] = None
    disability_percentage: Optional[float] = None
    udid_card_status: Optional[str] = None
    accessibility_needs: Optional[str] = None

    # Financial info
    annual_education_cost: Optional[float] = Field(None, ge=0.0)
    existing_support: Optional[float] = Field(None, ge=0.0)
    annual_family_income: Optional[float] = Field(None, ge=0.0)
    funding_gap: Optional[float] = Field(None, ge=0.0)  # Direct funding gap override/sync
    income_range: Optional[str] = None
    financial_circumstances_notes: Optional[str] = None
    income_certificate_status: Optional[str] = None

    # Bank and Benefit info
    bank_readiness: Optional[str] = None
    account_holder_name: Optional[str] = None
    dbt_enabled: Optional[bool] = None
    dbt_seeding_status: Optional[str] = None
    ration_card_type: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None

    # Identity and Aadhaar info
    aadhaar_verification_status: Optional[str] = None
    aadhaar_masked: Optional[str] = None
    aadhaar_consent_given: Optional[bool] = None

    @field_validator("state", mode="before")
    @classmethod
    def validate_update_state(cls, v):
        if v is None:
            return v
        v_str = str(v).strip()
        if v_str and v_str.lower() not in ["tamil nadu", "tamilnadu", "tn"]:
            raise ValueError("SCHOLARAi is exclusively available for higher education in Tamil Nadu. State of residence must be 'Tamil Nadu'.")
        return "Tamil Nadu"

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


class ProfileCompletionSection(BaseModel):
    status: str  # COMPLETE, INCOMPLETE, NEEDS_UPDATING, VERIFICATION_REQUIRED
    percentage: int
    missing_fields: List[str]
    summary: str


class ProfileCompletionResponse(BaseModel):
    overall_percentage: int
    overall_status: str
    sections: Dict[str, ProfileCompletionSection]
