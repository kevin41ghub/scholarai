from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models.action import Action
from app.models.application import Application
from app.models.document import Document
from app.models.scholarship import Scholarship
from app.services.dependency_service import dependency_service
from app.services.deadline_risk_service import deadline_risk_service


class NextBestActionService:
    @staticmethod
    def generate_and_rank_actions(db: Session, student_id: int) -> List[Dict[str, Any]]:
        """
        Deterministically evaluates current application and document state
        to generate and rank recommended next-best actions.
        """
        dep_data = dependency_service.get_dependency_graph(db, student_id)
        active_apps = (
            db.query(Application)
            .filter(
                Application.student_id == student_id,
                Application.status.in_(["IN_PROGRESS", "READY", "NOT_STARTED"])
            )
            .all()
        )

        actions = []

        # 1. Evaluate Shared Blockers (Highest leverage action)
        for blocker in dep_data.get("shared_blockers", []):
            b_count = blocker["blocked_applications_count"]
            funding = blocker["potential_funding_affected"]
            doc_name = blocker["document_name"]
            urgency = "URGENT" if b_count >= 2 else "HIGH"

            actions.append({
                "title": f"Provide {doc_name} (Shared Blocker)",
                "reason": f"Required by {b_count} application(s). Resolving this unblocks ₹{int(funding):,} of potential funding.",
                "urgency": urgency,
                "deadline": None,
                "effort_estimate": "1-2 hours",
                "potential_funding_impact": funding,
                "blocker_impact": f"Blocks {b_count} applications",
                "action_type": "DOCUMENT",
                "target_type": "document",
                "target_id": blocker.get("document_id"),
                "priority_score": 100 + (b_count * 10),
            })

        # 2. Evaluate Active Applications by Deadline Risk & Readiness
        for app in active_apps:
            risk_info = deadline_risk_service.calculate_risk(app.scholarship.deadline, app.progress)
            risk = risk_info["risk_level"]
            days = risk_info["days_remaining"]
            amt = float(app.scholarship.amount)

            if app.status == "READY" or app.progress >= 99.9:
                actions.append({
                    "title": f"Review & Submit {app.scholarship.name}",
                    "reason": f"All requirements are complete! Application is ready for final review and official submission.",
                    "urgency": "URGENT" if days <= 5 else "HIGH",
                    "deadline": app.scholarship.deadline.isoformat(),
                    "effort_estimate": "30 mins",
                    "potential_funding_impact": amt,
                    "blocker_impact": "Ready for submission",
                    "action_type": "APPLICATION",
                    "target_type": "application",
                    "target_id": app.id,
                    "priority_score": 90 + (10 if days <= 5 else 0),
                })
            elif risk == "URGENT":
                actions.append({
                    "title": f"Address Urgent Deadline: {app.scholarship.name}",
                    "reason": f"Deadline is approaching in {days} day(s). Current progress is {app.progress:.0f}%.",
                    "urgency": "URGENT",
                    "deadline": app.scholarship.deadline.isoformat(),
                    "effort_estimate": "1-2 hours",
                    "potential_funding_impact": amt,
                    "blocker_impact": f"{len([r for r in app.requirements if r.status == 'MISSING'])} missing items",
                    "action_type": "APPLICATION",
                    "target_type": "application",
                    "target_id": app.id,
                    "priority_score": 95,
                })
            elif app.status == "IN_PROGRESS" and (not app.personal_statement or len(app.personal_statement.strip()) < 20):
                actions.append({
                    "title": f"Draft Statement of Purpose for {app.scholarship.name}",
                    "reason": "Personal statement is required to complete this application.",
                    "urgency": "MEDIUM",
                    "deadline": app.scholarship.deadline.isoformat(),
                    "effort_estimate": "1 hour",
                    "potential_funding_impact": amt,
                    "blocker_impact": "Requirement pending",
                    "action_type": "ESSAY",
                    "target_type": "application",
                    "target_id": app.id,
                    "priority_score": 60,
                })

        # 3. If under-subscribed, recommend starting high-match scholarships
        if len(active_apps) < 3:
            unapplied = (
                db.query(Scholarship)
                .filter(Scholarship.status == "ACTIVE")
                .all()
            )
            for s in unapplied[:2]:
                actions.append({
                    "title": f"Explore & Start {s.name}",
                    "reason": f"Potential match to cover educational gap with award amount of ₹{int(s.amount):,}.",
                    "urgency": "LOW",
                    "deadline": s.deadline.isoformat(),
                    "effort_estimate": s.application_effort or "2 hours",
                    "potential_funding_impact": float(s.amount),
                    "blocker_impact": "New application opportunity",
                    "action_type": "START_APPLICATION",
                    "target_type": "scholarship",
                    "target_id": s.id,
                    "priority_score": 40,
                })

        # Sort actions deterministically by priority_score descending
        actions.sort(key=lambda a: a["priority_score"], reverse=True)

        return actions


next_best_action_service = NextBestActionService()
