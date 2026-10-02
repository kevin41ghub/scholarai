# SCHOLARAi — Student Funding & Application Intelligence

**Current Status: Block 4 — Production Ready, Deployment Hardened & Full QA**

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

## 2. Block 4 Scope & Implemented Capabilities

### A. Production Security & Hardening
- **Strict Authentication**: Password hashing using salted PBKDF2-HMAC-SHA256 (600,000 rounds).
- **Session Security**: HMAC-SHA256 signed session tokens delivered via `HttpOnly`, `SameSite=Lax`, and `Secure` (in production) cookies.
- **Production Secret Validation**: Rejects default development `AUTH_SECRET` and wildcard CORS origins on production boot.
- **SSRF & Prompt Injection Guards**: Blocks access to localhost/private IP spaces; sanitizes and defangs retrieved RAG content.
- **Exception Sanitization**: Suppresses raw stack traces in production to prevent information disclosure.

### B. Real AI Provider & Fallback Architecture
- **Provider Abstraction**: Modular `AIProvider` base class supporting `generate()`, `summarize()`, `classify()`, `extract()`, and `embed()`.
- **OpenAI-Compatible Adapter**: Production REST adapter supporting OpenAI (GPT-4o, GPT-4o-mini), Groq (Llama-3), Together, DeepSeek, Google Gemini (via OpenAI compatibility), and Ollama.
- **Demo AI Fallback**: Safe deterministic mode (`AI_PROVIDER="demo"`) ensuring local usability with zero external keys.
- **Secret Redaction**: API keys and authorization headers are never logged or exposed in client error payloads.

### C. Controlled AI Tool Execution (Zero Direct SQL)
- 16 strictly typed, validated backend tools wrapping business logic in `AIToolkit`.
- AI assistant cannot issue raw SQL queries or mutate databases directly.
- Consequential state changes require student confirmation dialogs before persisting.

### D. Verified Evidence Bank (`/evidence`)
- Persistent library of student accomplishments across 13 categories (`ACADEMIC`, `PROJECT`, `WORK_EXPERIENCE`, `AWARD`, `LEADERSHIP`, etc.).
- Provenance tracking (`Student Profile`, `Document`, `User Provided`).
- Verification statuses: `USER_PROVIDED`, `VERIFIED`, `NEEDS_VERIFICATION`, `REJECTED`.
- Grounded drafting: Generates application answers citing verified evidence IDs.
- Unsupported claim detection: Automatically flags ungrounded assertions.

### E. RAG Knowledge Base & Citations
- Relational schema: `KnowledgeSource` $\rightarrow$ `KnowledgeDocument` $\rightarrow$ `KnowledgeChunk`.
- Ingests guidelines, chunked with SHA-256 content hashes.
- Preserves source citations, authority levels (`OFFICIAL`, `DEMO`), and verification dates.

### F. Adaptive Planning & Change Monitoring
- Rejection recalculation: Drops potential funding from rejected applications to **₹0** and re-allocates preparation hours.
- Approval handling: Logs award values and flags concurrent holding rules with *"Concurrent holding eligibility requires official verification."*
- Deadline compression: Dynamically escalates urgency when deadlines approach.
- Monitoring service: Detects source content changes and triggers high-severity targeted notifications.

### G. Voice Decoder
- Speech/text intent interpreter supporting English, Tamil, and Tanglish.
- Enforces mandatory user confirmation before applying interpreted intents.

---

## 3. End-to-End User Journey

$$\text{DISCOVER} \longrightarrow \text{UNDERSTAND} \longrightarrow \text{PLAN} \longrightarrow \text{UNBLOCK} \longrightarrow \text{APPLY} \longrightarrow \text{MONITOR} \longrightarrow \text{ADAPT}$$

1. **Discover**: Browse opportunities matching student academic & financial profile with transparent eligibility criteria.
2. **Understand**: Inspect potential funding impact (e.g. ₹60,000 gap reduced by ₹50,000 award $\rightarrow$ ₹10,000 remaining gap).
3. **Plan**: Configure weekly available hours (e.g. 5.0 hrs) and generate time-constrained effort allocations.
4. **Unblock**: Identify shared blockers (e.g. Income Certificate blocking 3 active applications affecting ₹1,35,000) and observe cascade unblocking to 100% readiness.
5. **Apply & Assist**: AI drafts answers strictly grounded in Evidence Bank; flags unsupported claims; requires student approval.
6. **Monitor & Adapt**: Source change alerts re-prioritize applications and adjust deadline risk automatically.

---

## 4. API Endpoints

### Authentication & Identity
- `POST /api/v1/auth/register` — Register student account
- `POST /api/v1/auth/login` — Authenticate and receive signed session cookie
- `POST /api/v1/auth/logout` — Clear session cookie
- `GET /api/v1/auth/me` — Current user identity and student profile

### AI Assistant & Evidence
- `POST /api/v1/assistant/chat` — Conversational assistant with tool execution
- `GET /api/v1/evidence` — List student evidence items
- `POST /api/v1/evidence` — Create new evidence item
- `GET /api/v1/evidence/{id}` — Get evidence detail
- `PATCH /api/v1/evidence/{id}` — Update evidence item
- `DELETE /api/v1/evidence/{id}` — Delete evidence item

### AI Application Assistance
- `POST /api/v1/applications/{id}/draft` — Generate grounded draft citing Evidence Bank
- `POST /api/v1/applications/{id}/review` — Review application answer
- `POST /api/v1/applications/{id}/evidence-check` — Check for unsupported claims

### RAG Knowledge Base & Monitoring
- `GET /api/v1/knowledge/sources` — List knowledge sources
- `GET /api/v1/knowledge/search` — Search RAG chunks with citation preservation
- `GET /api/v1/knowledge/{id}` — Get knowledge source detail
- `GET /api/v1/notifications` — List notifications with unread count
- `PATCH /api/v1/notifications/{id}/read` — Mark notification read
- `POST /api/v1/notifications/mark-all-read` — Mark all notifications read
- `GET /api/v1/monitoring` — List monitored sources
- `POST /api/v1/monitoring/check` — Check or simulate source changes

### Voice Decoder
- `POST /api/v1/voice/interpret` — Interpret voice/text intent with confirmation

### Core Funding & Applications
- `GET /api/v1/scholarships` — Catalog search, filtering, and sorting
- `GET /api/v1/scholarships/{id}` — Detail and potential funding impact
- `GET /api/v1/scholarships/{id}/eligibility` — Deterministic criteria evaluation
- `POST /api/v1/scholarships/{id}/apply` — Start application
- `GET /api/v1/applications` — Active applications portfolio
- `PATCH /api/v1/applications/{id}` — Update application status
- `GET /api/v1/documents` — Document status & shared blockers
- `PATCH /api/v1/documents/{id}` — Update document status (cascade unblocking)
- `GET /api/v1/actions` — Ranked next-best actions
- `GET /api/v1/planner` — Portfolio planning & weekly hour allocations

---

## 5. Deployment & Local Setup

### Local Docker Compose (PostgreSQL + FastAPI + Next.js)
```bash
docker-compose up --build -d
```
Access at `http://localhost:3000` (Frontend) and `http://localhost:8000/api/health` (Backend).

### Running Manually

#### Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python scripts/bootstrap_db.py
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Running Test Suites
```bash
# 1. Pytest Unit & Security Suite (33 tests)
cd backend
python -m pytest tests -v

# 2. Block 2 Live Integration Regression (14 assertions)
python test_live_block2.py

# 3. Block 3 Live Integration Regression (16 assertions)
python test_live_block3.py

# 4. Block 4 Live E2E QA & Hardening Suite (14 assertions)
python test_live_block4.py

# 5. Frontend Typecheck & Build
cd frontend
npx.cmd tsc --noEmit
npm.cmd run build
```
