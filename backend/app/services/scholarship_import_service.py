import logging
import urllib.parse
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.scholarship import Scholarship, KNOWN_FICTIONAL_DEMO_NAMES, RETIRED_DEMO_STATUSES
from app.models.eligibility_rule import EligibilityRule
from app.models.scholarship_requirement import ScholarshipRequirement
from app.models.knowledge import KnowledgeSource, KnowledgeDocument, KnowledgeChunk
from app.models.user import User
from app.schemas.scholarship_import import (
    ScholarshipImportItem,
    ScholarshipImportRequest,
    ScholarshipImportSummary,
    ImportItemResult,
)

logger = logging.getLogger("scholarai.import_pipeline")

# Authoritative government and higher education domains for Tamil Nadu and India
OFFICIAL_GOV_DOMAINS = (
    ".gov.in",
    ".nic.in",
    ".ac.in",
    ".edu.in",
    "sspdept.tnega.org",
    "tneaonline.org",
    "tndce.tn.gov.in",
    "scholarships.gov.in",
    "aicte-india.org",
    "ugc.ac.in",
    "bcmbcmw.tn.gov.in",
    "tamilnadu.gov.in",
    "tn.gov.in",
    ".gov",
)


def is_official_government_source(url: Optional[str]) -> bool:
    """
    Validates whether a source or portal URL belongs to an authoritative government
    or recognized higher-education institution domain.
    """
    if not url:
        return False
    try:
        parsed = urllib.parse.urlparse(url.strip())
        host = (parsed.netloc or "").lower().split(":")[0]
        if not host:
            return False
        for domain in OFFICIAL_GOV_DOMAINS:
            if domain.startswith("."):
                if host.endswith(domain) or host == domain[1:]:
                    return True
            else:
                if host == domain or host.endswith("." + domain):
                    return True
        return False
    except Exception:
        return False


def determine_verification_safeguard(
    item: ScholarshipImportItem,
    has_official_docs: bool = False,
) -> Tuple[str, str, bool, Optional[str]]:
    """
    Enforces project principle: AI assists. Official sources decide. Student approves.

    Safeguard Rules:
    1. An imported scholarship must NEVER be marked SOURCE_VERIFIED simply because it was imported.
    2. SOURCE_VERIFIED is ONLY granted or preserved if the source or guideline URL belongs to an
       authentic government domain (.gov.in, .nic.in, etc.) AND official verification evidence is provided.
    3. If the record claims SOURCE_VERIFIED without an authentic government source, demote to PARTIALLY_VERIFIED
       or NEEDS_VERIFICATION with an explicit unresolved questions note.
    4. Never invent verification timestamps.
    """
    is_official_url = is_official_government_source(item.source_url) or is_official_government_source(item.official_guideline_url)
    official_source_detected = is_official_url or has_official_docs

    claimed_verification = (item.verification_status or "").strip().upper()
    claimed_source_verification = (item.source_verification_status or "").strip().upper()

    warning_note = None

    if claimed_source_verification == "SOURCE_VERIFIED" or claimed_verification == "SOURCE_VERIFIED":
        if not official_source_detected:
            # Overrule and demote: Non-government sources cannot claim SOURCE_VERIFIED
            final_source_verification = "PARTIALLY_VERIFIED"
            final_verification = "PARTIALLY_VERIFIED"
            warning_note = (
                f"Source safeguard warning: Source URL '{item.source_url or item.official_guideline_url}' "
                f"is not a recognized official government/educational domain (.gov.in/.nic.in/.ac.in). "
                f"Demoted from SOURCE_VERIFIED to PARTIALLY_VERIFIED."
            )
            logger.warning(warning_note)
        else:
            final_source_verification = "SOURCE_VERIFIED"
            final_verification = "SOURCE_VERIFIED"
    elif claimed_source_verification:
        final_source_verification = claimed_source_verification
        final_verification = claimed_verification or ("VERIFIED" if official_source_detected else "NEEDS_VERIFICATION")
    else:
        # No verification status specified: default conservatively
        if official_source_detected:
            final_source_verification = "PARTIALLY_VERIFIED"
            final_verification = "NEEDS_VERIFICATION"
        else:
            final_source_verification = "NEEDS_VERIFICATION"
            final_verification = "NEEDS_VERIFICATION"

    return final_verification, final_source_verification, official_source_detected, warning_note


def _sync_knowledge_documents(
    db: Session,
    scholarship: Scholarship,
    item: ScholarshipImportItem,
    official_source_detected: bool,
) -> int:
    """
    Associates authoritative knowledge documents and excerpt chunks with a scholarship.
    Preserves document provenance without fabricating text.
    """
    docs_created = 0
    now = datetime.now(timezone.utc)

    for doc_item in item.knowledge_docs:
        doc_is_official = is_official_government_source(doc_item.source_url)
        authority_level = "OFFICIAL" if doc_is_official else (doc_item.authority_level or "USER_PROVIDED")
        source_type = "OFFICIAL_PORTAL" if doc_is_official else "USER_PROVIDED"
        doc_ver_status = doc_item.verification_status or ("VERIFIED" if doc_is_official else "NEEDS_VERIFICATION")

        # 1. Resolve or create KnowledgeSource
        k_source = db.query(KnowledgeSource).filter(KnowledgeSource.source_url == doc_item.source_url).first()
        if not k_source:
            k_source = KnowledgeSource(
                name=doc_item.title,
                source_url=doc_item.source_url,
                source_type=source_type,
                authority_level=authority_level,
                verification_status=doc_ver_status,
                last_verified_at=now if doc_is_official else None,
            )
            db.add(k_source)
            db.flush()

        # 2. Compute content and hash
        combined_text = doc_item.content or "\n\n".join(c.chunk_text for c in doc_item.chunks)
        content_hash = hashlib.sha256(combined_text.encode("utf-8")).hexdigest()

        # 3. Find existing or create KnowledgeDocument
        k_doc = (
            db.query(KnowledgeDocument)
            .filter(
                KnowledgeDocument.scholarship_id == scholarship.id,
                KnowledgeDocument.source_id == k_source.id,
            )
            .first()
        )

        if not k_doc:
            k_doc = KnowledgeDocument(
                source_id=k_source.id,
                scholarship_id=scholarship.id,
                title=doc_item.title,
                content=combined_text,
                document_url=doc_item.source_url,
                content_hash=content_hash,
                verification_status=doc_ver_status,
                last_verified_at=now if doc_is_official else None,
            )
            db.add(k_doc)
            db.flush()
            docs_created += 1
        else:
            k_doc.title = doc_item.title
            k_doc.content = combined_text
            k_doc.content_hash = content_hash
            k_doc.verification_status = doc_ver_status

        # 4. Attach chunks without duplicating
        existing_chunks = {c.chunk_text.strip() for c in k_doc.chunks}
        for chunk_item in doc_item.chunks:
            if chunk_item.chunk_text.strip() not in existing_chunks:
                chunk = KnowledgeChunk(
                    document_id=k_doc.id,
                    chunk_text=chunk_item.chunk_text,
                    section=chunk_item.section,
                    page_number=chunk_item.page_number,
                    source_url=chunk_item.source_url or doc_item.source_url,
                    metadata_json=chunk_item.metadata_json,
                )
                db.add(chunk)
                existing_chunks.add(chunk_item.chunk_text.strip())

    return docs_created


def _sync_requirements_safely(
    db: Session,
    scholarship: Scholarship,
    item: ScholarshipImportItem,
) -> None:
    """
    Safely reconciles scholarship requirements without breaking existing student applications.
    Matches requirements by document_type or name and updates existing rows in place.
    """
    existing_reqs = {r.name.lower(): r for r in scholarship.requirements}
    existing_by_type = {r.document_type: r for r in scholarship.requirements if r.document_type}

    for req_item in item.requirements:
        matched_req = existing_reqs.get(req_item.name.lower()) or existing_by_type.get(req_item.document_type)
        if matched_req:
            # Update attributes in place to preserve requirement ID and FK relationships
            matched_req.name = req_item.name
            matched_req.document_type = req_item.document_type
            matched_req.type = req_item.type
            matched_req.is_required = req_item.is_required
            if req_item.description:
                matched_req.description = req_item.description
        else:
            # Add new requirement
            new_req = ScholarshipRequirement(
                scholarship_id=scholarship.id,
                name=req_item.name,
                document_type=req_item.document_type,
                type=req_item.type,
                is_required=req_item.is_required,
                description=req_item.description,
            )
            db.add(new_req)


def _sync_rules_safely(
    db: Session,
    scholarship: Scholarship,
    item: ScholarshipImportItem,
) -> None:
    """Reconciles eligibility rules for a scholarship."""
    existing_rules = {r.rule_type: r for r in scholarship.eligibility_rules}

    for rule_item in item.eligibility_rules:
        matched_rule = existing_rules.get(rule_item.rule_type)
        if matched_rule:
            matched_rule.criteria_value = rule_item.criteria_value
            matched_rule.operator = rule_item.operator
            matched_rule.description = rule_item.description or f"{rule_item.rule_type} {rule_item.operator} {rule_item.criteria_value}"
            matched_rule.is_mandatory = rule_item.is_mandatory
        else:
            new_rule = EligibilityRule(
                scholarship_id=scholarship.id,
                rule_type=rule_item.rule_type,
                criteria_value=rule_item.criteria_value,
                operator=rule_item.operator,
                description=rule_item.description or f"{rule_item.rule_type} {rule_item.operator} {rule_item.criteria_value}",
                is_mandatory=rule_item.is_mandatory,
            )
            db.add(new_rule)


class ScholarshipImportService:
    """
    Service for importing and refreshing scholarship catalogue records.
    Provides validation, idempotency, foreign-key safety, official source detection,
    and verification safeguards.
    """

    def process_import(
        self,
        db: Session,
        request: ScholarshipImportRequest,
        admin_user: Optional[User] = None,
    ) -> ScholarshipImportSummary:
        total = len(request.items)
        created_count = 0
        updated_count = 0
        skipped_count = 0
        rejected_count = 0
        summary_errors: List[str] = []
        item_results: List[ImportItemResult] = []

        now = datetime.now(timezone.utc)

        for idx, item in enumerate(request.items, start=1):
            item_errors: List[str] = []

            # 1. Validation checks
            if not item.name or not item.name.strip():
                item_errors.append("Scholarship name cannot be empty.")
            if not item.provider or not item.provider.strip():
                item_errors.append("Scholarship provider cannot be empty.")
            if item.amount < 0:
                item_errors.append("Amount cannot be negative.")
            if not item.deadline:
                item_errors.append("Application deadline is required.")

            if item_errors:
                rejected_count += 1
                msg = f"Item {idx} ('{item.name or 'Unknown'}'): " + "; ".join(item_errors)
                summary_errors.append(msg)
                item_results.append(
                    ImportItemResult(
                        index=idx,
                        name=item.name or f"Item #{idx}",
                        dossier_index=item.dossier_index,
                        action="REJECTED",
                        status="ERROR",
                        details="Validation failed: " + "; ".join(item_errors),
                        errors=item_errors,
                    )
                )
                continue

            # 2. Check for official source & verification safeguards
            has_docs = bool(item.knowledge_docs)
            final_ver, final_src_ver, official_detected, warn_note = determine_verification_safeguard(item, has_docs)

            # Explicit Demo Record Safeguard: Reject importing or re-activating known retired demo records
            clean_name = item.name.strip()
            is_demo_claim = (
                clean_name in KNOWN_FICTIONAL_DEMO_NAMES
                or (item.provider and "(Demo)" in item.provider)
                or (item.verification_status and item.verification_status.strip().upper() in RETIRED_DEMO_STATUSES)
            )
            if is_demo_claim and not official_detected:
                rejected_count += 1
                msg = f"Item {idx} ('{clean_name}'): Cannot import or re-activate demonstration scholarship names without verified statutory government evidence."
                summary_errors.append(msg)
                item_results.append(
                    ImportItemResult(
                        index=idx,
                        name=clean_name,
                        dossier_index=item.dossier_index,
                        action="REJECTED",
                        status="ERROR",
                        details=msg,
                        errors=[msg],
                    )
                )
                continue

            # 3. Locate existing scholarship by stable identifier (dossier_index or name)
            existing: Optional[Scholarship] = None
            if item.dossier_index and item.dossier_index.strip():
                existing = db.query(Scholarship).filter(Scholarship.dossier_index == item.dossier_index.strip()).first()
            if not existing and item.name:
                existing = db.query(Scholarship).filter(func.lower(Scholarship.name) == item.name.strip().lower()).first()

            # 4. Handle Dry Run mode
            if request.dry_run:
                if existing:
                    updated_count += 1
                    preview_details = (
                        f"Would update existing scholarship ID {existing.id} ('{existing.name}'). "
                        f"Existing student applications ({len(existing.applications)}) preserved. "
                        f"Verification: {final_src_ver}."
                    )
                    if warn_note:
                        preview_details += f" Note: {warn_note}"
                    item_results.append(
                        ImportItemResult(
                            index=idx,
                            name=item.name,
                            dossier_index=item.dossier_index or existing.dossier_index,
                            action="WOULD_UPDATE",
                            status="WARNING" if warn_note else "SUCCESS",
                            details=preview_details,
                            source_verification_applied=final_src_ver,
                            official_source_detected=official_detected,
                        )
                    )
                else:
                    created_count += 1
                    preview_details = (
                        f"Would create new scholarship '{item.name}'. "
                        f"Verification: {final_src_ver}. Rules: {len(item.eligibility_rules)}, "
                        f"Requirements: {len(item.requirements)}, Documents: {len(item.knowledge_docs)}."
                    )
                    if warn_note:
                        preview_details += f" Note: {warn_note}"
                    item_results.append(
                        ImportItemResult(
                            index=idx,
                            name=item.name,
                            dossier_index=item.dossier_index,
                            action="WOULD_CREATE",
                            status="WARNING" if warn_note else "SUCCESS",
                            details=preview_details,
                            source_verification_applied=final_src_ver,
                            official_source_detected=official_detected,
                        )
                    )
                continue

            # 5. Execute Non-Dry-Run (Persistence)
            try:
                if existing:
                    # Idempotent update in place
                    existing.name = item.name
                    existing.provider = item.provider
                    existing.description = item.description
                    existing.amount = item.amount
                    existing.currency = item.currency
                    existing.deadline = item.deadline
                    existing.application_url = item.application_url or existing.application_url
                    existing.source_url = item.source_url or existing.source_url
                    existing.source_name = item.source_name or existing.source_name
                    existing.verification_status = final_ver
                    existing.source_verification_status = final_src_ver

                    # Only set last_verified_at if explicitly supplied in item; do not fabricate dates
                    if item.last_verified_at:
                        existing.last_verified_at = item.last_verified_at

                    existing.eligibility_summary = item.eligibility_summary or existing.eligibility_summary
                    existing.application_effort = item.application_effort or existing.application_effort
                    existing.status = item.status or existing.status

                    if item.dossier_index:
                        existing.dossier_index = item.dossier_index
                    existing.stream = item.stream or existing.stream
                    existing.study_level = item.study_level or existing.study_level
                    existing.category_tag = item.category_tag or existing.category_tag
                    existing.institution_types = item.institution_types or existing.institution_types
                    existing.autonomous_compatibility = item.autonomous_compatibility or existing.autonomous_compatibility
                    existing.tn_residency_required = "YES" if item.tn_residency_required else "NO"
                    existing.community_category = item.community_category or existing.community_category
                    existing.income_ceiling = item.income_ceiling if item.income_ceiling is not None else existing.income_ceiling
                    existing.income_criteria_raw = item.income_criteria_raw or existing.income_criteria_raw
                    existing.award_type = item.award_type or existing.award_type
                    existing.award_display = item.award_display or existing.award_display
                    existing.official_portal_name = item.official_portal_name or existing.official_portal_name
                    existing.official_guideline_url = item.official_guideline_url or existing.official_guideline_url
                    existing.academic_year = item.academic_year or existing.academic_year
                    existing.application_window_status = item.application_window_status or existing.application_window_status

                    if warn_note:
                        existing.unresolved_questions = (existing.unresolved_questions or "") + f" [Import Warning: {warn_note}]"
                    elif item.unresolved_questions:
                        existing.unresolved_questions = item.unresolved_questions

                    existing.updated_at = now

                    # Sync requirements and rules safely
                    if item.requirements:
                        _sync_requirements_safely(db, existing, item)
                    if item.eligibility_rules:
                        _sync_rules_safely(db, existing, item)
                    if item.knowledge_docs:
                        _sync_knowledge_documents(db, existing, item, official_detected)

                    db.flush()
                    updated_count += 1

                    update_details = (
                        f"Updated existing scholarship ID {existing.id}. "
                        f"Preserved {len(existing.applications)} existing student application(s)."
                    )
                    if warn_note:
                        update_details += f" ({warn_note})"

                    item_results.append(
                        ImportItemResult(
                            index=idx,
                            name=item.name,
                            dossier_index=existing.dossier_index,
                            action="UPDATED",
                            status="WARNING" if warn_note else "SUCCESS",
                            details=update_details,
                            source_verification_applied=final_src_ver,
                            official_source_detected=official_detected,
                        )
                    )
                else:
                    # Create new scholarship
                    new_sch = Scholarship(
                        name=item.name,
                        provider=item.provider,
                        description=item.description,
                        amount=item.amount,
                        currency=item.currency,
                        deadline=item.deadline,
                        application_url=item.application_url,
                        source_url=item.source_url,
                        source_name=item.source_name or item.provider,
                        verification_status=final_ver,
                        source_verification_status=final_src_ver,
                        last_verified_at=item.last_verified_at,  # None unless explicitly supplied
                        eligibility_summary=item.eligibility_summary,
                        application_effort=item.application_effort or "Medium (3-5 hrs)",
                        status=item.status or "ACTIVE",
                        dossier_index=item.dossier_index,
                        stream=item.stream or "BOTH",
                        study_level=item.study_level or "BOTH",
                        category_tag=item.category_tag or "GOVERNMENT",
                        institution_types=item.institution_types,
                        autonomous_compatibility=item.autonomous_compatibility,
                        tn_residency_required="YES" if item.tn_residency_required else "NO",
                        community_category=item.community_category or "ALL",
                        income_ceiling=item.income_ceiling,
                        income_criteria_raw=item.income_criteria_raw,
                        award_type=item.award_type or "VARIABLE_ASSISTANCE",
                        award_display=item.award_display,
                        official_portal_name=item.official_portal_name,
                        official_guideline_url=item.official_guideline_url,
                        academic_year=item.academic_year or "2024-2025 / 2025-2026",
                        application_window_status=item.application_window_status or "OPEN",
                        unresolved_questions=warn_note or item.unresolved_questions,
                    )
                    db.add(new_sch)
                    db.flush()

                    for r in item.eligibility_rules:
                        db.add(
                            EligibilityRule(
                                scholarship_id=new_sch.id,
                                rule_type=r.rule_type,
                                criteria_value=r.criteria_value,
                                operator=r.operator,
                                description=r.description or f"{r.rule_type} {r.operator} {r.criteria_value}",
                                is_mandatory=r.is_mandatory,
                            )
                        )

                    for req in item.requirements:
                        db.add(
                            ScholarshipRequirement(
                                scholarship_id=new_sch.id,
                                name=req.name,
                                document_type=req.document_type,
                                type=req.type,
                                is_required=req.is_required,
                                description=req.description,
                            )
                        )

                    if item.knowledge_docs:
                        _sync_knowledge_documents(db, new_sch, item, official_detected)

                    db.flush()
                    created_count += 1

                    create_details = f"Created new scholarship ID {new_sch.id} with status {final_src_ver}."
                    if warn_note:
                        create_details += f" ({warn_note})"

                    item_results.append(
                        ImportItemResult(
                            index=idx,
                            name=item.name,
                            dossier_index=item.dossier_index,
                            action="CREATED",
                            status="WARNING" if warn_note else "SUCCESS",
                            details=create_details,
                            source_verification_applied=final_src_ver,
                            official_source_detected=official_detected,
                        )
                    )
            except Exception as e:
                db.rollback()
                logger.error(f"Error persisting item {idx} ('{item.name}'): {e}", exc_info=True)
                rejected_count += 1
                err_msg = f"Database error for '{item.name}': {str(e)}"
                summary_errors.append(err_msg)
                item_results.append(
                    ImportItemResult(
                        index=idx,
                        name=item.name,
                        dossier_index=item.dossier_index,
                        action="REJECTED",
                        status="ERROR",
                        details=err_msg,
                        errors=[str(e)],
                    )
                )

        if not request.dry_run and (created_count > 0 or updated_count > 0):
            try:
                db.commit()
                logger.info(
                    f"Scholarship import committed: created={created_count}, "
                    f"updated={updated_count}, rejected={rejected_count}."
                )
            except Exception as commit_err:
                db.rollback()
                logger.error(f"Commit failed for scholarship import: {commit_err}")
                summary_errors.append(f"Transaction commit failed: {str(commit_err)}")
        else:
            db.rollback()

        return ScholarshipImportSummary(
            total=total,
            created=created_count,
            updated=updated_count,
            skipped=skipped_count,
            rejected=rejected_count,
            dry_run=request.dry_run,
            errors=summary_errors,
            items=item_results,
        )


scholarship_import_service = ScholarshipImportService()
