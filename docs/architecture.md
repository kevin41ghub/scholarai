# Architecture Overview — SCHOLARAi

**Current Phase: Phase 1 — Foundation**

---

## 1. Architectural Principles

1. **Separation of Concerns**: Strict decoupling between Presentation (Next.js), Application Logic (FastAPI), and Storage (SQLAlchemy/SQLite).
2. **Calculated State Integrity**: Derived financial figures like `funding_gap` are **computed on the fly** from stored canonical sources (`annual_education_cost` and `existing_support`), guaranteeing numbers never drift out of sync.
3. **Database Portability**: Clean SQLAlchemy 2.0 ORM models and standard datatypes ensure seamless zero-code-change migration from local SQLite to production PostgreSQL by updating `DATABASE_URL`.
4. **Defensive Input Validation**: Strong typing and range validation via Pydantic v2 on all inputs (CGPA, percentages, currency values).
5. **Trust Alignment**: Clear UI boundaries and messaging ensuring the platform is positioned as decision intelligence, not guaranteed entitlement.

---

## 2. System Topology

```
+-------------------------------------------------------------+
|                     Next.js 16 Client                       |
|  - React 19 + TypeScript 5                                  |
|  - Tailwind CSS 4 Styling                                   |
|  - App Router (/ , /profile , /discover , etc.)             |
|  - Live client-side calculation preview                     |
+------------------------------+------------------------------+
                               |
                        HTTP / REST (JSON)
                               |
+------------------------------v------------------------------+
|                     FastAPI Backend                         |
|  - CORS & Health Endpoints                                  |
|  - Router: /api/v1/student/me , /api/v1/student/funding     |
|  - Pydantic v2 Request/Response Serialization               |
|  - StudentService Business Layer                            |
+------------------------------+------------------------------+
                               |
                        SQLAlchemy 2.0 ORM
                               |
+------------------------------v------------------------------+
|                     Database Engine                         |
|  - Development: SQLite (scholarai.db)                       |
|  - Production Target: PostgreSQL                            |
|  - Relational Models: students, student_profiles,           |
|                       funding_profiles                      |
+-------------------------------------------------------------+
```

---

## 3. Data Schema & Relationships

```
+--------------------------------------------------------+
|                      students                          |
+--------------------------------------------------------+
| id: Integer (PK, Autoincrement)                        |
| name: String(255)                                      |
| email: String(255) [UNIQUE, INDEX]                     |
| phone: String(50) [NULLABLE]                           |
| created_at: DateTime(tz)                               |
| updated_at: DateTime(tz)                               |
+--------------------------------------------------------+
            | 1                                 | 1
            |                                   |
            | 1                                 | 1
+-----------v--------------------+  +-----------v--------------------+
|        student_profiles        |  |        funding_profiles        |
+--------------------------------+  +--------------------------------+
| id: Integer (PK)               |  | id: Integer (PK)               |
| student_id: Integer (FK, UNIQ) |  | student_id: Integer (FK, UNIQ) |
| institution: String(255)       |  | annual_education_cost: Float   |
| course: String(255)            |  | existing_support: Float        |
| year: String(50)               |  | annual_family_income: Float    |
| cgpa: Float [0.0 - 10.0]       |  | created_at: DateTime(tz)       |
| twelfth_percentage: Float [0-100]  updated_at: DateTime(tz)       |
| category: String(50)           |  +--------------------------------+
| state: String(100)             |  | Dynamic Property:              |
| created_at: DateTime(tz)       |  | funding_gap =                  |
| updated_at: DateTime(tz)       |  |   max(0, cost - support)       |
+--------------------------------+  +--------------------------------+
```

---

## 4. Calculated Metrics & Logic

### Funding Gap Formula
$$\text{funding\_gap} = \max(0, \text{annual\_education\_cost} - \text{existing\_support})$$

### Funding Progress Percentage
$$\text{progress\_percentage} = \begin{cases} 100.0, & \text{if } \text{annual\_education\_cost} \le 0 \\ \min\left(100.0, \frac{\text{existing\_support}}{\text{annual\_education\_cost}} \times 100\right), & \text{otherwise} \end{cases}$$

---

## 5. PostgreSQL Migration Path

To migrate from SQLite to PostgreSQL in production:
1. Provision a PostgreSQL instance.
2. In `backend/.env`, set:
   ```env
   DATABASE_URL=postgresql://user:password@hostname:5432/scholarai
   ```
3. Install PostgreSQL driver: `pip install psycopg2-binary` or `asyncpg`.
4. SQLAlchemy tables will automatically bind with identical DDL and relationships without requiring application rewrite.
