# Deployment & Operations Guide — SCHOLARAi

**Current Status: Block 4 — Production Ready & Deployment Hardened**

---

## 1. System Deployment Topology

SCHOLARAi is designed as a decoupled, multi-tier web application ready for modern cloud environments:

```
+-------------------------------------------------------------------------+
|                           User / Browser                                |
+------------------------------------+------------------------------------+
                                     |
                       HTTPS (TLS 1.3 / Port 443)
                                     |
              +----------------------+----------------------+
              |                                             |
+-------------v--------------+               +--------------v-------------+
|    Next.js 16 Web Client   |               |     FastAPI REST API       |
|    - Vercel / Render Web   |               |    - Render / Fly.io / ECS |
|    - Port: 3000 / 443      |               |    - Port: 8000 / 443      |
|    - Static & SSR Pages    |               |    - 16 Controlled Tools   |
+-------------+--------------+               +--------------+-------------+
              |                                             |
              +----------- HttpOnly Cookie / JSON --------->+
                                                            |
                                             SQLAlchemy 2.0 Connection Pool
                                                            |
                                             +--------------v-------------+
                                             |     Managed PostgreSQL     |
                                             |  - Supabase / Neon / RDS   |
                                             |  - Port: 5432              |
                                             +----------------------------+
```

---

## 2. Environment Variables & Production Security Checklist

### Backend Configuration (`backend/.env`)

| Variable | Development Default | Production Requirement | Purpose |
|---|---|---|---|
| `PROJECT_NAME` | `"SCHOLARAi API"` | `"SCHOLARAi API"` | API title in healthcheck & docs |
| `ENVIRONMENT` | `"development"` | `"production"` | Activates strict security checks & disabled debug traces |
| `DEBUG` | `True` | `False` | Disables verbose exception disclosure |
| `DATABASE_URL` | `sqlite:///./scholarai.db` | `postgresql://user:pass@host:5432/db` | Production relational database (PostgreSQL 14+) |
| `AUTH_SECRET` | `dev-secret-key...` | `openssl rand -hex 32` | **Must change in production!** Validates session signatures |
| `CORS_ORIGINS` | `http://localhost:3000` | `https://scholarai.yourdomain.com` | **Never use `*`!** Exact frontend origin with credentials |
| `AI_PROVIDER` | `"demo"` | `"demo"` / `"openai"` / `"groq"` | Controls AI provider engine |
| `AI_API_KEY` | `""` | `sk-...` | Secret API key for real AI providers (never logged) |
| `AI_MODEL` | `"demo-scholar-v1"` | `"gpt-4o-mini"` / `"llama-3.1-70b"` | LLM model identifier |
| `AI_BASE_URL` | `""` | `https://api.openai.com/v1` | Optional custom OpenAI-compatible endpoint |

### Frontend Configuration (`frontend/.env.local`)

| Variable | Development Default | Production Requirement | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | `https://api.scholarai.yourdomain.com` | Backend API base URL consumed by browser client |
| `NEXT_PUBLIC_APP_ENV` | `"development"` | `"production"` | Client runtime environment |

---

## 3. Local Docker Compose Deployment

To launch the complete stack locally with a real PostgreSQL database:

```bash
# 1. Start all containers (Postgres, Backend, Frontend)
docker-compose up --build -d

# 2. Inspect running services
docker-compose ps

# 3. View live logs
docker-compose logs -f backend

# 4. Access applications:
#    - Frontend: http://localhost:3000
#    - Backend Health: http://localhost:8000/api/health
#    - API Documentation: http://localhost:8000/docs
```

---

## 4. Cloud Deployment (Render Blueprint)

The repository includes a ready-to-use [`render.yaml`](file:///c:/Users/kevin/.gemini/antigravity/scratch/scholarai/render.yaml) blueprint:

1. Push your repository to GitHub (following Block 4 review).
2. Log into **Render** (`https://dashboard.render.com`).
3. Click **New +** $\rightarrow$ **Blueprint**.
4. Select your SCHOLARAi repository.
5. Render will automatically provision:
   - A managed PostgreSQL database (`scholarai-postgres`)
   - The FastAPI backend service (`scholarai-api`) with health checks
   - The Next.js web application (`scholarai-web`)
6. Database migration and initial canonical seeds run automatically on deploy via `python scripts/bootstrap_db.py`.

---

## 5. Health Checks & Uptime Monitoring

- **Health Check URL**: `GET /api/health`
- **Expected Status Code**: `200 OK`
- **Response Format**:
  ```json
  {
    "status": "healthy",
    "service": "SCHOLARAi API",
    "version": "0.4.0",
    "phase": "Block 4 — Production Ready",
    "environment": "production",
    "database": "connected",
    "trust_principle": "AI assists. Official sources decide. Student approves."
  }
  ```
- **Uptime Monitoring**: Configure services like UptimeRobot, Pingdom, or BetterUptime to ping `/api/health` every 60 seconds.

---

## 6. Database Migration & Bootstrapping

To manually bootstrap or verify the database schema:

```bash
cd backend
python scripts/bootstrap_db.py
```

This creates all required tables and seeds the primary baseline student (Arjun Kumar), demo credentials (`demo@scholarai.local` / `DemoStudent@2026`), 11 verified Tamil Nadu scholarship dossiers, 2 RAG knowledge sources, and starter notifications without duplicating existing records.

---

## 7. Rollback Plan & Emergency Recovery Procedure

### 7.1 Principle of Additive Schema Migrations
All database migrations in SCHOLARAi are designed to be **backward-compatible and strictly additive**:
- New columns are added with default values or `nullable=True`.
- Performance indexes are created using `CREATE INDEX IF NOT EXISTS`.
- Legacy demo records are retired (`status = 'INACTIVE'`, `verification_status = 'RETIRED_DEMO'`) rather than deleted, preserving historical foreign keys and application links.
- No existing columns or tables are deleted or renamed.

**Result**: If an application bug is discovered post-deploy, the application code can be rolled back to the previous release commit or Render deployment snapshot immediately **without requiring a destructive database rollback**.

### 7.2 Pre-Release Snapshot Safeguard
Before initiating any production release or schema bootstrap, always capture a verified database snapshot:

```bash
# 1. Take a timestamped logical backup of the production database
pg_dump "$DATABASE_URL" --format=custom --file="scholarai_pre_release_$(date +%Y%m%d_%H%M%S).dump"

# 2. Verify snapshot size and readability
pg_restore --list "scholarai_pre_release_$(date +%Y%m%d_%H%M%S).dump" | head -n 20
```

### 7.3 Emergency Application Rollback Procedure
If a release-blocking regression occurs in production:

1. **Rollback Web Services on Render**:
   - Navigate to **Render Dashboard** $\rightarrow$ **scholarai-api** $\rightarrow$ **Events**.
   - Select the previous stable deployment and click **Rollback to this deploy**.
   - Repeat for **scholarai-web** to ensure client-server protocol parity.
2. **Verify Service Health**:
   - Request `GET https://api.scholarai.yourdomain.com/api/health` to confirm `status: "healthy"` and `database: "connected"`.
   - Verify that all active student applications remain visible and intact.

### 7.4 Safe Data Recovery Guardrails
> [!CAUTION]
> **Strictly Prohibited**: Never execute destructive commands such as `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, or `pg_restore --clean` against the production database without verified offsite snapshots and peer authorization.

If catastrophic data corruption is ever encountered:
1. **Never restore blindly over production**.
2. Provision a temporary, isolated staging database.
3. Restore the pre-release snapshot into the isolated staging database:
   ```bash
   pg_restore --dbname="$STAGING_DATABASE_URL" "scholarai_pre_release_<TIMESTAMP>.dump"
   ```
4. Verify record integrity (applications, documents, students) on the staging database.
5. Selectively export and patch only the corrupted records back to production via audited SQL scripts.
