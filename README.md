# SCHOLARAi — Student Funding & Application Intelligence

**Current Status: Block 3 — Advanced AI, Evidence, RAG & Adaptive Intelligence**

---

## 1. Product Overview

Scholarship discovery is a search problem. Scholarship pursuit is a coordination and decision problem.

**SCHOLARAi** is the student-first intelligence platform connecting:
- Funding Need
- Scholarship Rules
- Student Evidence
- Application State
- Documents
- Deadlines
- Dependencies
- Knowledge Sources
- AI Assistance
- Next Best Action

### Core Trust Principle
> **"AI assists. Official sources decide. Student approves."**
> 
> *Critical Notice:* SCHOLARAi does not claim guaranteed eligibility or guaranteed scholarship awards. Final eligibility criteria and awards are determined exclusively by official awarding authorities. All seeded scholarship records are **DEMO DATA** and not verified live opportunities. The system will never auto-submit applications on behalf of students.

---

## 2. Block 3 Scope & Implemented Capabilities

### A. Verified Evidence Bank (`/evidence`)
- Persistent library of student accomplishments, coursework, projects, internships, leadership roles, and academic awards.
- Evidence categories: `ACADEMIC`, `PROJECT`, `INTERNSHIP`, `WORK_EXPERIENCE`, `AWARD`, `CERTIFICATION`, `LEADERSHIP`, `VOLUNTEERING`, `FINANCIAL`, `OTHER`.
- Grounded attribution: Tracks whether evidence is sourced from `Student Profile`, `Document Metadata`, or `User Provided`.
- Verification statuses: `USER_PROVIDED`, `VERIFIED`, `NEEDS_VERIFICATION`, `REJECTED`.
- Trust Rule: AI uses approved evidence only; it never fabricates unverified achievements or competition wins.

### B. AI Assistant (`/assistant`)
- Conversational assistant with access to 16 controlled tools (no raw database exposure).
- Tools: `search_scholarships`, `get_scholarship_details`, `check_eligibility`, `get_user_funding_goal`, `get_user_applications`, `get_application_status`, `get_missing_documents`, `get_user_evidence`, `find_application_blockers`, `build_dependency_graph`, `calculate_deadline_risk`, `estimate_application_effort`, `get_next_best_actions`, `optimize_application_plan`, `retrieve_scholarship_knowledge`, `retrieve_official_rules`.
- Response Trust Categorization: Explicitly distinguishes `FACTS FROM USER DATA`, `OFFICIAL SOURCE INFORMATION`, `AI ANALYSIS`, and `AI SUGGESTIONS`.
- Action Confirmation: Proposing state mutations (e.g., updating weekly study hours or verifying evidence) requires explicit student confirmation (`[Confirm]` / `[Cancel]`).
- Audit Log: Tracks all assistant interactions in `AIInteractionLog`.

### C. AI Application Assistance (`/applications`)
- **Grounded Essay Drafting**: Generates application question answers grounded in approved items from the Evidence Bank. Labeled `AI GENERATED DRAFT`. Never auto-submitted.
- **Unsupported Claim Detection**: Analyzes candidate answers against the Evidence Bank and student profile, flagging ungrounded claims (e.g. exaggerated team sizes or unrecorded awards).
- **Application Review**: Evaluates responses for completeness, metric grounding, and clarity, providing constructive review recommendations.
- **Approval Workflow**: Explicit student approval is required before applying drafts to personal statements.

### D. RAG Knowledge Base & Citations
- Models: `KnowledgeSource`, `KnowledgeDocument`, `KnowledgeChunk`.
- Ingests official guidelines and scheme rules, chunked and indexed with SHA-256 content hashes.
- RAG search returns relevant chunks with source citations, authority levels, and verification dates.
- Citation transparency: Cites sources clearly; demo records remain labeled `DEMO_DATA`.

### E. Scholarship Change Monitoring & Alerts
- Monitors source content hashes and timestamps.
- Change detection detects modifications (e.g., deadline advanced from 4 days to 1 day remaining).
- Automatically recalculates affected applications, updates deadline risk, and creates high-priority notifications.

### F. Adaptive Planning & Rejection Fallback
- Dynamic adjustments in response to status transitions:
  - If an application is marked `REJECTED`, its funding pursued drops to ₹0, funding gap adjusts, and alternative matching scholarships and planner allocations are prioritized.
  - If an application is marked `APPROVED`, award amounts are recorded while flagging concurrent holding restrictions as requiring official provider verification.

### G. Voice Decoder
- Decodes speech and transcription queries in English, Tamil, and Tanglish (e.g., *"Enakku 5 hours irukku this week"*).
- Extracts structured intent (`weekly_available_hours`, `funding_goal`, `scholarship_search`, `blocker_inquiry`).
- Trust Rule: Always echoes *"You said: ... Is this correct?"* with confirmation buttons before executing any change.

### H. Authentication, Authorization & Security Hardening
- Authentication: Secure registration and login with PBKDF2-HMAC-SHA256 password hashing (600,000 iterations, cryptographic salts).
- Session Management: Cryptographically signed HttpOnly session cookies (`scholarai_session`).
- Multi-User Authorization & IDOR Defense: All student-specific endpoints are strictly scoped to `current_user.student_id`. Cross-user access is blocked with HTTP 403 Forbidden.
- Prompt Injection Defense: Sanitizes untrusted content and defangs override instructions into inert text.
- SSRF Defense: Validates URLs, blocking private IP ranges, localhost, and non-HTTP schemes.
- Demo Account: Pre-configured demo student Arjun Kumar accessible via `demo@scholarai.local` (`DemoStudent@2026`).

---

## 3. Technology Stack

- **Backend**: Python 3.14+, FastAPI, SQLAlchemy 2.0 ORM, Pydantic v2
- **Database**: SQLite (local development, migratable to PostgreSQL)
- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Vanilla Tailwind CSS
- **Testing**: pytest, anyio, httpx

---

## 4. API Reference Summary

### Authentication
- `POST /api/v1/auth/register` — Register student account
- `POST /api/v1/auth/login` — Sign in and receive session cookie
- `POST /api/v1/auth/logout` — Sign out and invalidate session
- `GET /api/v1/auth/me` — Get current user identity

### Evidence Bank
- `GET /api/v1/evidence` — List student evidence items (filtered by category/status)
- `POST /api/v1/evidence` — Add evidence item
- `GET /api/v1/evidence/{id}` — Get evidence detail
- `PATCH /api/v1/evidence/{id}` — Update evidence item
- `DELETE /api/v1/evidence/{id}` — Delete evidence item

### AI Assistant & Application AI
- `POST /api/v1/assistant/chat` — Conversational assistant with tool execution
- `POST /api/v1/applications/{id}/draft` — Draft answer using Evidence Bank
- `POST /api/v1/applications/{id}/review` — Review application answer
- `POST /api/v1/applications/{id}/evidence-check` — Detect unsupported claims

### RAG Knowledge Base
- `GET /api/v1/knowledge/sources` — List knowledge sources
- `GET /api/v1/knowledge/search` — Search chunks with citations
- `GET /api/v1/knowledge/{id}` — Get knowledge source detail

### Monitoring & Notifications
- `GET /api/v1/notifications` — List notifications with unread count
- `PATCH /api/v1/notifications/{id}/read` — Mark notification read
- `POST /api/v1/notifications/mark-all-read` — Mark all notifications read
- `GET /api/v1/monitoring` — List monitored sources
- `POST /api/v1/monitoring/check` — Check or simulate source changes

### Voice Decoder
- `POST /api/v1/voice/interpret` — Interpret voice/text intent with confirmation

### Core Funding & Applications (Block 2)
- `GET /api/v1/scholarships` — Catalog search, filtering, and sorting
- `GET /api/v1/scholarships/{id}` — Detail and potential funding impact
- `GET /api/v1/scholarships/{id}/eligibility` — Deterministic criteria evaluation
- `POST /api/v1/scholarships/{id}/apply` — Start application
- `GET /api/v1/applications` — Active applications portfolio
- `PATCH /api/v1/applications/{id}` — Update application status or personal statement
- `PATCH /api/v1/applications/{id}/requirements/{req_id}` — Update requirement status
- `GET /api/v1/documents` — Document status & shared blockers
- `PATCH /api/v1/documents/{id}` — Update document status (triggers cascade unblocking)
- `GET /api/v1/actions` — Ranked next-best actions
- `GET /api/v1/planner` — Portfolio planning & weekly hour allocations

---

## 5. Local Setup & Verification

### Running the Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Running the Frontend
```bash
cd frontend
npm install
npm run dev
```

### Running Test Suites
```bash
# Run all backend unit & integration tests (26 tests)
cd backend
python -m pytest tests

# Run live integration verification
python test_live_block3.py
python test_live_block2.py
```
