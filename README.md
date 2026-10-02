# SCHOLARAi — Student Funding & Application Intelligence

**Current Status: Block 2 — Core Funding & Application Intelligence**

---

## 1. Product Overview

Scholarship discovery is a search problem. Scholarship pursuit is a coordination and decision problem.

**SCHOLARAi** is the student-first intelligence platform that connects:
- Student funding need
- Scholarship rules
- Application state
- Documents & evidence
- Deadlines
- Dependencies
- Next best actions

### Core Trust Principle
> **"AI assists. Official sources decide. Student approves."**
> 
> *Critical Notice:* SCHOLARAi does not claim guaranteed eligibility or guaranteed scholarship awards. Final eligibility criteria and awards are determined exclusively by official awarding authorities. All seeded scholarship records are **DEMO DATA** and not verified live opportunities.

---

## 2. Block 2 Scope & Implemented Capabilities

### A. Scholarship Discovery & Management
- Structured scholarship catalog with 8 comprehensive demo records, all clearly marked `DEMO DATA`.
- Multi-dimensional search across title, provider, and description.
- Filters by eligibility (`eligible`, `possibly_eligible`, `ineligible`, `needs_verification`), deadline, award amount, and verification status.
- Sorting by recommended match score, upcoming deadline, and award amount.
- Transparent *"Why this may fit"* explanations tailored to student profile attributes.

### B. Deterministic Eligibility Rule Engine
- Evaluates student CGPA, 12th percentage, annual family income, course/degree level, academic year, domicile state, reservation category, and gender restrictions.
- Deterministic evaluation logic without LLM hallucinations.
- Returns explicit human-readable reasons for eligibility, ineligibility, or verification requirements.

### C. Potential Funding Impact Analysis
- Analyzes candidate scholarships against the student's remaining funding gap:
  $$\text{Potential Remaining Gap} = \max(0, \text{Funding Gap} - \text{Scholarship Amount})$$
- Explicitly labeled as simulated potential impact, never assuming award receipt.

### D. Application Tracking & Checklist Coordination
- Full application lifecycle: `NOT_STARTED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `READY` $\rightarrow$ `SUBMITTED` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `APPROVED` / `REJECTED` / `WITHDRAWN`.
- Prevents duplicate active applications for the same scholarship.
- Requirement-level checklists tracking documents, essays, and forms.
- Interactive personal statement drafting and saving.

### E. Cross-Application Dependency Graph & Shared Blockers
- Models dependencies between Student $\rightarrow$ Documents $\rightarrow$ Application Requirements $\rightarrow$ Applications $\rightarrow$ Scholarships.
- Automatically identifies **Shared Blockers**: missing documents that block multiple active applications.
- Computes `potential_funding_affected` across all blocked applications.
- **Document Cascade Unblocking**: Updating a document status (e.g., from `MISSING` to `AVAILABLE`) automatically synchronizes dependent requirements across all applications and recalculates application readiness.

### F. Application Bottleneck & Next-Best-Action Engine
- Identifies the highest-leverage bottleneck in the student's application portfolio.
- Deterministically ranks next-best actions factoring in deadline urgency, funding gap coverage, document blockers, and application completion.

### G. Deadline Risk Engine
- Categorizes deadline risk into `URGENT`, `HIGH`, `MEDIUM`, `LOW`, and `EXPIRED` based on remaining days and application progress.

### H. Time-Constrained Portfolio Planner & Funding Strategy
- Allows the student to specify available weekly preparation hours (e.g., 5 hours/week).
- Generates a suggested weekly plan allocating time between shared blocker resolution, urgent deadline applications, and statement preparation.
- Highlights crucial distinctions: `CAN APPLY` vs `CAN RECEIVE` vs `CAN HOLD CONCURRENTLY`.
- Outlines concurrent-award compliance caveats: *"Concurrent award rule: Needs verification."*

---

## 3. Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4
- **Backend**: Python 3.14, FastAPI, SQLAlchemy 2.0, Pydantic v2, Uvicorn
- **Database**: SQLite for local development (`scholarai.db`); clean schema ready for PostgreSQL
- **Testing**: Pytest, HTTPX, TypeScript (`tsc --noEmit`), Next.js Production Build

---

## 4. Quick Start & Setup

### Prerequisites
- Node.js (v18+) & npm
- Python (v3.10+)

### Backend Setup
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation: `http://127.0.0.1:8000/docs`

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Portal URL: `http://localhost:3000`

---

## 5. Running Tests

### Backend Test Suite (Pytest)
```bash
python -m pytest backend/tests
```

### TypeScript Validation
```bash
cd frontend
npx tsc --noEmit
```

### Frontend Build
```bash
cd frontend
npm run build
```

### End-to-End Live Integration Test
```bash
python test_live_block2.py
```

---

## 6. What Is Deferred to Later Phases

To maintain strict Block 2 focus, the following capabilities are explicitly deferred:
- **Real secure binary file upload and encrypted document storage** (Phase 3).
- **Advanced external LLM reasoning and conversational assistants** (Phase 3).
- **Retrieval-Augmented Generation / RAG over official government PDF gazettes** (Phase 3).
- **Live web scraping of third-party portals** (Phase 3).
- **Multi-user authentication, JWT tokens, and OAuth2 login** (Phase 3).
- **Automated SMS/Email notification delivery** (Phase 3).
