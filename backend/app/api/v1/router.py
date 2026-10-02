from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    student,
    scholarships,
    applications,
    documents,
    actions,
    planner,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(student.router, prefix="/student", tags=["Student"])
api_router.include_router(scholarships.router, prefix="/scholarships", tags=["Scholarships"])
api_router.include_router(applications.router, prefix="/applications", tags=["Applications"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(actions.router, prefix="/actions", tags=["Actions"])
api_router.include_router(planner.router, prefix="/planner", tags=["Planner"])
