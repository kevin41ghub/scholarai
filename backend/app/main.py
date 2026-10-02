from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import SessionLocal, get_db
from app.db.init_db import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("scholarai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables are created and demo student is seeded
    logger.info("Initializing database and verifying seed data...")
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()
    yield
    # Shutdown
    logger.info("Shutting down SCHOLARAi API...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Student Funding & Application Intelligence API — Phase 1 Foundation",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Root health endpoint matching exact specification: GET /api/health
@app.get("/api/health", tags=["Health"], summary="API Health Check")
def health_endpoint(db: Session = Depends(get_db)):
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "phase": settings.PHASE,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
        "trust_principle": "AI assists. Official sources decide. Student approves.",
    }


# Include V1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Welcome to SCHOLARAi API — Student Funding & Application Intelligence",
        "phase": settings.PHASE,
        "docs_url": "/docs",
        "health_check": "/api/health",
        "trust_principle": "AI assists. Official sources decide. Student approves.",
    }
