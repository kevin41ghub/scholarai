from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.scholarship import Scholarship
from app.models.application import Application
from app.models.document import Document
from app.models.student import Student
from app.models.evidence import Evidence
from app.models.planner import PlannerGoal
from app.models.knowledge import KnowledgeSource, KnowledgeDocument, KnowledgeChunk
from app.services.eligibility_service import evaluate_scholarship_eligibility
from app.services.dependency_service import build_dependency_graph, find_shared_blockers
from app.services.deadline_risk_service import calculate_scholarship_deadline_risk
from app.services.next_best_action_service import get_ranked_actions_for_student
from app.services.planner_service import generate_weekly_plan


class AIToolkit:
    """
    Controlled tool execution layer for SCHOLARAi Assistant.
    Provides structured, read-only or strictly bounded methods wrapping services.
    Prevents direct arbitrary SQL/DB execution by LLMs.
    """

    def __init__(self, db: Session, student_id: int):
        self.db = db
        self.student_id = student_id

    def search_scholarships(self, query: str = "", limit: int = 5) -> List[Dict[str, Any]]:
        q = self.db.query(Scholarship).filter(Scholarship.status == "ACTIVE")
        if query:
            q = q.filter(
                or_(
                    Scholarship.name.ilike(f"%{query}%"),
                    Scholarship.provider.ilike(f"%{query}%"),
                    Scholarship.description.ilike(f"%{query}%"),
                )
            )
        results = q.limit(limit).all()
        return [
            {
                "id": s.id,
                "name": s.name,
                "provider": s.provider,
                "amount": s.amount,
                "currency": s.currency,
                "deadline": s.deadline.isoformat() if s.deadline else None,
                "verification_status": s.verification_status,
                "eligibility_summary": s.eligibility_summary,
            }
            for s in results
        ]

    def get_scholarship_details(self, scholarship_id: int) -> Optional[Dict[str, Any]]:
        s = self.db.query(Scholarship).filter(Scholarship.id == scholarship_id).first()
        if not s:
            return None
        return {
            "id": s.id,
            "name": s.name,
            "provider": s.provider,
            "amount": s.amount,
            "currency": s.currency,
            "deadline": s.deadline.isoformat() if s.deadline else None,
            "description": s.description,
            "verification_status": s.verification_status,
            "source_name": s.source_name,
            "application_effort": s.application_effort,
            "rules": [
                {"rule_type": r.rule_type, "criteria_value": r.criteria_value, "description": r.description}
                for r in s.rules
            ],
            "requirements": [
                {"name": req.name, "type": req.type, "is_required": req.is_required}
                for req in s.requirements
            ],
        }

    def check_eligibility(self, scholarship_id: int) -> Dict[str, Any]:
        return evaluate_scholarship_eligibility(self.db, scholarship_id, self.student_id)

    def get_user_funding_goal(self) -> Dict[str, Any]:
        student = self.db.query(Student).filter(Student.id == self.student_id).first()
        if not student:
            return {"error": "Student profile not found"}
        fp = student.funding_profile
        goal = student.planner_goal
        cost = fp.annual_education_cost if fp else 120000.0
        support = fp.existing_support if fp else 60000.0
        gap = max(0.0, cost - support)
        return {
            "annual_education_cost": cost,
            "existing_support": support,
            "funding_gap": gap,
            "target_funding": goal.target_funding if goal else gap,
            "available_hours_per_week": goal.available_hours_per_week if goal else 5.0,
            "purpose": goal.purpose if goal else "Education expenses",
        }

    def get_user_applications(self) -> List[Dict[str, Any]]:
        apps = self.db.query(Application).filter(Application.student_id == self.student_id).all()
        return [
            {
                "id": a.id,
                "scholarship_name": a.scholarship.name,
                "amount": a.scholarship.amount,
                "status": a.status,
                "progress": a.progress,
                "deadline": a.scholarship.deadline.isoformat() if a.scholarship.deadline else None,
                "requirements_total": len(a.requirements),
                "requirements_missing": sum(1 for r in a.requirements if r.status == "MISSING"),
            }
            for a in apps
        ]

    def get_application_status(self, application_id: int) -> Optional[Dict[str, Any]]:
        app_obj = self.db.query(Application).filter(
            Application.id == application_id, Application.student_id == self.student_id
        ).first()
        if not app_obj:
            return None
        return {
            "id": app_obj.id,
            "scholarship_name": app_obj.scholarship.name,
            "status": app_obj.status,
            "progress": app_obj.progress,
            "started_at": app_obj.started_at.isoformat() if app_obj.started_at else None,
            "personal_statement_length": len(app_obj.personal_statement or ""),
            "requirements": [
                {"name": r.name, "type": r.type, "status": r.status, "is_required": r.is_required}
                for r in app_obj.requirements
            ],
        }

    def get_missing_documents(self) -> List[Dict[str, Any]]:
        docs = self.db.query(Document).filter(
            Document.student_id == self.student_id, Document.status == "MISSING"
        ).all()
        return [
            {"id": d.id, "name": d.name, "document_type": d.document_type, "status": d.status}
            for d in docs
        ]

    def get_user_evidence(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        q = self.db.query(Evidence).filter(Evidence.student_id == self.student_id)
        if category:
            q = q.filter(Evidence.category == category)
        items = q.all()
        return [
            {
                "id": e.id,
                "title": e.title,
                "category": e.category,
                "description": e.description,
                "date": e.date,
                "organization": e.organization,
                "source_type": e.source_type,
                "source_name": e.source_name,
                "verification_status": e.verification_status,
                "confidence": e.confidence,
            }
            for e in items
        ]

    def find_application_blockers(self) -> List[Dict[str, Any]]:
        return find_shared_blockers(self.db, self.student_id)

    def build_dependency_graph(self) -> Dict[str, Any]:
        return build_dependency_graph(self.db, self.student_id)

    def calculate_deadline_risk(self, scholarship_id: int) -> Dict[str, Any]:
        s = self.db.query(Scholarship).filter(Scholarship.id == scholarship_id).first()
        if not s:
            return {"risk": "UNKNOWN", "days_left": None}
        app_obj = self.db.query(Application).filter(
            Application.student_id == self.student_id, Application.scholarship_id == scholarship_id
        ).first()
        completed = 0
        total = 0
        if app_obj and app_obj.requirements:
            total = len(app_obj.requirements)
            completed = sum(1 for r in app_obj.requirements if r.status in ("AVAILABLE", "VERIFIED"))
        return calculate_scholarship_deadline_risk(s.deadline, completed, total)

    def estimate_application_effort(self, scholarship_id: int) -> Dict[str, Any]:
        s = self.db.query(Scholarship).filter(Scholarship.id == scholarship_id).first()
        if not s:
            return {"effort": "Unknown"}
        return {
            "scholarship_name": s.name,
            "estimated_effort": s.application_effort or "Medium (2-4 hrs)",
            "requirements_count": len(s.requirements),
        }

    def get_next_best_actions(self) -> List[Dict[str, Any]]:
        return get_ranked_actions_for_student(self.db, self.student_id)

    def optimize_application_plan(self, available_hours: float = 5.0) -> Dict[str, Any]:
        return generate_weekly_plan(self.db, self.student_id, available_hours)

    def retrieve_scholarship_knowledge(self, query: str, scholarship_id: Optional[int] = None) -> List[Dict[str, Any]]:
        q = self.db.query(KnowledgeChunk).join(KnowledgeDocument)
        if scholarship_id:
            q = q.filter(KnowledgeDocument.scholarship_id == scholarship_id)
        
        words = query.lower().split()
        chunks = q.all()
        scored_chunks = []
        for chunk in chunks:
            chunk_lower = chunk.chunk_text.lower()
            score = sum(1 for w in words if w in chunk_lower)
            if score > 0:
                scored_chunks.append((score, chunk))
                
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        results = []
        for _, c in scored_chunks[:4]:
            source = c.document.source
            results.append({
                "chunk_text": c.chunk_text,
                "section": c.section,
                "source_name": source.name,
                "source_url": source.source_url,
                "authority_level": source.authority_level,
                "verification_status": source.verification_status,
                "last_verified_at": source.last_verified_at.strftime("%Y-%m-%d") if source.last_verified_at else "Needs Verification",
            })
        return results

    def retrieve_official_rules(self, scholarship_id: int) -> List[Dict[str, Any]]:
        s = self.db.query(Scholarship).filter(Scholarship.id == scholarship_id).first()
        if not s:
            return []
        return [
            {
                "rule_type": r.rule_type,
                "criteria_value": r.criteria_value,
                "operator": r.operator,
                "description": r.description,
                "verification_status": s.verification_status,
            }
            for r in s.rules
        ]
