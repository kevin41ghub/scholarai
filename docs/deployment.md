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

This creates all required tables and seeds the primary baseline student (Arjun Kumar), demo credentials (`demo@scholarai.local` / `DemoStudent@2026`), 8 catalog scholarships, 2 RAG knowledge sources, and starter notifications without duplicating existing records.
