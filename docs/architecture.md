# Architecture Overview — SCHOLARAi

**Current Status: Block 2 — Core Funding & Application Intelligence**

---

## 1. Architectural Principles

1. **Separation of Concerns**: Decoupled presentation (Next.js 16), API & business logic (FastAPI), and storage (SQLAlchemy 2.0).
2. **Deterministic Intelligence**: All calculations — from funding gap to eligibility matching, deadline risk, dependency graphs, and action ranking — are deterministic, auditable, and rule-based. No LLM hallucinations dictate financial decisions.
3. **Derived State Integrity**: Derived metrics (e.g. `funding_gap`, application `progress`, `blocked_applications_count`, and `potential_funding_affected`) are calculated on demand from canonical records, eliminating stale cached calculations.
4. **Relational Cascade Propagation**: Document readiness updates propagate through the dependency graph down to application requirements and overall application completion percentages.
5. **Database Portability**: Standard SQLAlchemy 2.0 ORM patterns allow SQLite in development and seamless PostgreSQL in production.

---

## 2. System Topology

```
+-------------------------------------------------------------+
|                     Next.js 16 Client                       |
|  - React 19 + TypeScript 5 + Tailwind CSS 4                 |
|  - App Router:                                              |
|      /             -> Dashboard with portfolio summary      |
|      /discover     -> Search & rule-matched opportunities   |
|      /discover/[id]-> Funding impact & scheme requirements  |
|      /applications -> State tracker & interactive checklist |
|      /documents    -> Shared blocker & readiness management |
|      /goal         -> Portfolio goal & weekly effort planner|
|      /profile      -> Academic & financial baseline         |
+------------------------------+------------------------------+
                               |
                    REST / JSON via HTTPX Client
                               |
+------------------------------v------------------------------+
|                     FastAPI Backend                         |
|  - Routers:                                                 |
|      /api/v1/scholarships  -> Catalog, Discovery, Apply    |
|      /api/v1/applications  -> Lifecycle, Portfolio Summary |
|      /api/v1/documents     -> Document State, Cascade Sync  |
|      /api/v1/actions       -> Deterministic Next-Best-Action|
|      /api/v1/planner       -> Goal & Weekly Allocation Plan |
|      /api/v1/student       -> Profile & Funding Gap         |
|  - Engine Services:                                         |
|      EligibilityService    -> Deterministic profile matcher |
|      DependencyService     -> Cross-app dependency graph    |
|      BottleneckService     -> Blocker identification        |
|      NextBestActionService -> Urgency & impact ranking      |
|      DeadlineRiskService   -> Temporal risk classification  |
|      PlannerService        -> Time-constrained allocation   |
+------------------------------+------------------------------+
                               |
                       SQLAlchemy 2.0 ORM
                               |
+------------------------------v------------------------------+
|                     Database Engine                         |
|  - Development: SQLite (scholarai.db)                       |
|  - Production Target: PostgreSQL                            |
|  - 10 Relational Tables with Foreign Keys & Cascade Deletion|
+-------------------------------------------------------------+
```

---

## 3. Relational Schema & Entity Relationships

```
              +-------------------+
              |     students      |
              +-------------------+
              | id (PK)           |
              | name              |
              | email (UNIQ)      |
              | phone             |
              +---------+---------+
                        |
       +----------------+----------------+----------------+
       | 1              | 1              | 1              | 1
+------v------+  +------v------+  +------v------+  +------v------+
|student_prof |  |funding_prof |  |  documents  |  |planner_goals|
+-------------+  +-------------+  +-------------+  +-------------+
|id           |  |id           |  |id           |  |id           |
|student_id   |  |student_id   |  |student_id   |  |student_id   |
|cgpa         |  |annual_cost  |  |name         |  |target_fund  |
|course, year |  |existing_aid |  |doc_type     |  |weekly_hours |
|state, gender|  |family_income|  |status       |  |timeline     |
+-------------+  +-------------+  +------+------+  +-------------+
                                         |
                                         | 1 (referenced by)
                                         |
                        +----------------v-------------------+
                        |       application_requirements      |
                        +------------------------------------+
                        | id (PK)                            |
                        | application_id (FK)                |
                        | document_id (FK, nullable)         |
                        | name, document_type, status        |
                        +-----------------+------------------+
                                          |
                                          | N
                                          |
                                          | 1
                               +----------v----------+
                               |    applications     |
                               +---------------------+
                               | id (PK)             |
                               | student_id (FK)     |
                               | scholarship_id (FK) |
                               | status, progress    |
                               +----------+----------+
                                          |
                                          | N
                                          |
                                          | 1
                               +----------v----------+
                               |    scholarships     |
                               +---------------------+
                               | id (PK)             |
                               | name, provider      |
                               | amount, deadline    |
                               | verification_status |
                               +----------+----------+
                                          |
                                          | 1
                                          |
                         +----------------+----------------+
                         | N                               | N
              +----------v----------+           +----------v----------+
              |  eligibility_rules  |           |scholarship_requirem.|
              +---------------------+           +---------------------+
              | id, scholarship_id  |           | id, scholarship_id  |
              | rule_type, criteria |           | name, document_type |
              | operator, is_mand.  |           | is_required, type   |
              +---------------------+           +---------------------+
```

---

## 4. Key Engines & Deterministic Algorithms

### A. Document Cascade Unblocking
When a document status is updated (e.g. from `MISSING` to `AVAILABLE` or `VERIFIED`):
1. The `DependencyService.sync_document_to_requirements` locates all `ApplicationRequirement` records for the student where `document_type == document.document_type`.
2. Sets `requirement.status = document.status` and binds `requirement.document_id = document.id`.
3. For each affected application:
   $$\text{progress} = \text{round}\left(\frac{\text{completed\_required\_items}}{\text{total\_required\_items}} \times 100.0, 1\right)$$
4. If `progress == 100.0` and `status == "IN_PROGRESS"`, the application automatically transitions to `READY`.

### B. Shared Blocker Detection
A document is classified as a **Shared Blocker** if:
$$\text{document.status} \in \{\text{'MISSING'}, \text{'NEEDS\_VERIFICATION'}\} \quad \land \quad \text{blocked\_applications\_count} \ge 1$$
Its impact is weighted by:
$$\text{Potential Funding Affected} = \sum_{a \in \text{Blocked Apps}} \text{scholarship\_amount}(a)$$

### C. Time-Constrained Effort Allocation Heuristic
Given student's available hours $H$:
1. If a primary shared blocker exists, allocate $\min(2.0, H)$ hours to resolving it.
2. For remaining hours, allocate $\min(1.5, H_{\text{left}})$ hours to each active application sorted by deadline urgency.
3. Any residual time is allocated to strategy review and discovery.
