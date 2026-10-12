from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Authentication"])


class AuthStatusResponse(BaseModel):
    status: str
    message: str
    version: str


@router.get("/status", response_model=AuthStatusResponse)
def auth_status():
    return {
        "status": "ready",
        "message": "Authentication subsystem initialized. JWT and Argon2/Bcrypt password hashing configured for Day 2 activation.",
        "version": "v1",
    }
