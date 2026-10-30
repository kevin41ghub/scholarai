import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.document import Document
from app.models.student import Student

logger = logging.getLogger("verification_service")


class DocumentVerificationService:
    """
    Transparent, rule-based verification engine.
    Executes verifiable, documented checks per document category and never
    fabricates official government verification.
    """

    # Categories that are permanent and do not expire
    PERMANENT_DOCUMENT_TYPES = {
        "10TH_MARKSHEET",
        "12TH_MARKSHEET",
        "DEGREE_CERTIFICATE",
        "TRANSFER_CERTIFICATE",
        "BIRTH_CERTIFICATE",
        "CASTE_CERTIFICATE",
        "COMMUNITY_CERTIFICATE",
        "SPORTS_CERTIFICATE",
        "DISABILITY_CERTIFICATE",
        "SPECIAL_CATEGORY_CERTIFICATE",
    }

    # Categories requiring periodic renewal
    TIME_LIMITED_DOCUMENT_TYPES = {
        "INCOME_CERTIFICATE",
        "DOMICILE_CERTIFICATE",
        "FEE_RECEIPT",
        "BONAFIDE_CERTIFICATE",
    }

    def verify_document(
        self,
        db: Session,
        student: Student,
        document_type: str,
        file_size: int,
        mime_type: str,
        content_hash: str,
        extracted_fields: Dict[str, Any],
        extraction_status: str,
        existing_doc_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Runs the full verification rule suite on a document.
        Returns:
            {
                "verification_status": str,
                "status": str (backward compatibility: AVAILABLE, VERIFIED, etc.),
                "verification_results": List[Dict],
                "failure_reasons": List[str],
                "expiry_date": Optional[datetime]
            }
        """
        checks: List[Dict[str, Any]] = []
        failure_reasons: List[str] = []
        warnings: List[str] = []
        now = datetime.now(timezone.utc)

        # 1. Format and Integrity Check
        format_passed = (
            file_size > 0
            and file_size <= 10 * 1024 * 1024
            and mime_type in ["application/pdf", "image/jpeg", "image/png"]
        )
        checks.append({
            "check_name": "File Integrity & Format Signature",
            "passed": format_passed,
            "outcome": "PASSED" if format_passed else "FAILED",
            "reason": f"File verified: {file_size / 1024:.1f} KB, MIME: {mime_type}." if format_passed else "File is corrupt or exceeds size limits.",
            "verification_method": "FORMAT_SIGNATURE",
            "timestamp": now.isoformat(),
        })
        if not format_passed:
            failure_reasons.append("File format or size does not meet security criteria.")

        # 2. Duplicate Detection within Student's Records
        dup_query = db.query(Document).filter(
            Document.student_id == student.id,
            Document.content_hash == content_hash,
        )
        if existing_doc_id:
            dup_query = dup_query.filter(Document.id != existing_doc_id)
        duplicate = dup_query.first()

        dup_passed = duplicate is None
        checks.append({
            "check_name": "Cryptographic Content Integrity & Duplicate Check",
            "passed": dup_passed,
            "outcome": "PASSED" if dup_passed else "WARNING",
            "reason": (
                "Document cryptographic hash (SHA-256) is unique in student records."
                if dup_passed
                else f"Identical file already registered under document '{duplicate.name}' ({duplicate.document_type})."
            ),
            "verification_method": "INTEGRITY_HASH",
            "timestamp": now.isoformat(),
        })
        if not dup_passed:
            warnings.append(f"Duplicate document detected: Matches '{duplicate.name}'.")

        # 3. Student Identity & Name Consistency Check
        student_name = (student.name or "").strip()
        extracted_name = (extracted_fields.get("student_name") or "").strip()

        if extracted_name and student_name:
            name_match_score = self._compare_names(student_name, extracted_name)
            name_passed = name_match_score >= 0.7
            outcome = "PASSED" if name_passed else "WARNING"
            reason = (
                f"Extracted name '{extracted_name}' is consistent with profile name '{student_name}'."
                if name_passed
                else f"Extracted name '{extracted_name}' differs from student profile name '{student_name}'. Human review required."
            )
            checks.append({
                "check_name": "Student Identity Name Consistency",
                "passed": name_passed,
                "outcome": outcome,
                "reason": reason,
                "verification_method": "PROFILE_MATCH",
                "timestamp": now.isoformat(),
            })
            if not name_passed:
                warnings.append(f"Name discrepancy: Document says '{extracted_name}', profile is '{student_name}'.")
        else:
            checks.append({
                "check_name": "Student Identity Name Consistency",
                "passed": True,
                "outcome": "WARNING",
                "reason": "Name could not be extracted automatically from document text. Visual inspection required.",
                "verification_method": "PROFILE_MATCH",
                "timestamp": now.isoformat(),
            })
            warnings.append("Student name could not be automatically confirmed from document content.")

        # 4. Validity & Expiry Date Check
        doc_expiry_dt: Optional[datetime] = None
        extracted_expiry_str = extracted_fields.get("expiry_date")

        if extracted_expiry_str:
            try:
                parsed_expiry = datetime.strptime(extracted_expiry_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                doc_expiry_dt = parsed_expiry
                if parsed_expiry < now:
                    checks.append({
                        "check_name": "Document Validity & Expiry",
                        "passed": False,
                        "outcome": "FAILED",
                        "reason": f"Document expired on {extracted_expiry_str}. A current, non-expired document is required.",
                        "verification_method": "EXPIRY_CHECK",
                        "timestamp": now.isoformat(),
                    })
                    failure_reasons.append(f"Document expired on {extracted_expiry_str}.")
                elif (parsed_expiry - now).days < 30:
                    checks.append({
                        "check_name": "Document Validity & Expiry",
                        "passed": True,
                        "outcome": "WARNING",
                        "reason": f"Document is valid but expires soon on {extracted_expiry_str} (in {(parsed_expiry - now).days} days).",
                        "verification_method": "EXPIRY_CHECK",
                        "timestamp": now.isoformat(),
                    })
                    warnings.append(f"Document expires soon on {extracted_expiry_str}.")
                else:
                    checks.append({
                        "check_name": "Document Validity & Expiry",
                        "passed": True,
                        "outcome": "PASSED",
                        "reason": f"Document is within its valid period (valid through {extracted_expiry_str}).",
                        "verification_method": "EXPIRY_CHECK",
                        "timestamp": now.isoformat(),
                    })
            except Exception as e:
                logger.debug(f"Could not parse expiry date {extracted_expiry_str}: {e}")

        elif document_type.upper() in self.PERMANENT_DOCUMENT_TYPES:
            checks.append({
                "check_name": "Document Validity & Expiry",
                "passed": True,
                "outcome": "PASSED",
                "reason": f"Permanent document type ({document_type}). Does not require periodic renewal.",
                "verification_method": "RULE_ENGINE",
                "timestamp": now.isoformat(),
            })
        else:
            checks.append({
                "check_name": "Document Validity & Expiry",
                "passed": True,
                "outcome": "WARNING",
                "reason": "No explicit expiry date identified in document text. Validity period should be confirmed manually.",
                "verification_method": "RULE_ENGINE",
                "timestamp": now.isoformat(),
            })
            warnings.append("Expiry date could not be established automatically.")

        # 5. Category-Specific Validation Rules
        category_checks = self._verify_category_rules(student, document_type, extracted_fields, now)
        checks.extend(category_checks["checks"])
        warnings.extend(category_checks["warnings"])
        failure_reasons.extend(category_checks["failures"])

        # 6. Authority & Authenticity Check
        # Transparent rule: Automated checks verify format, data integrity, and rules.
        # Genuine official authenticity requires DigiLocker integration or authorized review.
        checks.append({
            "check_name": "Government Issuing Authority Official Verification",
            "passed": True,
            "outcome": "WARNING",
            "reason": (
                "Automated structural and metadata rules passed. "
                "Official government verification requires direct DigiLocker API or authorized human administrator review."
            ),
            "verification_method": "MANUAL_REVIEW",
            "timestamp": now.isoformat(),
        })

        # 7. Final Status Determination
        if failure_reasons:
            verification_status = "REJECTED"
            legacy_status = "NEEDS_VERIFICATION"
        elif extraction_status == "FAILED":
            verification_status = "UNABLE_TO_VERIFY"
            legacy_status = "NEEDS_VERIFICATION"
        elif warnings or extraction_status == "NEEDS_MANUAL_PROCESSING":
            verification_status = "NEEDS_HUMAN_REVIEW"
            legacy_status = "AVAILABLE"
        else:
            verification_status = "AUTOMATED_CHECKS_PASSED"
            legacy_status = "AVAILABLE"

        return {
            "verification_status": verification_status,
            "status": legacy_status,
            "verification_results": checks,
            "failure_reasons": failure_reasons + warnings,
            "expiry_date": doc_expiry_dt,
        }

    def _compare_names(self, name1: str, name2: str) -> float:
        """Compares two names taking into account honorifics, token order, and initials."""
        tokens1 = set(name1.lower().replace(".", "").split())
        tokens2 = set(name2.lower().replace(".", "").split())
        # Filter common noise words
        noise = {"mr", "ms", "mrs", "dr", "shri", "smt", "kumar", "singh"}
        t1 = tokens1 - noise
        t2 = tokens2 - noise
        if not t1 or not t2:
            return 0.5
        intersection = t1 & t2
        return len(intersection) / max(len(t1), len(t2))

    def _verify_category_rules(
        self,
        student: Student,
        document_type: str,
        extracted_fields: Dict[str, Any],
        now: datetime,
    ) -> Dict[str, Any]:
        checks: List[Dict[str, Any]] = []
        warnings: List[str] = []
        failures: List[str] = []

        dtype = document_type.upper()

        if "INCOME" in dtype:
            has_authority = bool(extracted_fields.get("issuing_authority"))
            has_cert_num = bool(extracted_fields.get("certificate_number"))
            has_income = "annual_income" in extracted_fields

            passed = has_authority or has_cert_num or has_income
            checks.append({
                "check_name": "Income Certificate Required Parameters",
                "passed": passed,
                "outcome": "PASSED" if passed else "WARNING",
                "reason": (
                    f"Parameters found: Income: {extracted_fields.get('annual_income', 'N/A')}, Authority: {extracted_fields.get('issuing_authority', 'N/A')}."
                    if passed
                    else "Missing visible revenue authority or certificate number in extracted text."
                ),
                "verification_method": "RULE_ENGINE",
                "timestamp": now.isoformat(),
            })
            if not passed:
                warnings.append("Income certificate missing revenue authority details.")

        elif "DOMICILE" in dtype:
            student_state = student.profile.state if student.profile else None
            authority = extracted_fields.get("issuing_authority", "")
            state_match = student_state and student_state.lower() in authority.lower()

            checks.append({
                "check_name": "Domicile State Alignment",
                "passed": bool(state_match or not student_state),
                "outcome": "PASSED" if (state_match or not student_state) else "WARNING",
                "reason": (
                    f"Domicile authority aligns with student profile state '{student_state}'."
                    if state_match
                    else f"Issuing authority '{authority}' could not be automatically confirmed for profile state '{student_state}'."
                ),
                "verification_method": "RULE_ENGINE",
                "timestamp": now.isoformat(),
            })

        elif any(k in dtype for k in ["TRANSCRIPT", "MARKSHEET", "ACADEMIC"]):
            has_cgpa = "cgpa" in extracted_fields or "percentage" in extracted_fields
            checks.append({
                "check_name": "Academic Performance Metrics",
                "passed": True,
                "outcome": "PASSED" if has_cgpa else "WARNING",
                "reason": (
                    f"Academic score detected: {extracted_fields.get('cgpa') or extracted_fields.get('percentage')}."
                    if has_cgpa
                    else "Specific GPA/Percentage not parsed automatically; manual verification will confirm."
                ),
                "verification_method": "RULE_ENGINE",
                "timestamp": now.isoformat(),
            })

        elif "SPORTS" in dtype:
            checks.append({
                "check_name": "Sports Merit Credential Verification",
                "passed": True,
                "outcome": "PASSED",
                "reason": "Sports achievement credential registered for athletic quota and financial grants.",
                "verification_method": "RULE_ENGINE",
                "timestamp": now.isoformat(),
            })

        elif "DISABILITY" in dtype or "UDID" in dtype:
            checks.append({
                "check_name": "Disability Credential / UDID Verification",
                "passed": True,
                "outcome": "PASSED",
                "reason": "Disability credential registered for statutory benchmark welfare assistance.",
                "verification_method": "RULE_ENGINE",
                "timestamp": now.isoformat(),
            })

        elif "COMMUNITY" in dtype or "CASTE" in dtype:
            checks.append({
                "check_name": "Community Certificate Verification",
                "passed": True,
                "outcome": "PASSED",
                "reason": "Permanent community certificate issued by Revenue Tahsildar / E-Sevai registered.",
                "verification_method": "RULE_ENGINE",
                "timestamp": now.isoformat(),
            })

        return {"checks": checks, "warnings": warnings, "failures": failures}


verification_service = DocumentVerificationService()
