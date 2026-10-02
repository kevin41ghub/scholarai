from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, computed_field


class FundingProfileBase(BaseModel):
    annual_education_cost: float = Field(..., ge=0, description="Annual cost of education in INR")
    existing_support: float = Field(..., ge=0, description="Existing scholarship/financial support in INR")
    annual_family_income: float = Field(..., ge=0, description="Annual family income in INR")


class FundingProfileUpdate(BaseModel):
    annual_education_cost: Optional[float] = Field(None, ge=0)
    existing_support: Optional[float] = Field(None, ge=0)
    annual_family_income: Optional[float] = Field(None, ge=0)


class FundingProfileResponse(BaseModel):
    id: int
    student_id: int
    annual_education_cost: float
    existing_support: float
    annual_family_income: float
    funding_gap: float
    funding_progress_percentage: float

    model_config = ConfigDict(from_attributes=True)


class FundingOverviewResponse(BaseModel):
    annual_education_cost: float
    existing_support: float
    funding_gap: float
    funding_progress_percentage: float
    annual_family_income: float

    model_config = ConfigDict(from_attributes=True)
