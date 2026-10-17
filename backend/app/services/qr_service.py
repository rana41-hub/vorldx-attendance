import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models.qr_session import QRSession

# Ephemeral in-memory cache to retain active raw tokens for kiosk display
# Format: {office_code: {"session_id": int, "raw_token": str, "expires_at": datetime}}
_ACTIVE_TOKEN_CACHE: Dict[str, dict] = {}


def hash_qr_token(token: str) -> str:
    """Generate SHA-256 hex digest for secure storage and comparison."""
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()


def create_qr_session(
    db: Session,
    office_code: str = "HQ_MAIN",
    expire_seconds: Optional[int] = None,
) -> Tuple[QRSession, str]:
    """
    Generate an unpredictable QR token and persist its SHA-256 hash.
    Deactivates any existing active session for this office.
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_qr_token(raw_token)

    # Invalidate previous active sessions for this office
    db.execute(
        update(QRSession)
        .where(QRSession.office_code == office_code, QRSession.is_active.is_(True))
        .values(is_active=False)
    )

    lifetime = expire_seconds or settings.QR_CODE_EXPIRATION_SECONDS
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(seconds=lifetime)

    session = QRSession(
        token_hash=token_hash,
        office_code=office_code,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Cache raw token for active kiosk display
    _ACTIVE_TOKEN_CACHE[office_code] = {
        "session_id": session.id,
        "raw_token": raw_token,
        "expires_at": expires_at,
    }

    return session, raw_token


def get_or_create_active_session(
    db: Session,
    office_code: str = "HQ_MAIN",
) -> Tuple[QRSession, str]:
    """
    Retrieve current unexpired active session or automatically rotate/create a new one.
    """
    now_utc = datetime.now(timezone.utc)
    session = db.scalar(
        select(QRSession)
        .where(
            QRSession.office_code == office_code,
            QRSession.is_active.is_(True),
            QRSession.expires_at > now_utc,
        )
        .order_by(QRSession.id.desc())
        .limit(1)
    )

    cached = _ACTIVE_TOKEN_CACHE.get(office_code)
    if session and cached and cached["session_id"] == session.id and cached["expires_at"] > now_utc:
        return session, cached["raw_token"]

    # Either no active session, expired, or server restarted without cache -> rotate fresh session
    return create_qr_session(db, office_code=office_code)


def validate_qr_token(
    db: Session,
    raw_token: str,
    office_code: Optional[str] = None,
) -> QRSession:
    """
    Validate a client-submitted QR token against stored session hashes.
    Verifies existence, active status, expiration, and office scope.
    """
    if not raw_token or not raw_token.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR token is missing or empty.",
        )

    clean_token = raw_token.strip()

    # Support JSON formatted payloads scanned directly from the display screen
    # e.g., {"type": "VORLDX_OFFICE_QR", "token": "...", "office": "HQ_MAIN"}
    if clean_token.startswith("{") and clean_token.endswith("}"):
        try:
            parsed = json.loads(clean_token)
            if isinstance(parsed, dict) and "token" in parsed:
                clean_token = parsed["token"].strip()
                if not office_code and "office" in parsed:
                    office_code = parsed["office"]
        except Exception:
            pass

    token_hash = hash_qr_token(clean_token)
    session = db.scalar(
        select(QRSession).where(QRSession.token_hash == token_hash)
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid QR code. Please scan the current code displayed on the office screen.",
        )

    if not session.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR code has been rotated or revoked. Please scan the latest code on the display.",
        )

    now_utc = datetime.now(timezone.utc)
    if session.expires_at <= now_utc:
        session.is_active = False
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR code has expired. Please scan the current code on the office display.",
        )

    if office_code and session.office_code != office_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"QR code belongs to office '{session.office_code}', not '{office_code}'.",
        )

    return session


def build_qr_payload_string(token: str, office_code: str) -> str:
    """Standardized JSON payload string embedded in display QR codes."""
    return json.dumps({
        "type": "VORLDX_OFFICE_QR",
        "token": token,
        "office": office_code,
    }, separators=(",", ":"))
