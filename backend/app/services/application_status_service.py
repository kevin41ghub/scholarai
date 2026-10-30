"""
SCHOLARAi Centralized Application Status & Workflow Engine
Determines application readiness, manages document reconciliation,
and enforces valid, authorized status transitions server-side.

Core Principle: "AI assists. Official sources decide. Student approves."
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.application import Application
from app.models.application_requirement import ApplicationRequirement
from app.models.document import Document
from app.models.scholarship import Scholarship
from app.models.user import User
from app.services.document_readiness_service import DOCUMENT_TYPE_ALIASES

logger = logging.getLogger("scholarai.application_status_service")


class ApplicationStatusService:
    """
    Central authority for application readiness, document checklist reconciliation,
    and valid status transitions.
    """

    VALID_TRANSITIONS = {
        "NOT_STARTED": {"IN_PROGRESS", "READY", "WITHDRAWN"},
        "IN_PROGRESS": {"READY", "WITHDRAWN"},
        "READY": {"IN_PROGRESS", "SUBMITTED", "WITHDRAWN"},
        "SUBMITTED": {"UNDER_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN"},
        "UNDER_REVIEW": {"APPROVED", "REJECTED", "WITHDRAWN"},
        "APPROVED": set(),  # Terminal state
        "REJECTED": set(),  # Terminal state
        "WITHDRAWN": set(), # Terminal state
    }

    def reconcile_application_requirements(self, db: Session, application: Application) -> Application:
        """
        Reconciles an application's requirements with:
        1. The scholarship's actual defined requirements (scholarship.requirements).
        2. The student's actual uploaded documents in persistent storage.

        Recalculates:
        - Each requirement's status (MISSING, AVAILABLE, VERIFIED, REJECTED, etc.)
        - Progress based on required items
        - Application readiness
        - Application status (IN_PROGRESS <-> READY) without touching submitted/terminal states.
        """
        # Ensure scholarship is loaded
        if not application.scholarship:
            application.scholarship = (
                db.query(Scholarship).filter(Scholarship.id == application.scholarship_id).first()
            )

        scholarship = application.scholarship
        if not scholarship:
            logger.warning(f"Scholarship {application.scholarship_id} not found for app {application.id}")
            return application

        # Fetch student's persisted documents
        student_docs = (
            db.query(Document)
            .filter(Document.student_id == application.student_id)
            .all()
        )
        docs_by_type: Dict[str, Document] = {d.document_type: d for d in student_docs}

        # Map existing application requirements by document_type
        existing_req_map: Dict[str, ApplicationRequirement] = {
            r.document_type: r for r in application.requirements
        }

        # 1. Synchronize requirements from the scholarship definition
        for sch_req in scholarship.requirements:
            if sch_req.document_type not in existing_req_map:
                new_req = ApplicationRequirement(
                    application_id=application.id,
                    name=sch_req.name,
                    document_type=sch_req.document_type,
                    type=sch_req.type,
                    is_required=sch_req.is_required,
                    status="MISSING",
                )
                db.add(new_req)
                application.requirements.append(new_req)
                existing_req_map[sch_req.document_type] = new_req
            else:
                existing_req = existing_req_map[sch_req.document_type]
                # Keep requirement flags in sync with canonical scholarship rules
                existing_req.is_required = sch_req.is_required
                existing_req.name = sch_req.name
                existing_req.type = sch_req.type

        # 2. Evaluate each requirement against actual uploaded documents
        for app_req in application.requirements:
            matched_doc = docs_by_type.get(app_req.document_type)

            # Check aliases if no direct match or if direct match is missing
            if not matched_doc or matched_doc.status == "MISSING":
                aliases = DOCUMENT_TYPE_ALIASES.get(app_req.document_type, [])
                for alias in aliases:
                    if alias in docs_by_type and docs_by_type[alias].status != "MISSING":
                        matched_doc = docs_by_type[alias]
                        break

            # If no document exists or document is explicitly MISSING
            if not matched_doc or matched_doc.status == "MISSING":
                app_req.document_id = None
                app_req.status = "MISSING"
                continue

            app_req.document_id = matched_doc.id

            # Determine requirement status based on real document verification status
            if matched_doc.verification_status == "REJECTED":
                app_req.status = "REJECTED"
            elif (
                matched_doc.verification_status == "OFFICIALLY_VERIFIED"
                or matched_doc.status == "VERIFIED"
            ):
                app_req.status = "VERIFIED"
            elif (
                matched_doc.status in ["AVAILABLE", "VERIFIED"]
                or matched_doc.verification_status in [
                    "AUTOMATED_CHECKS_PASSED",
                    "UPLOADED",
                    "NEEDS_HUMAN_REVIEW",
                ]
            ):
                app_req.status = "AVAILABLE"
            else:
                app_req.status = "MISSING"

        # 3. Calculate readiness based on REQUIRED documents
        required_reqs = [r for r in application.requirements if r.is_required]
        completed_required = [
            r for r in required_reqs if r.status in ["AVAILABLE", "VERIFIED"]
        ]
        missing_required = [
            r for r in required_reqs if r.status not in ["AVAILABLE", "VERIFIED"]
        ]
        missing_required_names = [r.name for r in missing_required]

        # Calculate progress percentage
        if len(required_reqs) > 0:
            application.progress = round(
                (len(completed_required) / len(required_reqs)) * 100.0, 1
            )
        else:
            application.progress = 100.0

        is_ready = len(missing_required) == 0

        # 4. Centralized status state machine
        current_status = application.status

        if current_status in ["NOT_STARTED", "IN_PROGRESS"]:
            if is_ready:
                self._record_status_transition(
                    application,
                    new_status="READY",
                    actor="system",
                    reason="All required documents have been uploaded and passed automated checks.",
                )
                application.preparation_status = "READY_FOR_REVIEW"
                application.status_reason = (
                    "All required documents have been uploaded and passed automated checks. "
                    "Application is ready for student review and submission."
                )
            else:
                application.status = "IN_PROGRESS"
                application.preparation_status = "ACTION_REQUIRED" if missing_required_names else "IN_PROGRESS"
                if missing_required_names:
                    application.status_reason = (
                        f"Required documents are still missing or pending checks: {', '.join(missing_required_names)}."
                    )
                else:
                    application.status_reason = "Application is in progress."

        elif current_status == "READY":
            if not is_ready:
                self._record_status_transition(
                    application,
                    new_status="IN_PROGRESS",
                    actor="system",
                    reason=f"Required document removed or invalidated: {', '.join(missing_required_names)}.",
                )
                application.preparation_status = "ACTION_REQUIRED"
                application.status_reason = (
                    f"Required documents are missing or pending checks: {', '.join(missing_required_names)}."
                )
            else:
                application.preparation_status = "READY_FOR_REVIEW" if not application.student_consented_at else "READY_TO_SUBMIT"
                application.status_reason = (
                    "All required documents have been uploaded and passed automated checks. "
                    "Application is ready for student review and submission."
                )

        elif current_status == "SUBMITTED":
            # Do NOT silently downgrade a submitted application.
            # Record an explicit audit event if a document is later invalidated.
            submitted_date = (
                application.submitted_at.strftime("%Y-%m-%d")
                if application.submitted_at
                else "record"
            )
            if not is_ready:
                self._record_status_event(
                    application,
                    event_type="AUDIT_WARNING",
                    actor="system",
                    reason=f"Document removed or invalidated after submission: {', '.join(missing_required_names)}.",
                )
                application.status_reason = (
                    f"Application submitted on {submitted_date}. "
                    f"Notice: A required document is currently missing: {', '.join(missing_required_names)}."
                )
            else:
                application.status_reason = (
                    f"Application was confirmed and submitted by student on {submitted_date}. "
                    "Recorded in SCHOLARAi; awaiting institutional review."
                )

        elif current_status == "UNDER_REVIEW":
            reviewer_info = f" by {application.reviewed_by}" if application.reviewed_by else ""
            application.status_reason = (
                f"Application is undergoing official review{reviewer_info}."
            )

        elif current_status == "APPROVED":
            reviewer_info = f" by {application.reviewed_by}" if application.reviewed_by else ""
            application.status_reason = (
                f"Application has been approved by the responsible authority{reviewer_info}."
            )

        elif current_status == "REJECTED":
            reviewer_info = f" by {application.reviewed_by}" if application.reviewed_by else ""
            application.status_reason = (
                f"Application was rejected by the responsible authority{reviewer_info}."
            )

        elif current_status == "WITHDRAWN":
            application.status_reason = "Application was explicitly withdrawn."

        return application

    def reconcile_student_applications(self, db: Session, student_id: int) -> List[Application]:
        """
        Reconciles all active applications for a student whenever documents are uploaded,
        replaced, removed, or reviewed.
        """
        apps = (
            db.query(Application)
            .filter(Application.student_id == student_id)
            .all()
        )
        for app in apps:
            self.reconcile_application_requirements(db, app)
        db.commit()
        for app in apps:
            db.refresh(app)
        return apps

    def submit_application(
        self,
        db: Session,
        application_id: int,
        student_id: int,
        actor_email: str,
    ) -> Application:
        """
        Authorizes student submission of an application.
        Strictly requires the application to be in READY state.
        """
        app = db.query(Application).filter(Application.id == application_id).first()
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found.",
            )
        if app.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to submit this application.",
            )

        # Reconcile immediately before submission to ensure real up-to-date state
        self.reconcile_application_requirements(db, app)

        if app.status != "READY":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Application cannot be submitted because it is not READY (current status: {app.status}). "
                    f"{app.status_reason}"
                ),
            )

        now = datetime.now(timezone.utc)
        app.submitted_at = now
        app.preparation_status = "READY_TO_SUBMIT"
        if not app.submission_status or app.submission_status == "NOT_SUBMITTED":
            app.submission_status = "MANUAL_SUBMISSION_REQUIRED"
        self._record_status_transition(
            app,
            new_status="SUBMITTED",
            actor=actor_email,
            reason="Student confirmed and submitted application through SCHOLARAi.",
        )
        app.status_reason = (
            f"Application confirmed and submitted by student on {now.strftime('%Y-%m-%d')}. "
            "Internal submission recorded in SCHOLARAi."
        )

        db.commit()
        db.refresh(app)
        return app

    def withdraw_application(
        self,
        db: Session,
        application_id: int,
        user: User,
        student_id: int,
        reason: Optional[str] = None,
    ) -> Application:
        """
        Authorizes student or administrator withdrawal of an application.
        Cannot withdraw an already APPROVED, REJECTED, or WITHDRAWN application.
        """
        app = db.query(Application).filter(Application.id == application_id).first()
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found.",
            )

        user_role = getattr(user, "role", "STUDENT")
        if user_role not in ["ADMIN", "REVIEWER"] and app.student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to withdraw this application.",
            )

        if app.status in ["APPROVED", "REJECTED", "WITHDRAWN"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot withdraw an application that is already {app.status}.",
            )

        withdrawal_reason = reason or "Student explicitly requested application withdrawal."
        self._record_status_transition(
            app,
            new_status="WITHDRAWN",
            actor=user.email,
            reason=withdrawal_reason,
        )
        app.status_reason = f"Application withdrawn. Reason: {withdrawal_reason}"

        db.commit()
        db.refresh(app)
        return app

    def review_application(
        self,
        db: Session,
        application_id: int,
        reviewer_user: User,
        action: str,
        reason: str,
    ) -> Application:
        """
        Authorized administrator or reviewer action.
        Transitions an application to UNDER_REVIEW, APPROVED, or REJECTED.
        Strictly requires REVIEWER or ADMIN role.
        """
        user_role = getattr(reviewer_user, "role", "STUDENT")
        if user_role not in ["REVIEWER", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Authorized reviewer or administrator role required to perform application review.",
            )

        app = db.query(Application).filter(Application.id == application_id).first()
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found.",
            )

        # Unsubmitted applications cannot be reviewed, approved, or rejected
        if app.status in ["NOT_STARTED", "IN_PROGRESS", "READY"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot review an application with status '{app.status}'. "
                    "Only submitted applications can enter review, approval, or rejection."
                ),
            )

        if app.status == "WITHDRAWN":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot review an application that has been withdrawn.",
            )

        action_upper = action.strip().upper()
        now = datetime.now(timezone.utc)

        if action_upper == "UNDER_REVIEW":
            new_status = "UNDER_REVIEW"
            status_desc = f"Application placed UNDER_REVIEW by {reviewer_user.email}. Justification: {reason}"
        elif action_upper == "APPROVE":
            new_status = "APPROVED"
            status_desc = f"Application APPROVED by authority ({reviewer_user.email}). Justification: {reason}"
        elif action_upper == "REJECT":
            new_status = "REJECTED"
            status_desc = f"Application REJECTED by authority ({reviewer_user.email}). Justification: {reason}"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid review action '{action}'. Allowed: UNDER_REVIEW, APPROVE, REJECT.",
            )

        app.reviewed_by = reviewer_user.email
        app.reviewed_at = now
        self._record_status_transition(
            app,
            new_status=new_status,
            actor=reviewer_user.email,
            reason=status_desc,
        )
        app.status_reason = status_desc

        db.commit()
        db.refresh(app)
        return app

    @staticmethod
    def _record_status_transition(
        app: Application,
        new_status: str,
        actor: str,
        reason: str,
    ) -> None:
        """Appends a transition record to the application's immutable status history."""
        prev_status = app.status
        if prev_status == new_status:
            return
        history = list(app.status_history or [])
        history.append({
            "previous_status": prev_status,
            "new_status": new_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor": actor,
            "reason": reason,
        })
        app.status_history = history
        app.status = new_status

    @staticmethod
    def _record_status_event(
        app: Application,
        event_type: str,
        actor: str,
        reason: str,
    ) -> None:
        """Records an audit event without changing current application status."""
        history = list(app.status_history or [])
        history.append({
            "event_type": event_type,
            "current_status": app.status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor": actor,
            "reason": reason,
        })
        app.status_history = history


application_status_service = ApplicationStatusService()
