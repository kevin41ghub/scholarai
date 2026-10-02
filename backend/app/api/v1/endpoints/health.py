from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.db.session import get_db

router = APIRouter()


@router.get("/health", summary="Service Health Check")
def health_check(db: Session = Depends(get_db)):
    """
    Returns service health, database connectivity status, and phase info.
    """
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
    }
