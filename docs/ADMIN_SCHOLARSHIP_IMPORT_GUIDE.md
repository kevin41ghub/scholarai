# SCHOLARAi - Official Scholarship Import & Refresh Pipeline Guide

> **Core Platform Principle**: *AI assists. Official sources decide. Student approves.*

This guide explains how authorized system administrators and state welfare officers can import, update, and refresh scholarship records in SCHOLARAi using the secure command-line utility or the authenticated administrative REST API.

---

## 1. Architectural Safeguards & Design Principles

The Scholarship Import and Refresh Pipeline enforces strict platform invariants:

1. **Role-Based Access Control (RBAC)**:
   - Only authenticated users with `role == "ADMIN"` can invoke the catalogue import endpoints.
   - Ordinary students (`role == "STUDENT"`) are strictly denied with `HTTP 403 Forbidden`.
   - Public unauthenticated access is rejected with `HTTP 401 Unauthorized`.

2. **Idempotency & Historical Data Safety**:
   - Matches records using stable identifiers: first by `dossier_index` (e.g., `№ TN-ADW-2025-01`), then by exact scheme title.
   - Updates existing records **in place** without deleting rows or altering primary keys.
   - Preserves all active and historical student `Application` records, submitted documents, and requirements without data loss or foreign-key violations.

3. **Official Government Source Detection**:
   - Automatically inspects `source_url`, `official_guideline_url`, and `application_url`.
   - Validates authoritative domains: `.gov.in`, `.nic.in`, `.ac.in`, `.edu.in`, `sspdept.tnega.org`, `tneaonline.org`, `tndce.tn.gov.in`, `scholarships.gov.in`, etc.

4. **Source Verification Safeguards**:
   - A scholarship is **never marked `SOURCE_VERIFIED` simply because it was imported**.
   - If an import payload claims `SOURCE_VERIFIED` without an authentic government source URL or authoritative dossier evidence, the pipeline automatically demotes it to `PARTIALLY_VERIFIED` and logs a warning in `unresolved_questions`.
   - Verification dates are never fabricated; `last_verified_at` is only populated when genuine verification metadata is supplied.

5. **Authoritative Knowledge & Excerpt Chunks**:
   - When official guidelines or Government Orders (G.O.) are supplied, they are stored in `KnowledgeDocument` with SHA-256 content hashes and linked to `KnowledgeChunk` records without altering or inventing excerpts.

6. **Dry-Run Simulation**:
   - Administrators can preview proposed additions, modifications, and warnings without changing database state.

---

## 2. Using the Command-Line Interface (CLI)

The CLI tool is located at `scripts/import_verified_scholarships.py`. It can import records from both **JSON** and **CSV** files.

### Syntax
```bash
python scripts/import_verified_scholarships.py --file <path-to-file> [--dry-run] [--admin-email <email>]
```

### Options
| Option | Description |
|---|---|
| `-f`, `--file` | Path to JSON or CSV file containing scholarship records (Required). |
| `--dry-run` | Runs validation and matching; prints summary of proposed additions/updates without database commit. |
| `--admin-email` | Verifies execution against an administrator user account in the database (`role == 'ADMIN'`). |

### Examples

#### Example 1: Dry-Run Simulation (JSON)
```bash
python scripts/import_verified_scholarships.py --file data/tn_scholarships.json --dry-run
```
*Output:*
```text
================================================================================
 SCHOLARAi Scholarship Import & Refresh Pipeline
 Source File : tn_scholarships.json
 Pipeline Mode: [DRY-RUN PREVIEW - NO CHANGES SAVED]
================================================================================

Itemized Status:
 [OK]   #1 [WOULD_UPDATE] Post-Matric Scholarship for SC/ST/SCA Students
     Source : [Official Gov Domain] [SOURCE_VERIFIED]
     Details: Would update existing scholarship ID 1. Existing student applications (1) preserved.
 [OK]   #2 [WOULD_CREATE] Chief Minister Merit Research Award
     Source : [Official Gov Domain] [SOURCE_VERIFIED]
     Details: Would create new scholarship 'Chief Minister Merit Research Award'. Rules: 1, Requirements: 2.

--------------------------------------------------------------------------------
 Summary: Total=2 | Created=1 | Updated=1 | Skipped=0 | Rejected=0
================================================================================
```

#### Example 2: Live Import from CSV
```bash
python scripts/import_verified_scholarships.py --file data/new_schemes.csv --admin-email admin.officer@scholarai.gov.in
```

---

## 3. Data File Formats

### JSON Format Specification
A JSON file can contain either a list of scholarship objects or an object with an `"items"` or `"scholarships"` array:

```json
[
  {
    "name": "Post-Matric Scholarship for SC/ST/SCA Students",
    "provider": "Adi Dravidar and Tribal Welfare Department, Government of Tamil Nadu",
    "description": "Flagship Tamil Nadu post-matric scholarship guaranteeing 100% compulsory fee waiver and living stipend.",
    "amount": 55000.0,
    "currency": "INR",
    "deadline": "2026-12-31T23:59:59Z",
    "dossier_index": "№ TN-ADW-2025-01",
    "source_url": "https://tndce.tn.gov.in/Home/scholarship_cms",
    "application_url": "https://sspdept.tnega.org/",
    "stream": "BOTH",
    "study_level": "BOTH",
    "category_tag": "Government Scholarships, Tamil Nadu State Schemes",
    "tn_residency_required": true,
    "community_category": "SC,ST,SCA",
    "income_ceiling": 250000.0,
    "source_verification_status": "SOURCE_VERIFIED",
    "eligibility_rules": [
      {
        "rule_type": "MAX_INCOME",
        "criteria_value": "250000",
        "operator": "LTE",
        "description": "Annual parental income up to ₹2,50,000"
      }
    ],
    "requirements": [
      {
        "name": "Community Certificate (Tahsildar Issued)",
        "document_type": "COMMUNITY_CERTIFICATE",
        "type": "DOCUMENT",
        "is_required": true
      }
    ],
    "knowledge_docs": [
      {
        "title": "G.O. Ms. No. 42 Adi Dravidar Welfare Guidelines",
        "source_url": "https://tndce.tn.gov.in/Home/scholarship_cms",
        "chunks": [
          {
            "section": "Clause 4.1: Fee Concession",
            "chunk_text": "Students admitted under single-window government quota in autonomous colleges are granted complete tuition fee exemptions."
          }
        ]
      }
    ]
  }
]
```

### CSV Format Specification
A CSV file includes column headers corresponding to scholarship attributes. Embedded rules and requirements can be formatted with semicolons:

```csv
name,provider,description,amount,deadline,source_url,dossier_index,tn_residency_required,rules,requirements
Chief Minister Higher Education Grant,Directorate of Collegiate Education,State grant for meritorious degree students,40000,2026-12-15T18:00:00Z,https://tndce.tn.gov.in/cms,TN-CM-HE-01,true,ANNUAL_INCOME:LTE:200000;CGPA:GTE:7.5,Income Certificate:INCOME_CERTIFICATE;Community Certificate:COMMUNITY_CERTIFICATE
```

- **Rules syntax**: `<RULE_TYPE>:<OPERATOR>:<VALUE>` separated by semicolons (`;`).
- **Requirements syntax**: `<DOCUMENT_NAME>:<DOCUMENT_TYPE>` separated by semicolons (`;`).

---

## 4. Using the Administrative REST API

### Endpoint Specification
- **Method**: `POST`
- **Path**: `/api/v1/scholarships/import`
- **Auth**: Bearer Token or Session Cookie for user with `role == 'ADMIN'`
- **Content-Type**: `application/json`

### cURL Example
```bash
curl -X POST "http://localhost:8000/api/v1/scholarships/import" \
  -H "Authorization: Bearer <ADMIN_SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "name": "Tamil Nadu Post-Matric Scholarship (BC/MBC)",
        "provider": "BC, MBC and Minorities Welfare Department",
        "description": "Tuition assistance for BC, MBC, and DNC students in regular autonomous college courses.",
        "amount": 25000.0,
        "deadline": "2026-11-30T18:30:00Z",
        "source_url": "https://bcmbcmw.tn.gov.in/welfschemes.htm",
        "dossier_index": "№ TN-BCMW-2025-02",
        "source_verification_status": "SOURCE_VERIFIED"
      }
    ],
    "dry_run": false
  }'
```

### Response Schema (`ScholarshipImportSummary`)
```json
{
  "total": 1,
  "created": 0,
  "updated": 1,
  "skipped": 0,
  "rejected": 0,
  "dry_run": false,
  "errors": [],
  "items": [
    {
      "index": 1,
      "name": "Tamil Nadu Post-Matric Scholarship (BC/MBC)",
      "dossier_index": "№ TN-BCMW-2025-02",
      "action": "UPDATED",
      "status": "SUCCESS",
      "details": "Updated existing scholarship ID 2. Preserved 1 existing student application(s).",
      "source_verification_applied": "SOURCE_VERIFIED",
      "official_source_detected": true,
      "errors": []
    }
  ]
}
```

---

## 5. Verification Safeguards in Action

| Scenario | Input Status | Source URL | Result | Safeguard Triggered |
|---|---|---|---|---|
| Official state portal | `SOURCE_VERIFIED` | `https://tndce.tn.gov.in/...` | `SOURCE_VERIFIED` | Approved (domain ends with `.gov.in`) |
| Unofficial blog/aggregator | `SOURCE_VERIFIED` | `https://scholarship-portal.blog/...` | `PARTIALLY_VERIFIED` | **Demoted**: non-gov source URL cannot claim official verification |
| Missing verification | `None` | `https://sspdept.tnega.org` | `PARTIALLY_VERIFIED` | Conservative default (never defaults blindly to `SOURCE_VERIFIED`) |
| Dry-run preview | `SOURCE_VERIFIED` | `https://tn.gov.in/...` | `WOULD_CREATE` | Simulated preview; zero DB writes |
