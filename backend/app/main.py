from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Depends, Request, status
from fastapi.responses import JSONResponse
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
    # Startup: ensure tables are created and seed data is verified
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
    description="Student Funding & Application Intelligence Platform — Autonomous Scholarship Discovery & Application Assistant",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG or settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.DEBUG or settings.ENVIRONMENT != "production" else None,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Production-hardened exception handler preventing internal stack trace disclosure
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error processing {request.method} {request.url.path}: {exc}", exc_info=True)
    if settings.ENVIRONMENT.lower() == "production":
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal server error occurred. Our engineering team has been notified."},
        )
    # In development/testing, expose readable detail
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc)},
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
        "docs_url": "/docs" if settings.DEBUG or settings.ENVIRONMENT != "production" else "Disabled in production",
        "health_check": "/api/health",
        "trust_principle": "AI assists. Official sources decide. Student approves.",
    }
