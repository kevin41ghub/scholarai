from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.services.dependency_service import dependency_service


class BottleneckService:
    @staticmethod
    def get_portfolio_bottleneck(db: Session, student_id: int) -> Optional[Dict[str, Any]]:
        """
        Determines the primary systemic bottleneck across the student's active application portfolio.
        Returns:
            current_bottleneck: str
            why_it_matters: str
            what_it_unblocks: str
            potential_impact: str
            next_action: str
            funding_impact: float
            blocked_count: int
        """
        dep_data = dependency_service.get_dependency_graph(db, student_id)
        primary_blocker = dep_data.get("primary_blocker")

        if not primary_blocker or primary_blocker["blocked_applications_count"] == 0:
            return {
                "has_bottleneck": False,
                "current_bottleneck": "None",
                "why_it_matters": "All document dependencies are in place. No shared blockers detected.",
                "what_it_unblocks": "Applications are ready for final review and submission.",
                "potential_impact": "₹0",
                "next_action": "Review draft applications and submit before respective deadlines.",
                "funding_impact": 0.0,
                "blocked_count": 0,
            }

        doc_name = primary_blocker["document_name"]
        blocked_count = primary_blocker["blocked_applications_count"]
        funding = primary_blocker["potential_funding_affected"]
        affected_apps = [a["scholarship_name"] for a in primary_blocker["affected_applications"]]
        app_list_str = ", ".join(affected_apps)

        return {
            "has_bottleneck": True,
            "document_id": primary_blocker.get("document_id"),
            "document_type": primary_blocker.get("document_type"),
            "current_bottleneck": doc_name,
            "why_it_matters": f"Required by {blocked_count} active application(s): {app_list_str}.",
            "what_it_unblocks": f"Resolving this unblocks {blocked_count} applications representing ₹{int(funding):,} of potential funding.",
            "potential_impact": f"₹{int(funding):,} potential funding affected.",
            "next_action": f"Obtain and update the status of '{doc_name}' to Available.",
            "funding_impact": funding,
            "blocked_count": blocked_count,
        }


bottleneck_service = BottleneckService()
