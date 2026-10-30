from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field


class PlannerGoalUpdate(BaseModel):
    target_funding: Optional[float] = Field(None, ge=0)
    purpose: Optional[str] = None
    timeline: Optional[str] = None
    available_hours_per_week: Optional[float] = Field(None, ge=0.5, le=80.0)
    priorities: Optional[str] = None


class FundingOverviewInPlanner(BaseModel):
    annual_education_cost: Optional[float] = None
    existing_support: Optional[float] = None
    funding_gap: Optional[float] = None
    target_funding: Optional[float] = None
    potential_funding_identified: Optional[float] = None
    potential_remaining_gap: Optional[float] = None
    funding_progress: Optional[float] = None


class GoalPreferencesInPlanner(BaseModel):
    purpose: Optional[str] = None
    timeline: Optional[str] = None
    available_hours_per_week: Optional[float] = None
    priorities: Optional[str] = None


class WeeklyAllocationItem(BaseModel):
    task: str
    allocated_hours: float
    reason: str
    category: str


class SuggestedWeeklyPlan(BaseModel):
    total_hours: float
    allocations: List[WeeklyAllocationItem]
    methodology_disclaimer: str


class DistinctionItem(BaseModel):
    concept: str
    meaning: str


class FundingStrategyInPlanner(BaseModel):
    active_applications_count: int
    potential_combined_coverage: float
    distinctions: List[DistinctionItem]
    concurrent_award_rule: str


class PlannerOverviewResponse(BaseModel):
    funding_overview: FundingOverviewInPlanner
    goal_preferences: GoalPreferencesInPlanner
    suggested_weekly_plan: SuggestedWeeklyPlan
    funding_strategy: FundingStrategyInPlanner

    model_config = ConfigDict(from_attributes=True)
