from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field


class PlannerGoalUpdate(BaseModel):
    target_funding: Optional[float] = Field(None, ge=0)
    purpose: Optional[str] = None
    timeline: Optional[str] = None
    available_hours_per_week: Optional[float] = Field(None, ge=0.5, le=80.0)
    priorities: Optional[str] = None


class FundingOverviewInPlanner(BaseModel):
    annual_education_cost: float
    existing_support: float
    funding_gap: float
    target_funding: float
    potential_funding_identified: float
    potential_remaining_gap: float
    funding_progress: float


class GoalPreferencesInPlanner(BaseModel):
    purpose: str
    timeline: str
    available_hours_per_week: float
    priorities: str


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
