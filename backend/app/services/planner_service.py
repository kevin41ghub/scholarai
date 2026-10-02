from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.student import Student
from app.models.planner import PlannerGoal
from app.models.application import Application
from app.services.next_best_action_service import next_best_action_service
from app.services.dependency_service import dependency_service


class PlannerService:
    @staticmethod
    def get_or_create_goal(db: Session, student_id: int) -> PlannerGoal:
        goal = db.query(PlannerGoal).filter(PlannerGoal.student_id == student_id).first()
        if not goal:
            goal = PlannerGoal(
                student_id=student_id,
                target_funding=60000.0,
                purpose="Tuition & Academic Expenses",
                timeline="Current Academic Year",
                available_hours_per_week=5.0,
                priorities="High-impact & Deadline-urgent"
            )
            db.add(goal)
            db.commit()
            db.refresh(goal)
        return goal

    @staticmethod
    def generate_plan(db: Session, student: Student) -> Dict[str, Any]:
        """
        Generates weekly effort allocation and portfolio funding strategy.
        """
        funding = student.funding_profile
        goal = PlannerService.get_or_create_goal(db, student.id)
        active_apps = (
            db.query(Application)
            .filter(
                Application.student_id == student.id,
                Application.status.in_(["IN_PROGRESS", "READY", "NOT_STARTED"])
            )
            .all()
        )

        actions = next_best_action_service.generate_and_rank_actions(db, student.id)

        # Calculate portfolio funding metrics
        cost = float(funding.annual_education_cost)
        support = float(funding.existing_support)
        gap = max(0.0, cost - support)
        target = float(goal.target_funding)

        potential_identified = sum(float(a.scholarship.amount) for a in active_apps)
        potential_remaining_gap = max(0.0, gap - potential_identified)
        funding_progress = round((support / cost * 100.0), 1) if cost > 0 else 100.0

        # Heuristic Time-Constrained Allocation (e.g. 5 hours)
        available_hours = float(goal.available_hours_per_week or 5.0)
        allocations: List[Dict[str, Any]] = []
        hours_left = available_hours

        # 1. Allocate to primary blocker if any
        dep_data = dependency_service.get_dependency_graph(db, student.id)
        primary_blocker = dep_data.get("primary_blocker")

        if primary_blocker and hours_left >= 1.0:
            alloc_hours = min(2.0, hours_left)
            allocations.append({
                "task": f"Resolve Shared Blocker: {primary_blocker['document_name']}",
                "allocated_hours": alloc_hours,
                "reason": f"Unblocks {primary_blocker['blocked_applications_count']} active applications representing ₹{int(primary_blocker['potential_funding_affected']):,} in potential aid.",
                "category": "DOCUMENT_PREPARATION",
            })
            hours_left -= alloc_hours

        # 2. Allocate to active applications by deadline urgency
        sorted_apps = sorted(active_apps, key=lambda a: a.scholarship.deadline)
        for app in sorted_apps:
            if hours_left <= 0:
                break
            alloc_hours = min(1.5, hours_left)
            allocations.append({
                "task": f"Progress {app.scholarship.name} ({app.status})",
                "allocated_hours": alloc_hours,
                "reason": f"Approaching deadline. Current completion is {app.progress:.0f}%. Potential award: ₹{int(app.scholarship.amount):,}.",
                "category": "APPLICATION_WORK",
            })
            hours_left -= alloc_hours

        # 3. If any time remaining, allocate to discovery/statement refinement
        if hours_left > 0:
            allocations.append({
                "task": "Review New Matching Schemes & Refine Statements",
                "allocated_hours": round(hours_left, 1),
                "reason": "Explore additional high-coverage opportunities on Discover to maximize fallback security.",
                "category": "STRATEGY_REVIEW",
            })

        return {
            "funding_overview": {
                "annual_education_cost": cost,
                "existing_support": support,
                "funding_gap": gap,
                "target_funding": target,
                "potential_funding_identified": potential_identified,
                "potential_remaining_gap": potential_remaining_gap,
                "funding_progress": funding_progress,
            },
            "goal_preferences": {
                "purpose": goal.purpose,
                "timeline": goal.timeline,
                "available_hours_per_week": goal.available_hours_per_week,
                "priorities": goal.priorities,
            },
            "suggested_weekly_plan": {
                "total_hours": available_hours,
                "allocations": allocations,
                "methodology_disclaimer": "Suggested weekly plan based on transparent deadline and blocker heuristics. Does not claim mathematical optimality.",
            },
            "funding_strategy": {
                "active_applications_count": len(active_apps),
                "potential_combined_coverage": potential_identified,
                "distinctions": [
                    {"concept": "CAN APPLY", "meaning": "You meet basic eligibility rules and can submit an application."},
                    {"concept": "CAN RECEIVE", "meaning": "The official awarding body reviews applications and chooses recipients."},
                    {"concept": "CAN HOLD CONCURRENTLY", "meaning": "Some scholarships prohibit receiving other government or private aid simultaneously."},
                ],
                "concurrent_award_rule": "Needs verification. Official scholarship rules determine concurrent holding rules. SCHOLARAi never assumes awards can be held simultaneously without verification.",
            }
        }


planner_service = PlannerService()
