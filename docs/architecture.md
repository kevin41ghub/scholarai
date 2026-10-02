# Architecture Overview — SCHOLARAi

**Current Status: Block 3 — Advanced AI, Evidence, RAG & Adaptive Intelligence**

---

## 1. Architectural & Trust Principles

1. **"AI assists. Official sources decide. Student approves."** — Core operating philosophy across all layers. The AI never guarantees eligibility, awards, or deadlines; never silently modifies data; and never auto-submits applications.
2. **Separation of Concerns**: Decoupled presentation (Next.js 16), API & business logic (FastAPI), secure authentication, deterministic engines, controlled AI tools, and storage (SQLAlchemy 2.0).
3. **Controlled AI Execution via Tools**: The LLM provider (or deterministic fallback) has **zero direct SQL/database access**. All AI operations route through 16 strictly typed, validated backend tools.
4. **Evidence Grounding & Hallucination Prevention**: Student drafts and claims are verified against the Verified Evidence Bank and student profile. Unsupported claims are flagged and never silently invented.
5. **Deterministic Intelligence & Cascades**: Financial gap metrics, rule-based eligibility, deadline risk, dependency graphs, and action ranking remain deterministic, auditable, and unaffected by LLM variance.
6. **Multi-Tenant Security & IDOR Defense**: All student-specific endpoints require authentication and enforce student-level scoping via `verify_student_access`. Passwords use salted PBKDF2-HMAC-SHA256 (600,000 iterations); sessions use signed HttpOnly cookies.
7. **SSRF & Prompt Injection Defenses**: URLs are validated against private/localhost IP ranges and non-HTTP schemes. Retrieved RAG text is quarantined as untrusted data before prompt construction.

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
|      Session Middleware    -> Signed HttpOnly cookie tokens                       |
|      IDOR Protection       -> verify_student_access scoping on all student routes  |
|  - Block 3 Routers:                                                               |
|      /api/v1/evidence      -> Evidence Bank CRUD & source tracking                |
|      /api/v1/assistant     -> Conversational Assistant (tools, confirmations)     |
|      /api/v1/applications  -> Drafting, review, evidence-grounding check         |
|      /api/v1/knowledge     -> RAG Sources, documents, chunk retrieval             |
|      /api/v1/notifications -> Notification Engine (unread, severity, actions)     |
|      /api/v1/voice         -> Voice Decoder (English, Tamil, Tanglish)            |
|      /api/v1/monitoring    -> Source change detection & urgent alerts             |
|  - Block 1 & 2 Deterministic Routers:                                             |
|      /api/v1/scholarships  -> Catalog, Discovery, Apply                           |
|      /api/v1/documents     -> Document State, Cascade Sync                        |
|      /api/v1/actions       -> Deterministic Next-Best-Action ranking              |
|      /api/v1/planner       -> Goal & Weekly Allocation Plan                       |
|      /api/v1/student       -> Profile & Dynamic Funding Gap                       |
|  - Intelligence & RAG Services:                                                   |
|      AIProvider (Abstract) -> Modular LLM interface (DemoAIProvider fallback)     |
|      AIToolkit             -> 16 controlled tools (no raw SQL exposure)           |
|      PromptGuard           -> Prompt injection defanging & SSRF URL validator     |
|      EvidenceService       -> Verified student asset management                   |
|      RAGKnowledgeService   -> Source verification, chunking, citation preservation |
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
|  - Production: PostgreSQL compatible                                              |
|  - 16 Relational Tables with Foreign Keys, Cascades & Compound Indexes            |
+-----------------------------------------------------------------------------------+
```

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

## 5. RAG Pipeline & Evidence Grounding

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

- **Password Storage**: Passwords hashed using PBKDF2-HMAC-SHA256 with 600,000 iterations and a 16-byte random salt.
- **Session Security**: Session tokens are signed using HMAC-SHA256 and transmitted via HttpOnly cookies (`SameSite=Lax`, `Secure` in production).
- **IDOR Protection**: The dependency `verify_student_access` checks that `student.user_id == current_user.id`.
- **SSRF Prevention**: `PromptGuard.validate_safe_url` blocks non-HTTP/HTTPS schemes, localhost, private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8), and loopback hostnames.
- **Prompt Injection Neutralization**: `PromptGuard.defang_retrieved_content` sanitizes retrieved RAG chunks, neutralizing prompt override tokens before injecting them into prompt templates.
