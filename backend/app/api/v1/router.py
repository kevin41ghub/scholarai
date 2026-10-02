from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    student,
    scholarships,
    applications,
    documents,
    actions,
    planner,
    auth,
    evidence,
    knowledge,
    assistant,
    notifications,
    voice,
    monitoring,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(student.router, prefix="/student", tags=["Student"])
api_router.include_router(scholarships.router, prefix="/scholarships", tags=["Scholarships"])
api_router.include_router(applications.router, prefix="/applications", tags=["Applications"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(actions.router, prefix="/actions", tags=["Actions"])
api_router.include_router(planner.router, prefix="/planner", tags=["Planner"])
api_router.include_router(evidence.router, prefix="/evidence", tags=["Evidence"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["Knowledge"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["Assistant"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(voice.router, prefix="/voice", tags=["Voice"])
api_router.include_router(monitoring.router, prefix="/monitoring", tags=["Monitoring"])
