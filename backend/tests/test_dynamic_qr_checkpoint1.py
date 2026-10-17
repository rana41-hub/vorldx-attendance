"""Automated Tests for Day 6 Checkpoint 1:
Backend Dynamic QR Session Infrastructure.

Validates:
1. Cryptographic token generation and SHA-256 hash storage.
2. Active QR session retrieval and automatic rotation upon expiry.
3. Forced rotation invalidating previous tokens.
4. Expiration rejection on token validation.
5. Role-based authorization: Admin-only access to /qr/active and /qr/rotate.
6. Attendance check-in integration requiring authentication and rejecting invalid/expired tokens.
7. Multi-employee check-in using the same active kiosk token during its validity window.
"""
import json
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.config import settings
from app.database import SessionLocal
from app.models.attendance import AttendanceRecord
from app.models.employee import Employee
from app.models.enums import AttendanceStatus
from app.models.qr_session import QRSession
from app.models.user import User
from app.services.qr_service import (
    create_qr_session,
    hash_qr_token,
    validate_qr_token,
)


@pytest.fixture(autouse=True)
def cleanup_checkpoint1_test_records():
    """Isolate tests and prevent test record accumulation in the PostgreSQL database."""
    db = SessionLocal()
    initial_att_ids = {a.id for a in db.query(AttendanceRecord.id).all()}
    initial_emp_ids = {e.id for e in db.query(Employee.id).all()}
    db.close()

    yield

    db = SessionLocal()
    try:
        new_atts = (
            db.query(AttendanceRecord)
            .filter(~AttendanceRecord.id.in_(initial_att_ids))
            .all()
            if initial_att_ids
            else []
        )
        for a in new_atts:
            db.delete(a)

        new_emps = (
            db.query(Employee).filter(~Employee.id.in_(initial_emp_ids)).all()
            if initial_emp_ids
            else []
        )
        for e in new_emps:
            uid = e.user_id
            db.delete(e)
            if uid:
                u = db.get(User, uid)
                if u:
                    db.delete(u)

        db.commit()
    finally:
        db.close()


# ============================================================================
# TEST HELPERS
# ============================================================================


def get_admin_auth(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    token = res.json()["access_token"]
    return {"token": token, "headers": {"Authorization": f"Bearer {token}"}}


def create_test_employee(client, prefix="QRT"):
    unique_code = f"VX-{prefix}-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "QR",
            "last_name": f"Tester-{unique_code}",
            "department": "Engineering",
            "designation": "Software Engineer",
        },
    )
    assert emp_res.status_code == 201, f"Employee creation failed: {emp_res.text}"
    emp_id = emp_res.json()["id"]

    email = f"qr_{unique_code.lower()}@vorldx.com"
    act_res = client.post(
        "/api/v1/auth/activate",
        json={
            "employee_code": unique_code,
            "email": email,
            "password": "ValidPassword@123",
        },
    )
    assert act_res.status_code == 201, f"Employee activation failed: {act_res.text}"
    token = act_res.json()["access_token"]

    return {
        "id": emp_id,
        "code": unique_code,
        "email": email,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


# ============================================================================
# 1. TOKEN GENERATION & HASH STORAGE
# ============================================================================


def test_qr_token_generation_and_storage():
    """
    Verifies that tokens are cryptographically generated and only their SHA-256
    hash is persisted in the PostgreSQL qr_sessions table.
    """
    db = SessionLocal()
    try:
        session, raw_token = create_qr_session(db, office_code="HQ_MAIN", expire_seconds=30)
        assert len(raw_token) >= 32
        assert session.id is not None
        assert session.token_hash == hash_qr_token(raw_token)
        assert session.is_active is True
        assert session.office_code == "HQ_MAIN"
        assert session.expires_at > datetime.now(timezone.utc)

        # Confirm the raw token is NOT stored anywhere in the database record
        persisted = db.get(QRSession, session.id)
        assert persisted is not None
        assert not hasattr(persisted, "token")
        assert persisted.token_hash == hash_qr_token(raw_token)
    finally:
        db.close()


# ============================================================================
# 2. ACTIVE SESSION ENDPOINT & AUTO ROTATION
# ============================================================================


def test_get_active_qr_session_and_caching(client):
    """
    GET /api/v1/qr/active returns the active session and valid QR code payload.
    Calling it repeatedly returns the same active session until expiration.
    """
    admin = get_admin_auth(client)

    res1 = client.get("/api/v1/qr/active", headers=admin["headers"])
    assert res1.status_code == 200
    data1 = res1.json()

    assert "token" in data1
    assert "qr_code_payload" in data1
    assert data1["office_code"] == "HQ_MAIN"
    assert data1["remaining_seconds"] > 0
    assert data1["is_active"] is True

    payload = json.loads(data1["qr_code_payload"])
    assert payload["type"] == "VORLDX_OFFICE_QR"
    assert payload["token"] == data1["token"]
    assert payload["office"] == "HQ_MAIN"

    # Subsequent call within lifetime returns the exact same active token
    res2 = client.get("/api/v1/qr/active", headers=admin["headers"])
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["session_id"] == data1["session_id"]
    assert data2["token"] == data1["token"]


# ============================================================================
# 3. FORCED ROTATION & OLD TOKEN INVALIDATION
# ============================================================================


def test_qr_session_rotation(client):
    """
    POST /api/v1/qr/rotate invalidates the prior active session and generates
    a brand new session and token. The old token can no longer be validated.
    """
    admin = get_admin_auth(client)

    # 1. Get initial session
    init_res = client.get("/api/v1/qr/active", headers=admin["headers"])
    assert init_res.status_code == 200
    old_data = init_res.json()
    old_token = old_data["token"]
    old_session_id = old_data["session_id"]

    # 2. Rotate session
    rot_res = client.post(
        "/api/v1/qr/rotate",
        json={"office_code": "HQ_MAIN", "expire_seconds": 30},
        headers=admin["headers"],
    )
    assert rot_res.status_code == 201
    new_data = rot_res.json()
    new_token = new_data["token"]
    new_session_id = new_data["session_id"]

    assert new_session_id != old_session_id
    assert new_token != old_token

    # 3. Verify in DB that old session is marked is_active = False
    db = SessionLocal()
    try:
        old_rec = db.get(QRSession, old_session_id)
        assert old_rec.is_active is False

        new_rec = db.get(QRSession, new_session_id)
        assert new_rec.is_active is True

        # 4. Old token fails validation
        with pytest.raises(Exception) as exc_info:
            validate_qr_token(db, old_token)
        assert "rotated or revoked" in str(exc_info.value).lower()

        # 5. New token validates cleanly
        valid_sess = validate_qr_token(db, new_token)
        assert valid_sess.id == new_session_id
    finally:
        db.close()


# ============================================================================
# 4. EXPIRATION REJECTION
# ============================================================================


def test_qr_session_expiration_rejection(client):
    """
    Verifies that a session past its expiration timestamp is rejected
    and automatically deactivated.
    """
    db = SessionLocal()
    try:
        # Create an already expired session (-5 seconds)
        session, raw_token = create_qr_session(db, office_code="HQ_MAIN", expire_seconds=-5)
        assert session.expires_at < datetime.now(timezone.utc)

        # Validation must reject with HTTP 400
        with pytest.raises(Exception) as exc_info:
            validate_qr_token(db, raw_token)
        assert "expired" in str(exc_info.value).lower()

        # Confirm session is now flagged is_active=False
        persisted = db.get(QRSession, session.id)
        assert persisted.is_active is False
    finally:
        db.close()


# ============================================================================
# 5. AUTHORIZATION CONTROLS
# ============================================================================


def test_qr_endpoints_role_enforcement(client):
    """
    Verifies role-based access control:
    - Unauthenticated callers are rejected with 401.
    - Employees are rejected with 403 (kiosk tokens must not be readable by employees programmatically).
    - Administrators have full access to active sessions and rotation.
    """
    emp = create_test_employee(client, prefix="ROLA")

    # 1. Unauthenticated requests -> 401
    assert client.get("/api/v1/qr/active").status_code == 401
    assert client.post("/api/v1/qr/rotate", json={"office_code": "HQ_MAIN"}).status_code == 401

    # 2. Employee requests -> 403 Forbidden
    emp_active = client.get("/api/v1/qr/active", headers=emp["headers"])
    assert emp_active.status_code == 403
    assert "admin privileges required" in emp_active.json()["detail"].lower()

    emp_rot = client.post(
        "/api/v1/qr/rotate",
        json={"office_code": "HQ_MAIN"},
        headers=emp["headers"],
    )
    assert emp_rot.status_code == 403

    # 3. Admin requests -> 200 / 201
    admin = get_admin_auth(client)
    assert client.get("/api/v1/qr/active", headers=admin["headers"]).status_code == 200
    assert (
        client.post(
            "/api/v1/qr/rotate",
            json={"office_code": "HQ_MAIN"},
            headers=admin["headers"],
        ).status_code
        == 201
    )


# ============================================================================
# 6. ATTENDANCE CHECK-IN INTEGRATION & VALIDATION
# ============================================================================


def test_check_in_with_valid_dynamic_qr_token(client):
    """
    Authenticated employee checks in using an active dynamic QR token.
    1. Valid token succeeds with 201 Created.
    2. AttendanceRecord source is recorded as DYNAMIC_QR_HQ_MAIN.
    """
    admin = get_admin_auth(client)
    emp = create_test_employee(client, prefix="CHK")

    # Get active token
    qr_res = client.get("/api/v1/qr/active", headers=admin["headers"])
    token = qr_res.json()["token"]

    # Check in
    check_in_res = client.post(
        "/api/v1/attendance/check-in",
        json={
            "employee_id": emp["id"],
            "qr_token": token,
        },
        headers=emp["headers"],
    )
    assert check_in_res.status_code == 201
    data = check_in_res.json()
    assert data["employee_id"] == emp["id"]
    assert data["source"] == "DYNAMIC_QR_HQ_MAIN"
    assert data["status"] == "PRESENT"


def test_check_in_rejection_for_invalid_and_expired_qr_tokens(client):
    """
    Verifies that attendance check-in rejects:
    1. Forged / non-existent QR token -> 400.
    2. Expired QR token -> 400.
    3. QR token without authentication -> 401.
    """
    emp = create_test_employee(client, prefix="REJ")

    # 1. Forged token
    forged_res = client.post(
        "/api/v1/attendance/check-in",
        json={
            "employee_id": emp["id"],
            "qr_token": "FORGED_NON_EXISTENT_TOKEN_12345",
        },
        headers=emp["headers"],
    )
    assert forged_res.status_code == 400
    assert "invalid qr code" in forged_res.json()["detail"].lower()

    # 2. Expired token
    db = SessionLocal()
    try:
        _, expired_token = create_qr_session(db, office_code="HQ_MAIN", expire_seconds=-10)
    finally:
        db.close()

    expired_res = client.post(
        "/api/v1/attendance/check-in",
        json={
            "employee_id": emp["id"],
            "qr_token": expired_token,
        },
        headers=emp["headers"],
    )
    assert expired_res.status_code == 400
    assert "expired" in expired_res.json()["detail"].lower()

    # 3. QR token submission without Authorization header -> 401
    admin = get_admin_auth(client)
    qr_res = client.get("/api/v1/qr/active", headers=admin["headers"])
    valid_token = qr_res.json()["token"]

    unauth_res = client.post(
        "/api/v1/attendance/check-in",
        json={
            "employee_id": emp["id"],
            "qr_token": valid_token,
        },
    )
    assert unauth_res.status_code == 401
    assert "authentication required" in unauth_res.json()["detail"].lower()


# ============================================================================
# 7. MULTI-EMPLOYEE CHECK-IN ON SAME ACTIVE KIOSK TOKEN
# ============================================================================


def test_multiple_employees_check_in_with_same_active_kiosk_qr(client):
    """
    Validates the real-world office kiosk workflow:
    Multiple employees arriving in the lobby during the same 30-second window
    scan the same active QR code from the screen.
    Both must succeed without invalidating each other.
    """
    admin = get_admin_auth(client)
    emp1 = create_test_employee(client, prefix="ML1")
    emp2 = create_test_employee(client, prefix="ML2")

    # Get active session from kiosk
    qr_res = client.get("/api/v1/qr/active", headers=admin["headers"])
    shared_token = qr_res.json()["token"]

    # Employee 1 checks in
    res1 = client.post(
        "/api/v1/attendance/check-in",
        json={"employee_id": emp1["id"], "qr_token": shared_token},
        headers=emp1["headers"],
    )
    assert res1.status_code == 201
    assert res1.json()["source"] == "DYNAMIC_QR_HQ_MAIN"

    # Employee 2 checks in using the same displayed QR code
    res2 = client.post(
        "/api/v1/attendance/check-in",
        json={"employee_id": emp2["id"], "qr_token": shared_token},
        headers=emp2["headers"],
    )
    assert res2.status_code == 201
    assert res2.json()["source"] == "DYNAMIC_QR_HQ_MAIN"

    # After rotation, neither employee can reuse that old token on a subsequent day
    rot_res = client.post("/api/v1/qr/rotate", json={"office_code": "HQ_MAIN"}, headers=admin["headers"])
    assert rot_res.status_code == 201

    emp3 = create_test_employee(client, prefix="ML3")
    res3 = client.post(
        "/api/v1/attendance/check-in",
        json={"employee_id": emp3["id"], "qr_token": shared_token},
        headers=emp3["headers"],
    )
    assert res3.status_code == 400
    assert "rotated or revoked" in res3.json()["detail"].lower()
