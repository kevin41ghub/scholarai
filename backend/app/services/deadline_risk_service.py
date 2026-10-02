from datetime import datetime, timezone
from typing import Dict, Any


class DeadlineRiskService:
    @staticmethod
    def calculate_risk(deadline: datetime, progress: float = 0.0) -> Dict[str, Any]:
        """
        Determines deadline risk deterministically from remaining days and progress.
        Returns:
            risk_level: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'EXPIRED'
            days_remaining: int
            hours_remaining: float
            message: str
        """
        now = datetime.now(timezone.utc)
        # Handle naive vs aware datetime
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)

        delta = deadline - now
        total_seconds = delta.total_seconds()
        days_remaining = int(delta.days)
        hours_remaining = round(total_seconds / 3600, 1)

        if total_seconds <= 0:
            return {
                "risk_level": "EXPIRED",
                "days_remaining": 0,
                "hours_remaining": 0.0,
                "message": "Deadline has passed.",
                "badge_variant": "neutral"
            }

        # Progress completion check
        is_complete = progress >= 99.9

        if days_remaining <= 4:
            risk = "URGENT" if not is_complete else "MEDIUM"
            msg = f"Critical: only {days_remaining} day(s) remaining!"
            variant = "warning"
        elif days_remaining <= 10:
            risk = "HIGH" if not is_complete else "LOW"
            msg = f"Approaching: {days_remaining} day(s) remaining."
            variant = "warning"
        elif days_remaining <= 21:
            risk = "MEDIUM"
            msg = f"{days_remaining} days remaining; steady progress advised."
            variant = "info"
        else:
            risk = "LOW"
            msg = f"{days_remaining} days remaining; ample preparation time."
            variant = "success"

        return {
            "risk_level": risk,
            "days_remaining": days_remaining,
            "hours_remaining": hours_remaining,
            "message": msg,
            "badge_variant": variant
        }


deadline_risk_service = DeadlineRiskService()
