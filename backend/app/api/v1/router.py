from fastapi import APIRouter

from app.api.v1.routes.analytics import router as analytics_router
from app.api.v1.routes.attendance import router as attendance_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.employees import router as employees_router
from app.api.v1.routes.leave import router as leave_router
from app.api.v1.routes.wfh import router as wfh_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(auth_router)
api_v1_router.include_router(employees_router)
api_v1_router.include_router(attendance_router)
api_v1_router.include_router(leave_router)
api_v1_router.include_router(wfh_router)
api_v1_router.include_router(analytics_router)
