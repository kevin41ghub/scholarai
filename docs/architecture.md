# Architecture Overview — SCHOLARAi

**Current Status: Deployed Production Architecture — Full-Stack Intelligence Platform**

---

## 1. Architectural & Trust Principles

1. **"AI assists. Official sources decide. Student approves."** — Core operating philosophy across all layers. The AI never guarantees eligibility, awards, or deadlines; never silently modifies data; and never auto-submits applications.
2. **Separation of Concerns**: Decoupled presentation (Next.js 16), API & business logic (FastAPI), secure authentication, deterministic engines, controlled AI tools, and storage (SQLAlchemy 2.0).
3. **Controlled AI Execution via Tools**: The LLM provider (or deterministic fallback) has **zero direct SQL/database access**. All AI operations route through 16 strictly typed, validated backend tools.
4. **Evidence Grounding & Hallucination Prevention**: Student drafts and claims are verified against the Verified Evidence Bank and student profile. Unsupported claims are flagged and never silently invented. Consequential actions (draft approvals, profile changes, evidence verification) strictly require explicit student confirmation.
5. **Deterministic Intelligence & Cascades**: Financial gap metrics, rule-based eligibility, deadline risk, dependency graphs, and action ranking remain deterministic, auditable, and unaffected by LLM variance.
6. **Multi-Tenant Security & Cross-Origin Session Defense**: All student-specific endpoints require authentication and enforce student-level scoping via `verify_student_access`. Passwords use salted PBKDF2-HMAC-SHA256 (600,000 iterations); sessions use signed HttpOnly cookies (`SameSite=None`, `Secure` in production cross-origin deployment; `SameSite=Lax` in local development).
7. **SSRF, Prompt Injection & Secret Protection**: URLs are validated against private/localhost IP ranges and non-HTTP schemes. Retrieved RAG text is quarantined as untrusted data before prompt construction. AI provider logs and client errors sanitize API keys and sensitive tokens.
8. **Categorical Information Boundaries**: The architecture strictly separates deterministic calculations, controlled tool execution, RAG guidelines, student-provided evidence, official source data, and demo catalog records to maintain complete provenance.

---

## 2. System Topology

```
+-----------------------------------------------------------------------------------+
|                                 Next.js 16 Client                                 |
|  - React 19 + TypeScript 5 + Tailwind CSS 4                                       |
|  - Global Navigation & Notifications: Header with live unread badge & user menu    |
|  - Pages:                                                                         |
|      /                 -> Adaptive Dashboard (portfolio, shared blockers, actions)|
|      /discover         -> Search & rule-matched opportunities                     |
|      /discover/[id]    -> Funding impact, scheme requirements, source status      |
|      /applications     -> Tracker, checklist & AI Application Assistant Drawer    |
|      /documents        -> Shared blocker & readiness management                   |
|      /evidence         -> Verified Evidence Bank (categories, sources, badges)    |
|      /assistant        -> Conversational AI Assistant & Voice Decoder             |
|      /goal             -> Portfolio goal & weekly effort planner                  |
|      /profile          -> Academic & financial baseline                           |
|      /login, /register -> Secure authentication & one-click demo login            |
+-----------------------------------------+-----------------------------------------+
                                          |
                        REST / JSON via HTTPX (with credentials)
                                          |
+-----------------------------------------v-----------------------------------------+
|                                 FastAPI Backend                                   |
|  - Security & Auth Layer:                                                         |
|      /api/v1/auth          -> Register, Login, Logout, Me                         |
|      PBKDF2-HMAC-SHA256    -> 600,000 rounds, constant-time verification          |
|      Session Middleware    -> Signed HttpOnly cookies (SameSite=None, Secure prod)|
|      IDOR Protection       -> verify_student_access scoping on all student routes  |
|  - Core Domain Routers:                                                           |
|      /api/v1/scholarships  -> Catalog, Discovery, Apply (DEMO_DATA)               |
|      /api/v1/student       -> Profile & Dynamic Funding Gap                       |
|      /api/v1/documents     -> Document State, Shared Blockers, Cascade Sync       |
|      /api/v1/actions       -> Deterministic Next-Best-Action ranking              |
|      /api/v1/planner       -> Goal & Weekly Allocation Plan                       |
|  - Intelligence, Evidence & Grounding Routers:                                    |
|      /api/v1/evidence      -> Evidence Bank CRUD & source tracking                |
|      /api/v1/assistant     -> Conversational Assistant (tools, confirmations)     |
|      /api/v1/applications  -> Grounded drafting, review, evidence-grounding check |
|      /api/v1/knowledge     -> RAG Sources, documents, chunk retrieval             |
|      /api/v1/notifications -> Notification Engine (unread, severity, actions)     |
|      /api/v1/voice         -> Voice Decoder (English, Tamil, Tanglish)            |
|      /api/v1/monitoring    -> Source change detection & urgent alerts             |
|  - Intelligence & RAG Services:                                                   |
|      AIProvider (Abstract) -> Modular LLM interface with secret-sanitizing logs   |
|      GeminiProvider        -> Official Google Gemini SDK with REST fallback       |
|      DemoAIProvider        -> Deterministic local/demo offline fallback           |
|      AIToolkit             -> 16 controlled tools (no raw SQL exposure)           |
|      PromptGuard           -> Prompt injection defanging & SSRF URL validator     |
|      EvidenceService       -> Verified student asset management                   |
|      RAGKnowledgeService   -> Source verification, chunking, citation preservation|
|      ApplicationAIService  -> Grounded drafting & unsupported claim detection     |
|      MonitoringService     -> Snapshot diffing & change severity evaluation       |
|      VoiceService          -> Speech-to-intent decoder with user confirmation     |
|      Adaptive Planner      -> Reacts to deadline shifts, approvals, rejections    |
+-----------------------------------------+-----------------------------------------+
                                          |
                                 SQLAlchemy 2.0 ORM
                                          |
+-----------------------------------------v-----------------------------------------+
|                                 Database Engine                                   |
|  - Development: SQLite (scholarai.db)                                             |
|  - Production: Managed PostgreSQL on Render (connection pooling, SSL)            |
|  - 16 Relational Tables with Foreign Keys, Cascades & Compound Indexes            |
+-----------------------------------------------------------------------------------+
```

### Production Deployment Topology

- **Frontend Deployment**: Next.js 16 standalone web service hosted on Render with Turbopack builds and client-side credential forwarding.
- **Backend Deployment**: FastAPI application running with Uvicorn on Render, serving the RESTful `/api/v1` API surface.
- **Production Database**: Fully managed PostgreSQL instance on Render, using SQLAlchemy 2.0 connection pooling and transactional boundaries.
- **Local Development**: Zero-setup development supported out of the box using a local SQLite database (`scholarai.db`).
- **AI Infrastructure**: Powered by Google Gemini through server-side environment variables (`GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_PROVIDER`). All AI secrets remain strictly contained within server runtime memory and are never bundled into client distributions or exposed in error responses.

---

## 3. Relational Schema & Entity Relationships

```
                                  +-------------------+
                                  |       users       |
                                  +-------------------+
                                  | id (PK)           |
                                  | email (UNIQ)      |
                                  | hashed_password   |
                                  | is_active, role   |
                                  +---------+---------+
                                            |
                                            | 1:1
                                            v
                                  +-------------------+
                                  |     students      |
                                  +-------------------+
                                  | id (PK)           |
                                  | user_id (FK, UNIQ)|
                                  | name, email       |
                                  +----+----+----+----+
                                       |    |    |    |
        +------------------------------+    |    |    +-----------------------------+
        | 1:1                               | 1:1| 1:N                              | 1:N
 +------v------+  +-------------+  +--------v---+v----+  +-------------+  +---------v---------+
 |student_prof |  |funding_prof |  |    documents     |  |planner_goals|  |     evidence      |
 +-------------+  +-------------+  +------------------+  +-------------+  +-------------------+
 |id           |  |id           |  |id                |  |id           |  |id                 |
 |student_id   |  |student_id   |  |student_id        |  |student_id   |  |student_id         |
 |cgpa, course |  |annual_cost  |  |name, doc_type    |  |target_fund  |  |title, category    |
 |state, income|  |existing_aid |  |status            |  |weekly_hours |  |source_type, status|
 +-------------+  +-------------+  +--------+---------+  +-------------+  +-------------------+
                                            |
                                            | 1:N
                                            v
                               +------------+------------+
                               | application_requirements|
                               +-------------------------+
                               | id (PK), application_id |
                               | document_id (FK, null)  |
                               | name, status            |
                               +------------+------------+
                                            |
                                            | N:1
                                            v
                               +------------+------------+
                               |       applications      |
                               +-------------------------+
                               | id (PK), student_id     |
                               | scholarship_id (FK)     |
                               | status, progress        |
                               +------------+------------+
                                            |
                                            | N:1
                                            v
                               +------------+------------+
                               |       scholarships      |
                               +-------------------------+
                               | id (PK), name, amount   |
                               | deadline, status        |
                               +------------+------------+
                                            |
                                            | 1:N
                        +-------------------+-------------------+
                        | 1:N                                   | 1:N
             +----------v----------+                 +----------v----------+
             |  eligibility_rules  |                 |scholarship_requirem.|
             +---------------------+                 +---------------------+

                      KNOWLEDGE BASE & RAG ARCHITECTURE
 +----------------------+       +-----------------------+       +-----------------------+
 |   knowledge_sources  | 1:N   |  knowledge_documents  | 1:N   |    knowledge_chunks   |
 +----------------------+ ----> +-----------------------+ ----> +-----------------------+
 | id (PK)              |       | id (PK), source_id    |       | id (PK), doc_id       |
 | name, source_url     |       | title, content_hash   |       | chunk_text, section   |
 | authority_level      |       | verification_status   |       | page_num, token_count |
 | verification_status  |       | retrieved_at          |       | embedding_ref         |
 +----------------------+       +-----------------------+       +-----------------------+

                      NOTIFICATIONS & AI AUDITING
 +----------------------+       +-----------------------+
 |    notifications     |       |   ai_interaction_logs |
 +----------------------+       +-----------------------+
 | id (PK), student_id  |       | id (PK), student_id   |
 | type, title, message |       | prompt, response      |
 | severity, read       |       | provider, model       |
 | related_app_id/sch_id|       | tools_called, status  |
 +----------------------+       +-----------------------+
```

---

## 4. Controlled AI Architecture & Tool Layer

### AI Provider Abstraction & Google Gemini Integration

SCHOLARAi integrates language models through a modular, provider-agnostic `AIProvider` abstract base class (`generate`, `summarize`, `classify`, `extract`, `embed`), enforcing strict operational isolation and zero direct database mutation capabilities:

1. **Official Google Gemini Integration (`GeminiProvider`)**:
   - Built on the official Google Gemini SDK (`google-genai` / `genai.Client`) with automated direct HTTPS REST fallback (`_generate_rest`) to guarantee high availability and resilient connection handling.
   - Configurable via server-side environment variables (`AI_PROVIDER=gemini`, `GEMINI_API_KEY`, and `GEMINI_MODEL`, defaulting to `gemini-flash-latest` with support for `gemini-2.5-flash`, `gemini-2.0-flash`, etc.).
   - Implements automated fallback candidate cycling (`gemini-flash-latest`, `gemini-3-flash-preview`) when encountering transient upstream rate limits or unavailable/deprecated model identifiers.
   - Strict secret sanitization (`_sanitize_error`) ensures Google API keys (`AIza...`) and bearer credentials are automatically scrubbed from runtime stack traces, logs, and user-facing error envelopes.

2. **OpenAI-Compatible REST Provider (`OpenAICompatibleProvider`)**:
   - Enables drop-in integration with OpenAI, Groq, Mistral, Together, or self-hosted Ollama runtimes using standard OpenAI chat completion schemas and timeout protections.

3. **Deterministic Local / Offline Fallback (`DemoAIProvider`)**:
   - Remains continuously available when running locally without API keys or when `AI_PROVIDER=demo`.
   - Generates predictable, fully offline responses labeled explicitly with `[DEMO AI RESPONSE]`, allowing seamless end-to-end frontend evaluation and unit testing with zero third-party dependencies.

4. **Zero-Trust Secret Protection**:
   - All AI credentials exist solely within backend process memory loaded from server-side environment variables. No API keys or tokens are ever embedded in frontend assets, transmitted across client cookies, or reflected in network payloads.

### Controlled Backend Tool Layer (`AIToolkit`)

To prevent prompt injection from escalating into system compromise and avoid hallucinations, the AI assistant cannot execute direct SQL queries or database mutations. All access is brokered through the `AIToolkit`:

| Controlled Tool | Functionality | Safety Mechanism |
|---|---|---|
| `search_scholarships` | Catalog search by criteria | Deterministic filter |
| `get_scholarship_details` | Scheme requirements and deadlines | Read-only |
| `check_eligibility` | Profile rule verification | Evaluates stored rules only |
| `get_user_funding_goal` | Current funding gap and budget | Calculated dynamically |
| `get_user_applications` | Portfolio status and blockers | Read-only scoped to student |
| `get_application_status` | Detailed checklist readiness | Read-only scoped to student |
| `get_missing_documents` | Unfulfilled requirements | Scoped to active applications |
| `get_user_evidence` | Stored Verified Evidence Bank | Filters by approval status |
| `find_application_blockers` | Shared bottleneck analysis | Computed dependency graph |
| `build_dependency_graph` | Cross-application document mapping | Computed topology |
| `calculate_deadline_risk` | Temporal urgency classification | Calendar math |
| `estimate_application_effort`| Preparation time modeling | Heuristic workload metric |
| `get_next_best_actions` | Ranked unblocking recommendations | Deterministic utility engine |
| `optimize_application_plan` | Weekly hour allocation | Time-constrained solver |
| `retrieve_scholarship_knowledge`| RAG chunk search | Preserves citation metadata |
| `retrieve_official_rules` | Official guidelines lookup | Includes authority level |

---

## 5. RAG Pipeline, Evidence Grounding & Data Boundaries

```
User Query / Draft Request
       |
       +---> [AIToolkit]
                 |
                 +---> RAG Knowledge Retrieval
                 |        |
                 |        v
                 |     Scan `knowledge_chunks` (lexical/semantic matching)
                 |        |
                 |        v
                 |     Preserve Source URL, Authority Level, Last Verified Date
                 |
                 +---> Student Evidence Retrieval
                          |
                          v
                       Scan `evidence` table for APPROVED / USER_PROVIDED records
                          |
                          v
                       Synthesize Draft with Explicit Citations
                          |
                          v
            [Evidence-Grounding Checker]
            Compare claims against Evidence Bank
              - Supported claims -> Retained
              - Unsupported claims -> Flagged as "UNSUPPORTED CLAIM"
                          |
                          v
              Return to Student for Approval:
              [Approve Draft] | [Edit] | [Discard]
```

### First-Class Evidence Bank Grounding

The Verified Evidence Bank serves as an architectural first-class grounding source alongside official RAG knowledge chunks and student profile baselines:

1. **Evidence-First Query Routing**:
   - Conversational assistant queries referencing student projects, credentials, achievements, or reusable application materials are deterministically routed to user evidence (`get_user_evidence`) before evaluating generic scholarship recommendations. This ensures students receive answers grounded in their authentic accomplishments rather than generic catalog promotions.

2. **Multi-Faceted Prompt Grounding**:
   - For real AI providers (Google Gemini or OpenAI-compatible backends), the assistant prompt assembler constructs a comprehensive, structured context containing:
     - Live funding metrics (annual cost, existing support, calculated funding gap, available weekly hours)
     - Active shared blockers and affected funding amounts
     - In-progress applications with deadlines and status
     - Ranked next-best actions from the deterministic engine
     - Stored Evidence Bank records (`=== STUDENT EVIDENCE BANK ===`)
     - Retrieved official guidelines chunks (`=== RETRIEVED KNOWLEDGE BASE ===`)

3. **Strict Prohibition of Hallucinated Evidence**:
   - Operational instructions mandate that the AI must never invent, extrapolate, or assume unverified student credentials, accomplishments, or qualifications. If evidence is lacking, the model must explicitly state that no corresponding record exists in the student's Evidence Bank.

4. **Automated Unsupported Claim Detection (`check_unsupported_claims`)**:
   - When generating or reviewing personal statements, essays, and short answers, the system evaluates candidate text against the student's verified profile and Evidence Bank corpus.
   - Sentences containing high-risk credential keywords (e.g., *patent, published, founder, national rank, first prize*) or failing token-overlap thresholds without corroborating evidence are flagged as `UNSUPPORTED CLAIM` with an accompanying verification warning.

5. **Mandatory Student Approval for Consequential Actions**:
   - In alignment with the trust principle **"AI assists. Official sources decide. Student approves."**, all consequential actions require explicit student confirmation:
     - AI-generated drafts are tagged: `AI GENERATED DRAFT — Student review and approval required`.
     - Portfolio mutations (such as changing available weekly application hours) generate an interactive `ActionConfirmation` modal.
     - Evidence verification status transitions require explicit student approval before becoming active in drafting.

### Transparent Information Boundaries

To maintain provenance and prevent confusion between official requirements, personal achievements, and demonstration records, SCHOLARAi strictly separates its data into six clear architectural tiers:

| Data Tier | Source & Authority | Mutability | Role in System |
|---|---|---|---|
| **Deterministic Business Logic** | Pure Python/SQL algorithms | Immutable by LLM | Calculates funding gaps, evaluates eligibility rules, computes shared blocker dependency graphs, and ranks next-best actions. |
| **Controlled AI / Tool Execution** | `AIToolkit` (16 typed methods) | LLM-invoked; strictly validated | Brokered interface between the model and platform data; zero direct database query access. |
| **RAG Retrieval** | Official portal rules & guidelines | System-verified; chunked | Provides regulatory excerpts, eligibility thresholds, and required documentation with citations and authority levels. |
| **Student-Provided Evidence** | Student Evidence Bank & profile | Student-authored; verified | Supplies verifiable achievements, projects, credentials, and academic track record for application drafting. |
| **Official-Source Information** | Government / foundation schemas | Authoritative external source | Defines scheme deadlines, award amounts, and statutory criteria; monitored via snapshot diffing. |
| **Demo Scholarship Data** | Pre-seeded opportunities (`DEMO_DATA`) | Mock catalog entries | Demonstrates multi-scheme matching, blocker unblocking cascades, and funding impact in local and prototype environments. |

---

## 6. Adaptive Planning & Lifecycle Propagation

The planner adapts dynamically to portfolio events:

1. **Deadline Compression**: If a deadline moves closer (e.g. from 4 days to 1 day remaining), deadline risk escalates to `URGENT`, boosting the application's ranking in `get_next_best_actions`.
2. **Rejection Recalculation**: When an application status changes to `REJECTED`:
   - Potential funding under pursuit from that application immediately drops to **₹0**.
   - Remaining funding gap stays unfilled.
   - The engine reprioritizes alternative opportunities to cover the remaining gap.
3. **Approval Handling**: When an application is `APPROVED`:
   - Award status updates to `APPROVED`.
   - The system checks concurrent holding rules. If unknown, it flags: *"Concurrent holding eligibility requires official verification."*
4. **Monitoring & Change Alerts**: The `MonitoringService` compares stored content hashes against snapshots. Detected differences trigger high-severity notifications (`DEADLINE_CHANGED`, `DOCUMENT_REQUIREMENT_CHANGED`, etc.) linking directly to the affected application.

---

## 7. Security Hardening

- **Password Storage**: Passwords hashed using PBKDF2-HMAC-SHA256 with 600,000 iterations and a 16-byte random salt. Constant-time verification prevents timing attacks.
- **Session Security & Cross-Origin Cookies**: Session tokens are signed using HMAC-SHA256 and transmitted via HttpOnly cookies. Cross-origin production deployments (Next.js on Render communicating with FastAPI on Render) configure `SameSite=None` and `Secure=True` with explicit credential allowance. Local development configures `SameSite=Lax`.
- **IDOR Protection**: The dependency `verify_student_access` checks that `student.user_id == current_user.id` on all student-scoped operations.
- **SSRF Prevention**: `PromptGuard.validate_safe_url` blocks non-HTTP/HTTPS schemes, localhost, private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8), and loopback hostnames.
- **Prompt Injection Neutralization**: `PromptGuard.defang_retrieved_content` sanitizes retrieved RAG chunks, neutralizing prompt override tokens before injecting them into prompt templates.
- **Secret Redaction**: Server-side AI provider logging implements regex sanitization to scrub Google Gemini API keys (`AIza...`) and bearer tokens from stack traces and client responses.

---

## 8. Quality Assurance & Verification

SCHOLARAi maintains end-to-end automated test and build verification across both backend and frontend layers:

### Backend Test Suite (34 Verified Tests)
The backend test suite runs via `pytest` and validates all critical security, business logic, intelligence, and integration pathways:
1. **Deterministic Matching & Cascades (7 tests — `test_block2.py`)**:
   - Scholarship discovery, filtering, and deterministic rule evaluation
   - Detailed scheme requirements and dynamic funding impact calculation
   - Duplicate application prevention
   - Shared blocker resolution and multi-application cascade unblocking
   - Deterministic next-best-action priority ranking
   - Weekly effort planning and target allocation
2. **Intelligence, Evidence & RAG Pipelines (10 tests — `test_block3.py`)**:
   - Secure user registration, authentication, and session cookie issuance
   - Verified Evidence Bank CRUD and status transitions
   - RAG knowledge retrieval and verified source citation preservation
   - Conversational assistant execution with tool calling
   - Action confirmation workflows for portfolio mutations
   - Evidence-grounded drafting and unsupported claim detection
   - Snapshot diffing, change monitoring, and high-severity alert triggering
   - Multilingual voice decoder (English, Tamil, Tanglish) with confirmation
   - Prompt injection defanging and SSRF safe-URL validation
3. **Production Hardening & AI Providers (7 tests — `test_block4.py`)**:
   - Enforcement that production security rejects default session secrets
   - Rejection of wildcard CORS in production environments
   - Production requirement for real AI API keys
   - Database URL dialect normalization (`postgresql://` vs `postgres://`)
   - OpenAI-compatible provider schema and timeout validation
   - Official Google Gemini SDK provider validation
   - Provider factory switching and secret redaction in exception logs
4. **Health & Student Domain Validation (10 tests — `test_health.py` & `test_student.py`)**:
   - Health check and root ping endpoints
   - Student profile and dynamic funding gap calculations
   - Non-negative funding gap boundary conditions when financial aid exceeds costs
   - CGPA, academic percentage, and non-negative financial value schema validations

### Frontend Typecheck & Build Validation
- **TypeScript 5 Type Safety**: Zero-error compilation verified via Next.js compiler / Turbopack (`npm run build`).
- **Route Generation**: Successfully validates static prerendering and dynamic server-rendering across all 11 client pages (`/`, `/discover`, `/discover/[id]`, `/applications`, `/documents`, `/evidence`, `/assistant`, `/goal`, `/profile`, `/login`, `/register`).

---

## 9. Honest System Boundaries & Operational Limitations

To maintain operational integrity and avoid overpromising capabilities, SCHOLARAi acknowledges the following explicit architectural boundaries:

1. **Curated Demonstration Catalog (`DEMO_DATA`)**: The current scholarship catalog contains representative demonstration opportunities with realistic criteria and deadlines. It does not represent an exhaustive live database of every active scholarship across India.
2. **No Automated Web Crawling**: The platform intentionally avoids automated, uncontrolled web scraping of government or university portals. This prevents IP banning, terms-of-service violations, and stale or malformed requirement parsing.
3. **Document Readiness vs. Binary Storage**: Document management prioritizes tracking readiness status, missing requirements, and shared application bottlenecks. Heavy cloud binary file storage and OCR parsing are not currently the primary workflow.
4. **No Automatic Government-Portal Submission**: The system acts strictly as an intelligence and preparation cockpit. It never executes automated submissions on external government portals (e.g., National Scholarship Portal, state portals). Consequential submissions remain solely under student direction.
5. **In-App Notification Engine**: Notifications and urgent deadline change alerts are delivered via the integrated notification center, unread badges, and UI alerts; external SMS and SMTP email delivery gateways are currently disabled.
