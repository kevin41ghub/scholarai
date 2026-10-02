from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.student import Student
from app.models.document import Document
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement


class DependencyService:
    @staticmethod
    def get_dependency_graph(db: Session, student_id: int) -> Dict[str, Any]:
        """
        Builds the cross-application dependency graph:
        Student -> Documents -> Application Requirements -> Applications -> Scholarships
        Identifies shared blockers and calculates potential funding affected.
        """
        # Fetch active applications
        applications = (
            db.query(Application)
            .filter(
                Application.student_id == student_id,
                Application.status.in_(["IN_PROGRESS", "READY", "NOT_STARTED"])
            )
            .all()
        )

        documents = db.query(Document).filter(Document.student_id == student_id).all()
        doc_map = {doc.document_type: doc for doc in documents}

        # Analyze requirements across active applications
        # Map: document_type -> { "doc": Document, "applications": [Application], "scholarships": [Scholarship] }
        shared_map: Dict[str, Dict[str, Any]] = {}

        for app in applications:
            for req in app.requirements:
                if not req.is_required:
                    continue

                dtype = req.document_type
                if dtype not in shared_map:
                    doc = doc_map.get(dtype)
                    shared_map[dtype] = {
                        "document_type": dtype,
                        "document_name": doc.name if doc else req.name,
                        "document_status": doc.status if doc else req.status,
                        "document_id": doc.id if doc else None,
                        "affected_applications": [],
                        "potential_funding_affected": 0.0,
                    }

                # Add application if not already recorded
                app_info = {
                    "application_id": app.id,
                    "scholarship_id": app.scholarship_id,
                    "scholarship_name": app.scholarship.name,
                    "scholarship_amount": app.scholarship.amount,
                    "status": app.status,
                    "requirement_status": req.status,
                }
                # Check uniqueness by application_id
                if not any(a["application_id"] == app.id for a in shared_map[dtype]["affected_applications"]):
                    shared_map[dtype]["affected_applications"].append(app_info)
                    if req.status in ["MISSING", "NEEDS_VERIFICATION"]:
                        shared_map[dtype]["potential_funding_affected"] += float(app.scholarship.amount)

        # Categorize into shared blockers vs resolved dependencies
        blockers = []
        resolved = []

        for dtype, data in shared_map.items():
            blocked_count = sum(
                1 for a in data["affected_applications"]
                if a["requirement_status"] in ["MISSING", "NEEDS_VERIFICATION"]
            )
            data["blocked_applications_count"] = blocked_count
            data["total_applications_count"] = len(data["affected_applications"])

            if data["document_status"] in ["MISSING", "NEEDS_VERIFICATION"] and blocked_count > 0:
                blockers.append(data)
            else:
                resolved.append(data)

        # Sort blockers by number of applications blocked and funding affected descending
        blockers.sort(
            key=lambda b: (b["blocked_applications_count"], b["potential_funding_affected"]),
            reverse=True
        )

        return {
            "total_active_applications": len(applications),
            "total_documents": len(documents),
            "shared_blockers": blockers,
            "resolved_dependencies": resolved,
            "primary_blocker": blockers[0] if blockers else None,
        }

    @staticmethod
    def sync_document_to_requirements(db: Session, student_id: int, document: Document) -> Dict[str, Any]:
        """
        Document cascade unblocking:
        When document status changes (e.g. MISSING -> AVAILABLE),
        updates all matching ApplicationRequirements for this student.
        Recalculates progress for affected applications.
        """
        # Find all application requirements of this student with matching document_type
        apps = (
            db.query(Application)
            .filter(Application.student_id == student_id)
            .all()
        )

        updated_requirements_count = 0
        affected_apps_count = 0

        for app in apps:
            app_modified = False
            for req in app.requirements:
                if req.document_type == document.document_type:
                    # Update status to match document
                    req.status = document.status
                    req.document_id = document.id
                    updated_requirements_count += 1
                    app_modified = True

            if app_modified:
                # Recalculate progress for this application
                total_reqs = len(app.requirements)
                completed_reqs = sum(
                    1 for r in app.requirements
                    if r.status in ["AVAILABLE", "VERIFIED"]
                )

                if total_reqs > 0:
                    app.progress = round((completed_reqs / total_reqs) * 100.0, 1)
                else:
                    app.progress = 100.0

                # Advance status if all required items are available
                if app.progress >= 99.9 and app.status == "IN_PROGRESS":
                    app.status = "READY"
                elif app.progress < 99.9 and app.status == "READY":
                    app.status = "IN_PROGRESS"

                affected_apps_count += 1

        db.commit()

        return {
            "document_id": document.id,
            "document_name": document.name,
            "new_status": document.status,
            "updated_requirements_count": updated_requirements_count,
            "affected_applications_count": affected_apps_count,
        }


dependency_service = DependencyService()
