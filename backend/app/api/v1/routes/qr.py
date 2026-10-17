from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies.auth import require_admin_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.qr import (
    QRRotateRequest,
    QRSessionResponse,
)
from app.services.qr_service import (
    build_qr_payload_string,
    create_qr_session,
    get_or_create_active_session,
)

router = APIRouter(prefix="/qr", tags=["Dynamic QR"])


@router.get("/active", response_model=QRSessionResponse)
def get_active_qr_session(
    office_code: str = Query("HQ_MAIN", description="Office location code"),
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve the current active QR session for the kiosk display,
    or automatically generate a new one if expired.
    Requires administrator authorization.
    """
    session, raw_token = get_or_create_active_session(db, office_code=office_code)
    now_utc = datetime.now(timezone.utc)
    remaining = max(0, int((session.expires_at - now_utc).total_seconds()))

    return QRSessionResponse(
        session_id=session.id,
        token=raw_token,
        qr_code_payload=build_qr_payload_string(raw_token, session.office_code),
        office_code=session.office_code,
        created_at=session.created_at,
        expires_at=session.expires_at,
        remaining_seconds=remaining,
        is_active=session.is_active,
    )


@router.post(
    "/rotate",
    response_model=QRSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def rotate_qr_session(
    payload: QRRotateRequest,
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """
    Force rotation of the dynamic QR session.
    Invalidates any existing active session and generates a fresh cryptographic token.
    Requires administrator authorization.
    """
    session, raw_token = create_qr_session(
        db,
        office_code=payload.office_code,
        expire_seconds=payload.expire_seconds,
    )
    now_utc = datetime.now(timezone.utc)
    remaining = max(0, int((session.expires_at - now_utc).total_seconds()))

    return QRSessionResponse(
        session_id=session.id,
        token=raw_token,
        qr_code_payload=build_qr_payload_string(raw_token, session.office_code),
        office_code=session.office_code,
        created_at=session.created_at,
        expires_at=session.expires_at,
        remaining_seconds=remaining,
        is_active=session.is_active,
    )
