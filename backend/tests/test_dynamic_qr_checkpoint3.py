"""Automated Tests for Day 6 Checkpoint 3:
Employee Mobile Dynamic QR Scanner Integration Contract & Backend Validation.

Validates:
1. Kiosk JSON payload format parsing and check-in success.
2. Server-side validation of token existence, expiry, and active state.
3. Server-side enforcement of office derivation (client office payload ignored).
4. Rejection of invalid, tampered, expired, and rotated QR tokens.
5. Rejection of duplicate same-day check-in (409 Conflict).
6. Rejection of unauthenticated dynamic QR check-in (401 Unauthorized).
7. Rejection of cross-employee spoofing (employee A checking in for employee B).
"""
import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.attendance import AttendanceRecord
from app.models.employee import Employee
from app.models.qr_session import QRSession
from app.models.user import User
from app.services.qr_service import create_qr_session, hash_qr_token


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_checkpoint3_test_records():
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


def get_admin_auth(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    token = res.json()["access_token"]
    return {"token": token, "headers": {"Authorization": f"Bearer {token}"}}


def create_test_employee(client, prefix="CP3"):
    unique_code = f"VX-{prefix}-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Scanner",
            "last_name": f"Tester-{unique_code}",
            "department": "Mobile Engineering",
            "designation": "QA Engineer",
        },
    )
    assert emp_res.status_code == 201, f"Employee creation failed: {emp_res.text}"
    emp_id = emp_res.json()["id"]

    email = f"scanner_{unique_code.lower()}@vorldx.com"
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


def test_checkpoint3_successful_kiosk_qr_payload_checkin(client):
    """
    Scenario: Employee mobile scanner scans the official JSON payload displayed
    by Admin Office Kiosk and submits qr_token with authenticated session.
    Expectation: 201 Created, source set to DYNAMIC_QR_{office_code}.
    """
    admin = get_admin_auth(client)
    emp = create_test_employee(client, prefix="KIOSK")

    # 1. Admin kiosk gets active session
    kiosk_res = client.get("/api/v1/qr/active?office_code=HQ_MAIN", headers=admin["headers"])
    assert kiosk_res.status_code == 200
    active_data = kiosk_res.json()
    raw_token = active_data["token"]
    assert raw_token is not None

    # 2. Scanner parses the kiosk display payload: {"type":"VORLDX_OFFICE_QR","token":...,"office":"HQ_MAIN"}
    # Mobile app extracts raw_token and sends it in qr_token field
    checkin_res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "source": "OFFICE_QR",
            "qr_token": raw_token,
        },
    )
    assert checkin_res.status_code == 201, f"Check-in failed: {checkin_res.text}"
    record = checkin_res.json()
    assert record["employee_id"] == emp["id"]
    assert record["source"] == "DYNAMIC_QR_HQ_MAIN"
    assert record["check_in"] is not None


def test_checkpoint3_server_side_office_derivation_tamper_proof(client):
    """
    Scenario: Client tries to spoof office identifier by passing client-supplied
    office or arbitrary source. Server must ignore client source and derive source
    strictly from the validated QRSession record.
    """
    admin = get_admin_auth(client)
    emp = create_test_employee(client, prefix="TAMPER")

    kiosk_res = client.get("/api/v1/qr/active?office_code=BRANCH_NORTH", headers=admin["headers"])
    assert kiosk_res.status_code == 200
    raw_token = kiosk_res.json()["token"]

    checkin_res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "source": "CLIENT_ATTEMPTED_SPOOF_OFFICE",
            "qr_token": raw_token,
        },
    )
    assert checkin_res.status_code == 201
    record = checkin_res.json()
    # Server overwrites client source with authenticated server-side session office
    assert record["source"] == "DYNAMIC_QR_BRANCH_NORTH"


def test_checkpoint3_rejection_of_invalid_and_arbitrary_tokens(client):
    """
    Scenario: Scanner submits invalid or non-existent token.
    Expectation: 400 Bad Request.
    """
    emp = create_test_employee(client, prefix="INVAL")

    # Arbitrary random token
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "source": "OFFICE_QR",
            "qr_token": "arbitrary_fake_token_not_in_db_1234567890",
        },
    )
    assert res.status_code == 400
    assert "Invalid QR code" in res.json()["detail"]


def test_checkpoint3_rejection_of_expired_tokens(client):
    """
    Scenario: QR token was valid 31 seconds ago but is now expired.
    Expectation: 400 Bad Request indicating QR code has expired.
    """
    emp = create_test_employee(client, prefix="EXP")

    # Manually create an already expired session in DB
    db = SessionLocal()
    try:
        session, raw_token = create_qr_session(db, office_code="HQ_MAIN", expire_seconds=30)
        session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=5)
        db.commit()
    finally:
        db.close()

    res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "source": "OFFICE_QR",
            "qr_token": raw_token,
        },
    )
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()


def test_checkpoint3_rejection_of_rotated_revoked_tokens(client):
    """
    Scenario: Admin kiosk rotates session; old token is revoked (is_active=False).
    Expectation: 400 Bad Request indicating QR code was rotated.
    """
    admin = get_admin_auth(client)
    emp = create_test_employee(client, prefix="ROTREV")

    # 1. Get active session
    res1 = client.get("/api/v1/qr/active?office_code=HQ_MAIN", headers=admin["headers"])
    old_token = res1.json()["token"]

    # 2. Force rotate
    res2 = client.post("/api/v1/qr/rotate", headers=admin["headers"], json={"office_code": "HQ_MAIN"})
    assert res2.status_code == 201

    # 3. Employee attempts check-in with old_token
    checkin_res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "source": "OFFICE_QR",
            "qr_token": old_token,
        },
    )
    assert checkin_res.status_code == 400
    assert "rotated or revoked" in checkin_res.json()["detail"].lower()


def test_checkpoint3_duplicate_checkin_protection(client):
    """
    Scenario: Employee scans active QR token, succeeds, and then tries to scan again.
    Expectation: 409 Conflict with clear duplicate message.
    """
    admin = get_admin_auth(client)
    emp = create_test_employee(client, prefix="DUP")

    kiosk_res = client.get("/api/v1/qr/active?office_code=HQ_MAIN", headers=admin["headers"])
    raw_token = kiosk_res.json()["token"]

    # First scan: Success
    res1 = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "source": "OFFICE_QR",
            "qr_token": raw_token,
        },
    )
    assert res1.status_code == 201

    # Second scan: Rejection 409
    res2 = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "source": "OFFICE_QR",
            "qr_token": raw_token,
        },
    )
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"].lower()


def test_checkpoint3_unauthenticated_request_rejection(client):
    """
    Scenario: Client submits QR token without Bearer token.
    Expectation: 401 Unauthorized.
    """
    admin = get_admin_auth(client)
    emp = create_test_employee(client, prefix="UNAUTH")

    kiosk_res = client.get("/api/v1/qr/active?office_code=HQ_MAIN", headers=admin["headers"])
    raw_token = kiosk_res.json()["token"]

    # Submit without Authorization header
    res = client.post(
        "/api/v1/attendance/check-in",
        json={
            "employee_id": emp["id"],
            "source": "OFFICE_QR",
            "qr_token": raw_token,
        },
    )
    assert res.status_code == 401
    assert "Authentication required" in res.json()["detail"]


def test_checkpoint3_cross_employee_spoofing_prevented(client):
    """
    Scenario: Employee A is logged in, but submits Employee B's employee_id with a valid QR token.
    Expectation: 403 Forbidden.
    """
    admin = get_admin_auth(client)
    emp_a = create_test_employee(client, prefix="EMPA")
    emp_b = create_test_employee(client, prefix="EMPB")

    kiosk_res = client.get("/api/v1/qr/active?office_code=HQ_MAIN", headers=admin["headers"])
    raw_token = kiosk_res.json()["token"]

    # Employee A attempts to check in for Employee B
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp_a["headers"],
        json={
            "employee_id": emp_b["id"],
            "source": "OFFICE_QR",
            "qr_token": raw_token,
        },
    )
    assert res.status_code == 403
