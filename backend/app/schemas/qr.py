from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class QRSessionResponse(BaseModel):
    session_id: int
    token: str
    qr_code_payload: str
    office_code: str
    created_at: datetime
    expires_at: datetime
    remaining_seconds: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class QRRotateRequest(BaseModel):
    office_code: str = Field(default="HQ_MAIN")
    expire_seconds: Optional[int] = Field(default=None, ge=5, le=3600)


class QRValidationResponse(BaseModel):
    valid: bool
    session_id: Optional[int] = None
    office_code: Optional[str] = None
    message: str
