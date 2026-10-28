#!/usr/bin/env python3
"""
SCHOLARAi - Official Scholarship Import and Refresh Utility
Script: scripts/import_verified_scholarships.py

Principle: AI assists. Official sources decide. Student approves.

Supports importing structured scholarship records from JSON or CSV files into the
SCHOLARAi catalogue with:
- Full schema validation against ScholarshipImportItem
- Idempotent creation and updating by stable identifiers (dossier_index or name)
- Preservation of historical student applications and foreign-key integrity
- Official government domain validation (.gov.in, .nic.in, .ac.in, etc.)
- Source verification safeguards preventing non-government sources from claiming SOURCE_VERIFIED
- Comprehensive Dry-Run simulation mode
"""

import os
import sys
import json
import csv
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

# Ensure backend root is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Initialize database session and services
from pydantic import ValidationError
from app.db.session import SessionLocal
from app.models.user import User
from app.schemas.scholarship_import import (
    ScholarshipImportItem,
    ScholarshipImportRequest,
    ScholarshipImportSummary,
    ScholarshipRuleImport,
    ScholarshipRequirementImport,
    ScholarshipKnowledgeDocImport,
    ScholarshipKnowledgeChunkImport,
)
from app.services.scholarship_import_service import (
    scholarship_import_service,
    is_official_government_source,
)


def parse_rules_from_str(rules_str: str) -> List[Dict[str, Any]]:
    """
    Parse rules from CSV string format:
    'ANNUAL_INCOME:LTE:250000;CATEGORY:IN:SC,ST,SCA;RESIDENCY:EQ:Tamil Nadu'
    """
    if not rules_str or not rules_str.strip():
        return []
    rules = []
    for item in rules_str.strip().split(";"):
        parts = [p.strip() for p in item.split(":", 2)]
        if len(parts) >= 2:
            rule_type = parts[0]
            operator = "EQ"
            criteria_value = parts[1]
            if len(parts) == 3:
                operator = parts[1]
                criteria_value = parts[2]
            rules.append({
                "rule_type": rule_type,
                "operator": operator,
                "criteria_value": criteria_value,
                "is_mandatory": True,
            })
    return rules


def parse_requirements_from_str(reqs_str: str) -> List[Dict[str, Any]]:
    """
    Parse requirements from CSV string format:
    'Community Certificate:COMMUNITY_CERTIFICATE;Income Certificate:INCOME_CERTIFICATE'
    """
    if not reqs_str or not reqs_str.strip():
        return []
    reqs = []
    for item in reqs_str.strip().split(";"):
        parts = [p.strip() for p in item.split(":", 1)]
        name = parts[0]
        doc_type = parts[1] if len(parts) > 1 else "OTHER"
        reqs.append({
            "name": name,
            "document_type": doc_type,
            "type": "DOCUMENT",
            "is_required": True,
        })
    return reqs


def load_records_from_csv(file_path: Path) -> List[Dict[str, Any]]:
    """Reads CSV file and converts rows into raw scholarship dictionaries."""
    records = []
    with open(file_path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cleaned = {k.strip(): v.strip() for k, v in row.items() if k}

            # Type conversions
            raw_amount = cleaned.get("amount", "0")
            cleaned["amount"] = float(raw_amount) if raw_amount else 0.0

            raw_ceiling = cleaned.get("income_ceiling")
            if raw_ceiling:
                cleaned["income_ceiling"] = float(raw_ceiling)
            else:
                cleaned["income_ceiling"] = None

            raw_residency = cleaned.get("tn_residency_required", "True").lower()
            cleaned["tn_residency_required"] = raw_residency in ["true", "1", "yes"]

            # Parse embedded rules and requirements if present
            if "rules" in cleaned:
                cleaned["eligibility_rules"] = parse_rules_from_str(cleaned.pop("rules"))
            if "requirements" in cleaned:
                cleaned["requirements"] = parse_requirements_from_str(cleaned.pop("requirements"))

            records.append(cleaned)
    return records


def load_records_from_json(file_path: Path) -> List[Dict[str, Any]]:
    """Reads JSON file (list of records or dict with 'scholarships'/'items' key)."""
    with open(file_path, mode="r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    elif isinstance(data, dict):
        if "scholarships" in data and isinstance(data["scholarships"], list):
            return data["scholarships"]
        elif "items" in data and isinstance(data["items"], list):
            return data["items"]
        else:
            return [data]
    else:
        raise ValueError("JSON file must contain an array or an object with 'scholarships' list.")


def load_and_validate_records(file_path: Path) -> Tuple[List[ScholarshipImportItem], List[str]]:
    """
    Parses file into raw records and validates each item using ScholarshipImportItem.
    Collects validation errors per item.
    """
    ext = file_path.suffix.lower()
    if ext == ".csv":
        raw_items = load_records_from_csv(file_path)
    elif ext == ".json":
        raw_items = load_records_from_json(file_path)
    else:
        raise ValueError(f"Unsupported file format '{ext}'. Must be .json or .csv.")

    validated_items: List[ScholarshipImportItem] = []
    errors: List[str] = []

    for idx, raw in enumerate(raw_items, start=1):
        name_hint = raw.get("name") or f"Record #{idx}"
        try:
            item = ScholarshipImportItem.model_validate(raw)
            validated_items.append(item)
        except ValidationError as val_err:
            for err in val_err.errors():
                loc = ".".join(str(p) for p in err["loc"])
                msg = f"Item #{idx} ('{name_hint}') - Field '{loc}': {err['msg']}"
                errors.append(msg)
        except Exception as ex:
            errors.append(f"Item #{idx} ('{name_hint}'): {str(ex)}")

    return validated_items, errors


def print_cli_summary(summary: ScholarshipImportSummary, file_path: Path) -> None:
    """Prints a beautiful, clean summary table to stdout."""
    mode_text = "[DRY-RUN PREVIEW - NO CHANGES SAVED]" if summary.dry_run else "[LIVE IMPORT - COMMITTED TO DATABASE]"
    divider = "=" * 80

    print("\n" + divider)
    print(f" SCHOLARAi Scholarship Import & Refresh Pipeline")
    print(f" Source File : {file_path.name}")
    print(f" Pipeline Mode: {mode_text}")
    print(divider)

    print(f"\nItemized Status:")
    for item in summary.items:
        prefix = "[OK]" if item.status == "SUCCESS" else ("[WARN]" if item.status == "WARNING" else "[ERR]")
        action_display = f"[{item.action}]".ljust(15)
        gov_source = "[Official Gov Domain]" if item.official_source_detected else "[Non-Gov / External]"
        ver_tag = f"[{item.source_verification_applied}]" if item.source_verification_applied else ""

        print(f" {prefix} #{item.index} {action_display} {item.name}")
        print(f"     Source : {gov_source} {ver_tag}")
        if item.details:
            print(f"     Details: {item.details}")
        if item.errors:
            for err in item.errors:
                print(f"     Error  : {err}")


    if summary.errors:
        print(f"\nValidation & Rejection Notices ({len(summary.errors)}):")
        for err in summary.errors:
            print(f"  • {err}")

    print("\n" + "-" * 80)
    print(f" Summary: Total={summary.total} | Created={summary.created} | Updated={summary.updated} | Skipped={summary.skipped} | Rejected={summary.rejected}")
    print(divider + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="SCHOLARAi Secure Scholarship Import & Refresh CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry-run validation of a JSON file:
  python scripts/import_verified_scholarships.py --file data/tn_scholarships.json --dry-run

  # Live import of verified scholarships from CSV:
  python scripts/import_verified_scholarships.py --file data/schemes.csv

  # Admin-authenticated import:
  python scripts/import_verified_scholarships.py --file data/schemes.json --admin-email admin@scholarai.local
        """
    )
    parser.add_argument(
        "-f", "--file",
        required=True,
        type=str,
        help="Path to JSON or CSV file containing scholarship records",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Simulate the import and preview additions/updates without modifying the database",
    )
    parser.add_argument(
        "--admin-email",
        type=str,
        default=None,
        help="Optional email of administrator executing the import (verifies role == 'ADMIN')",
    )

    args = parser.parse_args()
    file_path = Path(args.file)

    if not file_path.is_file():
        print(f"Error: Specified file does not exist: {file_path}", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    admin_user = None

    try:
        if args.admin_email:
            admin_user = db.query(User).filter(User.email == args.admin_email.strip().lower()).first()
            if not admin_user:
                print(f"Error: User '{args.admin_email}' not found in database.", file=sys.stderr)
                sys.exit(1)
            if admin_user.role != "ADMIN":
                print(
                    f"Forbidden: User '{args.admin_email}' has role '{admin_user.role}', "
                    f"which lacks administrative privileges (requires 'ADMIN').",
                    file=sys.stderr
                )
                sys.exit(1)

        print(f"Reading and validating records from {file_path}...")
        validated_items, validation_errors = load_and_validate_records(file_path)

        if not validated_items and validation_errors:
            print("\nError: All records failed initial Pydantic schema validation:", file=sys.stderr)
            for err in validation_errors:
                print(f"  • {err}", file=sys.stderr)
            sys.exit(1)

        request = ScholarshipImportRequest(
            items=validated_items,
            dry_run=args.dry_run,
        )

        summary = scholarship_import_service.process_import(
            db=db,
            request=request,
            admin_user=admin_user,
        )

        # Append schema validation errors to summary if any items were skipped
        if validation_errors:
            summary.total += len(validation_errors)
            summary.rejected += len(validation_errors)
            summary.errors.extend(validation_errors)

        print_cli_summary(summary, file_path)

        if summary.rejected > 0 and summary.created == 0 and summary.updated == 0:
            sys.exit(1)
        sys.exit(0)

    except Exception as e:
        print(f"\nFatal error during import: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
