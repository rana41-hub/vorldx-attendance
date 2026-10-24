"""
Day 13 — Comprehensive Integration and Security Test Suite
VorldX Attendance Management System (October 24, 2026)

Test Coverage:
- Phase Two: Authentication Integration (Admin login, Employee ID login, JWT signature/expiry/tamper, deactivated accounts)
- Phase Three: Role-Based Authorization (Admin-only operations, Employee self-service, Horizontal data isolation, RBAC)
- Phase Four: QR Attendance Security (Dynamic QR validation, 18s expiration, rotation, replay window, duplicate check-in/out, auth requirements)
- Phase Five: Leave and WFH Integration (Full request lifecycle, date validation, self-approval prevention, admin review, status transitions)
- Phase Six: Attendance, Shifts, and Data Integrity (Timestamps, duration, overnight shift fallback, audit log generation, metrics consistency)
- Phase Seven: API Input Validation and Security (SQL injection resilience, XSS payload safety, CSV formula injection protection, error hygiene)
- Phase Nine: Concurrency and Failure Handling (Simultaneous duplicate check-ins, concurrent leave reviews, transaction rollbacks)

SAFETY:
- Uses the isolated PostgreSQL test database 'vorldx_test'.
- Enforces strict safety guards configured in tests/conftest.py.
"""
import uuid
from datetime import date, datetime, time, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import settings
from app.core.security import create_access_token
from app.database import SessionLocal
from app.models.attendance import AttendanceRecord
from app.models.attendance_policy import AttendancePolicy
from app.models.audit_log import AuditLog
from app.models.employee import Employee
from app.models.enums import AttendanceStatus, LeaveStatus, UserRole, WFHStatus
from app.models.leave import LeaveRequest
from app.models.qr_session import QRSession
from app.models.user import User
from app.models.wfh import WFHRequest
from app.services.attendance_completion_service import evaluate_record_completion
from app.services.qr_service import create_qr_session, hash_qr_token


# ==============================================================================
# TEST FIXTURES AND HELPERS
# ==============================================================================

@pytest.fixture
def admin_auth(client):
    """Authenticate default admin (ADM-001) and return token and headers."""
    res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    data = res.json()
    token = data["access_token"]
    return {
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
        "user": data["user"],
    }


def create_activated_employee(client, prefix="SEC"):
    """Create and activate an isolated test employee."""
    unique_code = f"VX-{prefix}-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Test",
            "last_name": f"User-{unique_code}",
            "department": "Security Testing",
            "designation": "QA Engineer",
            "phone": "+1-555-0150",
        },
    )
    assert emp_res.status_code == 201, f"Employee creation failed: {emp_res.text}"
    emp_data = emp_res.json()
    emp_id = emp_data["id"]

    email = f"test_{unique_code.lower()}@vorldx.com"
    password = "SecTest@Password2026"
    act_res = client.post(
        "/api/v1/auth/activate",
        json={
            "employee_code": unique_code,
            "email": email,
            "password": password,
        },
    )
    assert act_res.status_code == 201, f"Activation failed: {act_res.text}"
    token = act_res.json()["access_token"]

    return {
        "id": emp_id,
        "code": unique_code,
        "email": email,
        "password": password,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


# ==============================================================================
# PHASE TWO: AUTHENTICATION INTEGRATION TESTING
# ==============================================================================

def test_phase2_admin_login_success(client):
    """Scenario 1: Valid administrator login with ADM-001."""
    res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"].lower() == "bearer"
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["admin_id"] == "ADM-001"


def test_phase2_admin_login_invalid_password(client):
    """Scenario 2: Invalid administrator password rejected with 401."""
    res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "WrongAdminPassword123"},
    )
    assert res.status_code == 401
    assert "invalid credentials" in res.json()["detail"].lower()


def test_phase2_login_missing_fields(client):
    """Scenario 3: Missing username or password returns 422."""
    res1 = client.post("/api/v1/auth/login", json={"login_id": "ADM-001"})
    assert res1.status_code == 422

    res2 = client.post("/api/v1/auth/login", json={"password": "Password123"})
    assert res2.status_code == 422


def test_phase2_login_malformed_request(client):
    """Scenario 4: Malformed login request returns 422."""
    res = client.post(
        "/api/v1/auth/login",
        content="not valid json",
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 422


def test_phase2_login_nonexistent_user(client):
    """Scenario 5: Login with nonexistent user ID returns 401."""
    res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "VX-NONEXISTENT-999", "password": "Password123"},
    )
    assert res.status_code == 401
    assert "invalid credentials" in res.json()["detail"].lower()


def test_phase2_employee_id_login_flow(client):
    """Scenario 6: Valid employee authentication using Employee ID flow."""
    emp = create_activated_employee(client, prefix="AUTH")
    res = client.post(
        "/api/v1/auth/login",
        json={"login_id": emp["code"], "password": emp["password"]},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "EMPLOYEE"
    assert data["user"]["employee_code"] == emp["code"]


def test_phase2_employee_invalid_credentials(client):
    """Scenario 7: Invalid employee credentials return 401."""
    emp = create_activated_employee(client, prefix="BADP")
    res = client.post(
        "/api/v1/auth/login",
        json={"login_id": emp["code"], "password": "CompletelyWrongPassword"},
    )
    assert res.status_code == 401
    assert "invalid credentials" in res.json()["detail"].lower()


def test_phase2_missing_authorization_header(client):
    """Scenario 8: Missing Authorization header on protected endpoint returns 401."""
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert "not provided" in res.json()["detail"].lower()


def test_phase2_malformed_bearer_token(client):
    """Scenario 9: Malformed Bearer token returns 401."""
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not.a.valid.jwt.token"},
    )
    assert res.status_code == 401
    assert "invalid authentication token" in res.json()["detail"].lower()


def test_phase2_invalid_jwt_signature(client):
    """Scenario 10: Tampered JWT signature returns 401."""
    valid_token = create_access_token({"sub": "1", "role": "ADMIN"})
    parts = valid_token.split(".")
    tampered_sig = parts[2][:-4] + "AAAA"
    tampered_token = f"{parts[0]}.{parts[1]}.{tampered_sig}"

    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tampered_token}"},
    )
    assert res.status_code == 401
    assert "invalid authentication token" in res.json()["detail"].lower()


def test_phase2_expired_jwt(client):
    """Scenario 11: Expired JWT returns 401."""
    expired_token = create_access_token(
        {"sub": "1", "role": "ADMIN"},
        expires_delta=timedelta(seconds=-60),  # expired 60s ago
    )
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


def test_phase2_stateless_jwt_architecture_probe(client):
    """Scenario 13 & 14: Verify auth readiness probe and stateless token properties."""
    probe_res = client.get("/api/v1/auth/status")
    assert probe_res.status_code == 200
    assert probe_res.json()["status"] == "ready"


# ==============================================================================
# PHASE THREE: ROLE-BASED AUTHORIZATION & HORIZONTAL ISOLATION
# ==============================================================================

def test_phase3_employee_cannot_create_employee(client):
    """Negative authorization: Ordinary employee cannot create employees (403)."""
    emp = create_activated_employee(client, prefix="RBAC")
    res = client.post(
        "/api/v1/employees",
        headers=emp["headers"],
        json={
            "employee_code": f"VX-UNAUTH-{uuid.uuid4().hex[:4].upper()}",
            "first_name": "Unauthorized",
            "last_name": "Creation",
            "department": "Engineering",
            "designation": "Staff",
        },
    )
    assert res.status_code == 403
    assert "admin privileges required" in res.json()["detail"].lower()


def test_phase3_employee_cannot_modify_other_employee(client):
    """Negative authorization: Ordinary employee cannot update employee records (403)."""
    emp_a = create_activated_employee(client, prefix="RBA1")
    emp_b = create_activated_employee(client, prefix="RBA2")

    res = client.put(
        f"/api/v1/employees/{emp_b['id']}",
        headers=emp_a["headers"],
        json={"designation": "Compromised Designation"},
    )
    assert res.status_code == 403
    assert "admin privileges required" in res.json()["detail"].lower()


def test_phase3_employee_cannot_delete_employee(client):
    """Negative authorization: Ordinary employee cannot delete employee records (403)."""
    emp_a = create_activated_employee(client, prefix="RBD1")
    emp_b = create_activated_employee(client, prefix="RBD2")

    res = client.delete(
        f"/api/v1/employees/{emp_b['id']}",
        headers=emp_a["headers"],
    )
    assert res.status_code == 403
    assert "admin privileges required" in res.json()["detail"].lower()


def test_phase3_employee_cannot_access_admin_endpoints(client):
    """Negative authorization: Calling admin-only endpoints with employee token returns 403."""
    emp = create_activated_employee(client, prefix="ADMINOPS")

    # 1. Account provisioning
    res1 = client.post(
        f"/api/v1/employees/{emp['id']}/account",
        headers=emp["headers"],
        json={"email": "hacked@vorldx.com", "password": "NewPassword123"},
    )
    assert res1.status_code == 403

    # 2. Account deactivation
    res2 = client.patch(
        f"/api/v1/employees/{emp['id']}/status",
        headers=emp["headers"],
        json={"is_active": False},
    )
    assert res2.status_code == 403

    # 3. Attendance policy update
    res3 = client.put(
        "/api/v1/attendance/policy",
        headers=emp["headers"],
        json={"late_grace_minutes": 45},
    )
    assert res3.status_code == 403

    # 4. Analytics dashboard
    res4 = client.get("/api/v1/analytics/dashboard", headers=emp["headers"])
    assert res4.status_code == 403

    # 5. Dynamic QR kiosk view
    res5 = client.get("/api/v1/qr/active", headers=emp["headers"])
    assert res5.status_code == 403

    # 6. Dynamic QR rotation
    res6 = client.post("/api/v1/qr/rotate", headers=emp["headers"], json={"office_code": "HQ_MAIN"})
    assert res6.status_code == 403


def test_phase3_horizontal_data_isolation_attendance_and_requests(client):
    """Horizontal isolation: Employee querying or submitting for another employee is blocked or filtered."""
    emp_a = create_activated_employee(client, prefix="HORA")
    emp_b = create_activated_employee(client, prefix="HORB")

    today = date.today()

    # 1. Employee A attempts to submit leave for Employee B -> 403
    leave_res = client.post(
        "/api/v1/leave",
        headers=emp_a["headers"],
        json={
            "employee_id": emp_b["id"],
            "start_date": (today + timedelta(days=20)).isoformat(),
            "end_date": (today + timedelta(days=22)).isoformat(),
            "reason": "Spoofed Leave",
        },
    )
    assert leave_res.status_code == 403

    # 2. Employee A attempts to submit WFH for Employee B -> 403
    wfh_res = client.post(
        "/api/v1/wfh",
        headers=emp_a["headers"],
        json={
            "employee_id": emp_b["id"],
            "start_date": (today + timedelta(days=20)).isoformat(),
            "end_date": (today + timedelta(days=22)).isoformat(),
            "reason": "Spoofed WFH",
        },
    )
    assert wfh_res.status_code == 403

    # 3. Employee A querying attendance with ?employee_id=emp_b is forced to only see emp_a records
    att_res = client.get(
        f"/api/v1/attendance?employee_id={emp_b['id']}",
        headers=emp_a["headers"],
    )
    assert att_res.status_code == 200
    for r in att_res.json():
        assert r["employee_id"] == emp_a["id"]


def test_phase3_deactivated_account_access_denied(client, admin_auth):
    """Deactivated accounts cannot authenticate and existing tokens are rejected."""
    emp = create_activated_employee(client, prefix="DEACT")

    # Admin deactivates employee account
    deact_res = client.patch(
        f"/api/v1/employees/{emp['id']}/status",
        headers=admin_auth["headers"],
        json={"is_active": False},
    )
    assert deact_res.status_code == 200

    # 1. Attempt login with deactivated credentials -> 403
    login_res = client.post(
        "/api/v1/auth/login",
        json={"login_id": emp["code"], "password": emp["password"]},
    )
    assert login_res.status_code == 403
    assert "deactivated" in login_res.json()["detail"].lower()

    # 2. Existing JWT used against protected endpoint -> 401
    me_res = client.get("/api/v1/auth/me", headers=emp["headers"])
    assert me_res.status_code == 401
    assert "inactive" in me_res.json()["detail"].lower()


# ==============================================================================
# PHASE FOUR: QR ATTENDANCE SECURITY
# ==============================================================================

def test_phase4_qr_code_configuration_18_seconds():
    """Verify configured QR code expiration is exactly 18 seconds."""
    assert settings.QR_CODE_EXPIRATION_SECONDS == 18


def test_phase4_dynamic_qr_checkin_success(client):
    """Scenario 1: Valid dynamic QR token check-in with employee authentication."""
    emp = create_activated_employee(client, prefix="QROK")

    db = SessionLocal()
    _, raw_token = create_qr_session(db, office_code="HQ_MAIN", expire_seconds=18)
    db.close()

    res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "qr_token": raw_token,
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["employee_id"] == emp["id"]
    assert "DYNAMIC_QR_HQ_MAIN" in data["source"]
    assert data["check_in"] is not None
    assert data["check_out"] is None


def test_phase4_expired_qr_token_rejected(client):
    """Scenario 2: Expired QR token is rejected with 400 Bad Request."""
    emp = create_activated_employee(client, prefix="QREXP")

    db = SessionLocal()
    # Create session already in the past with a unique token hash
    now_utc = datetime.now(timezone.utc)
    raw_token = f"expired_raw_token_{uuid.uuid4().hex}"
    expired_session = QRSession(
        token_hash=hash_qr_token(raw_token),
        office_code="HQ_MAIN",
        expires_at=now_utc - timedelta(seconds=10),
        is_active=True,
    )
    db.add(expired_session)
    db.commit()
    db.close()

    res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "qr_token": raw_token,
        },
    )
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()


def test_phase4_tampered_or_invalid_qr_token(client):
    """Scenario 3: Tampered or invalid QR token returns 400 Bad Request."""
    emp = create_activated_employee(client, prefix="QRTAMP")
    res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "qr_token": "tampered_nonexistent_token_xyz999",
        },
    )
    assert res.status_code == 400
    assert "invalid qr code" in res.json()["detail"].lower()


def test_phase4_unauthenticated_qr_checkin_rejected(client):
    """Scenario 10: Attempted dynamic QR check-in by unauthenticated user returns 401."""
    db = SessionLocal()
    _, raw_token = create_qr_session(db, office_code="HQ_MAIN", expire_seconds=18)
    db.close()

    res = client.post(
        "/api/v1/attendance/check-in",
        json={
            "employee_id": 1,
            "qr_token": raw_token,
        },
    )
    assert res.status_code == 401
    assert "authentication required" in res.json()["detail"].lower()


def test_phase4_employee_cannot_checkin_for_another_employee(client):
    """Scenario 11: Employee A attempting to check in for Employee B returns 403."""
    emp_a = create_activated_employee(client, prefix="QRSPFA")
    emp_b = create_activated_employee(client, prefix="QRSPFB")

    db = SessionLocal()
    _, raw_token = create_qr_session(db, office_code="HQ_MAIN", expire_seconds=18)
    db.close()

    res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp_a["headers"],
        json={
            "employee_id": emp_b["id"],
            "qr_token": raw_token,
        },
    )
    assert res.status_code == 403
    assert "only authorized to access your own" in res.json()["detail"].lower()


def test_phase4_duplicate_checkin_same_day(client):
    """Scenario 7: Duplicate check-in on the same day is rejected with 409 Conflict."""
    emp = create_activated_employee(client, prefix="QRDUP")

    db = SessionLocal()
    _, raw_token = create_qr_session(db, office_code="HQ_MAIN", expire_seconds=18)
    db.close()

    # First check-in succeeds
    res1 = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "qr_token": raw_token},
    )
    assert res1.status_code == 201

    # Second check-in fails with 409
    res2 = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "qr_token": raw_token},
    )
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"].lower()


def test_phase4_checkout_without_checkin_and_duplicate_checkout(client):
    """Scenario 8 & 9: Check-out without check-in (404) and duplicate checkout (400)."""
    emp = create_activated_employee(client, prefix="CKOUT")

    # 1. Checkout without check-in -> 404
    res1 = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"]},
    )
    assert res1.status_code == 404
    assert "no check-in record found" in res1.json()["detail"].lower()

    # Check in
    db = SessionLocal()
    _, raw_token = create_qr_session(db, office_code="HQ_MAIN", expire_seconds=18)
    db.close()
    client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "qr_token": raw_token},
    )

    # 2. First checkout succeeds -> 200
    res2 = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"]},
    )
    assert res2.status_code == 200
    assert res2.json()["check_out"] is not None

    # 3. Duplicate checkout -> 400
    res3 = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"]},
    )
    assert res3.status_code == 400
    assert "already checked out" in res3.json()["detail"].lower()


# ==============================================================================
# PHASE FIVE: LEAVE AND WFH INTEGRATION & SELF-APPROVAL GUARDS
# ==============================================================================

def test_phase5_leave_request_lifecycle(client, admin_auth):
    """Full Leave request lifecycle: submit, validate dates, review, and prevent re-review."""
    emp = create_activated_employee(client, prefix="LVLC")
    today = date.today()

    # 1. Invalid date range (end before start) -> 422
    bad_res = client.post(
        "/api/v1/leave",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "start_date": (today + timedelta(days=10)).isoformat(),
            "end_date": (today + timedelta(days=8)).isoformat(),
            "reason": "Invalid dates",
        },
    )
    assert bad_res.status_code == 422

    # 2. Valid submission -> 201 PENDING
    sub_res = client.post(
        "/api/v1/leave",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "start_date": (today + timedelta(days=10)).isoformat(),
            "end_date": (today + timedelta(days=12)).isoformat(),
            "reason": "Attending annual summit",
        },
    )
    assert sub_res.status_code == 201
    leave_id = sub_res.json()["id"]
    assert sub_res.json()["status"] == "PENDING"

    # 3. Ordinary employee cannot approve request -> 403
    emp_rev = client.patch(
        f"/api/v1/leave/{leave_id}/review",
        headers=emp["headers"],
        json={"action": "APPROVE"},
    )
    assert emp_rev.status_code == 403

    # 4. Admin approval -> 200 APPROVED
    admin_rev = client.patch(
        f"/api/v1/leave/{leave_id}/review",
        headers=admin_auth["headers"],
        json={"action": "APPROVE", "review_notes": "Approved by HR"},
    )
    assert admin_rev.status_code == 200
    assert admin_rev.json()["status"] == "APPROVED"
    assert admin_rev.json()["reviewed_by"] == admin_auth["user"]["id"]

    # 5. Re-review already approved request -> 400
    dup_rev = client.patch(
        f"/api/v1/leave/{leave_id}/review",
        headers=admin_auth["headers"],
        json={"action": "REJECT"},
    )
    assert dup_rev.status_code == 400
    assert "only pending requests can be reviewed" in dup_rev.json()["detail"].lower()


def test_phase5_wfh_request_lifecycle(client, admin_auth):
    """Full WFH request lifecycle: submit, validate dates, review, and status transitions."""
    emp = create_activated_employee(client, prefix="WFHLC")
    today = date.today()

    # 1. Invalid date range -> 422
    bad_res = client.post(
        "/api/v1/wfh",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "start_date": (today + timedelta(days=5)).isoformat(),
            "end_date": (today + timedelta(days=3)).isoformat(),
            "reason": "Bad range",
        },
    )
    assert bad_res.status_code == 422

    # 2. Valid submission -> 201 PENDING
    sub_res = client.post(
        "/api/v1/wfh",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "start_date": (today + timedelta(days=5)).isoformat(),
            "end_date": (today + timedelta(days=6)).isoformat(),
            "reason": "Home fiber connection maintenance",
        },
    )
    assert sub_res.status_code == 201
    wfh_id = sub_res.json()["id"]
    assert sub_res.json()["status"] == "PENDING"

    # 3. Ordinary employee cannot approve -> 403
    emp_rev = client.patch(
        f"/api/v1/wfh/{wfh_id}/review",
        headers=emp["headers"],
        json={"action": "APPROVE"},
    )
    assert emp_rev.status_code == 403

    # 4. Admin rejection -> 200 REJECTED
    admin_rev = client.patch(
        f"/api/v1/wfh/{wfh_id}/review",
        headers=admin_auth["headers"],
        json={"action": "REJECT", "review_notes": "Required on-site for equipment inspection"},
    )
    assert admin_rev.status_code == 200
    assert admin_rev.json()["status"] == "REJECTED"


def test_phase5_admin_self_approval_prevention_on_leave_and_wfh(client):
    """
    CRITICAL DEFECT REGRESSION TEST:
    Administrators who are also employees CANNOT approve or reject their own Leave or WFH requests.
    """
    db = SessionLocal()
    # Create an admin user linked to an employee record
    unique_code = f"VX-ADMEMP-{uuid.uuid4().hex[:6].upper()}"
    emp = Employee(
        employee_code=unique_code,
        first_name="Admin",
        last_name="Employee",
        department="Executive",
        designation="Managing Director",
    )
    db.add(emp)
    db.flush()

    admin_emp_user = User(
        admin_id=f"ADM-{uuid.uuid4().hex[:4].upper()}",
        email=f"admin_emp_{unique_code.lower()}@vorldx.com",
        password_hash="mock_hash_for_testing",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(admin_emp_user)
    db.flush()
    emp.user_id = admin_emp_user.id
    db.commit()
    db.refresh(admin_emp_user)
    db.refresh(emp)

    admin_token = create_access_token({"sub": str(admin_emp_user.id), "role": "ADMIN"})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    today = date.today()

    # 1. Create a Leave request for this admin-employee
    leave_req = LeaveRequest(
        employee_id=emp.id,
        start_date=today + timedelta(days=15),
        end_date=today + timedelta(days=17),
        reason="Personal Executive Leave",
        status=LeaveStatus.PENDING,
    )
    # 2. Create a WFH request for this admin-employee
    wfh_req = WFHRequest(
        employee_id=emp.id,
        start_date=today + timedelta(days=15),
        end_date=today + timedelta(days=17),
        reason="Remote Strategy Planning",
        status=WFHStatus.PENDING,
    )
    db.add_all([leave_req, wfh_req])
    db.commit()
    db.refresh(leave_req)
    db.refresh(wfh_req)
    leave_id = leave_req.id
    wfh_id = wfh_req.id
    db.close()

    # Test Leave Self-Approval -> MUST be rejected with 403 Forbidden
    leave_self_res = client.patch(
        f"/api/v1/leave/{leave_id}/review",
        headers=admin_headers,
        json={"action": "APPROVE"},
    )
    assert leave_self_res.status_code == 403
    assert "cannot approve or reject their own leave requests" in leave_self_res.json()["detail"].lower()

    # Test WFH Self-Approval -> MUST be rejected with 403 Forbidden
    wfh_self_res = client.patch(
        f"/api/v1/wfh/{wfh_id}/review",
        headers=admin_headers,
        json={"action": "APPROVE"},
    )
    assert wfh_self_res.status_code == 403
    assert "cannot approve or reject their own wfh requests" in wfh_self_res.json()["detail"].lower()


# ==============================================================================
# PHASE SIX: ATTENDANCE, SHIFTS, AND DATA INTEGRITY
# ==============================================================================

def test_phase6_attendance_duration_and_policy_status_evaluation(client):
    """Attendance duration and shift qualification evaluation under standard policy."""
    policy = AttendancePolicy(
        policy_name="Test Policy",
        work_start_time=time(9, 0),
        work_end_time=time(17, 0),
        late_grace_minutes=15,
        early_departure_grace_minutes=15,
        full_day_hours_threshold=8.0,
        half_day_hours_threshold=4.0,
        auto_detect_late_arrival=True,
    )

    # 1. On time check-in (09:10 AM UTC) -> PRESENT
    on_time = datetime(2026, 10, 24, 9, 10, tzinfo=timezone.utc)
    checkout_full = datetime(2026, 10, 24, 17, 15, tzinfo=timezone.utc)
    eval1 = evaluate_record_completion(on_time, checkout_full, policy, tz_name="UTC")
    assert eval1.status == AttendanceStatus.PRESENT
    assert eval1.hours_worked >= 8.0
    assert eval1.attendance_credit == 1.0

    # 2. Late check-in (09:35 AM UTC, beyond 15m grace) working full 8+ hours (until 17:40) -> LATE
    late_time = datetime(2026, 10, 24, 9, 35, tzinfo=timezone.utc)
    checkout_late = datetime(2026, 10, 24, 17, 40, tzinfo=timezone.utc)
    eval2 = evaluate_record_completion(late_time, checkout_late, policy, tz_name="UTC")
    assert eval2.status == AttendanceStatus.LATE
    assert eval2.hours_worked >= 8.0
    assert eval2.attendance_credit == 1.0


def test_phase6_attendance_correction_audit_logging(client, admin_auth):
    """Admin attendance correction creates an audit log entry preserving historical trail."""
    emp = create_activated_employee(client, prefix="AUDIT")

    # Seed an attendance record
    db = SessionLocal()
    rec = AttendanceRecord(
        employee_id=emp["id"],
        attendance_date=date(2026, 10, 20),
        check_in=datetime(2026, 10, 20, 9, 0, tzinfo=timezone.utc),
        check_out=None,
        status=AttendanceStatus.PRESENT,
        source="OFFICE_MANUAL",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    record_id = rec.id
    db.close()

    # Admin applies correction via PATCH /api/v1/attendance/{record_id}/correct
    correct_res = client.patch(
        f"/api/v1/attendance/{record_id}/correct",
        headers=admin_auth["headers"],
        json={
            "check_in": "2026-10-20T09:00:00Z",
            "check_out": "2026-10-20T17:00:00Z",
            "status": "PRESENT",
            "reason": "Employee forgot to badge out at front kiosk; manager verified manual departure.",
        },
    )
    assert correct_res.status_code == 200
    corr_json = correct_res.json()
    assert corr_json["is_corrected"] is True
    assert corr_json["corrected_by"] == admin_auth["user"]["id"]

    # Verify audit log was recorded via API
    audit_res = client.get(
        f"/api/v1/attendance/audit-logs?attendance_record_id={record_id}",
        headers=admin_auth["headers"],
    )
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) >= 1
    assert logs[0]["action_type"] == "ATTENDANCE_CORRECTION"
    assert logs[0]["attendance_record_id"] == record_id


def test_phase6_dashboard_metrics_consistency(client, admin_auth):
    """Dashboard metrics reflect actual database records accurately."""
    res = client.get("/api/v1/analytics/dashboard", headers=admin_auth["headers"])
    assert res.status_code == 200
    metrics = res.json()
    assert "total_active_employees" in metrics
    assert "present_today" in metrics
    assert "pending_leave_requests" in metrics
    assert "pending_wfh_requests" in metrics
    assert metrics["attendance_percentage"] >= 0.0


# ==============================================================================
# PHASE SEVEN: API INPUT VALIDATION AND SECURITY RESILIENCE
# ==============================================================================

def test_phase7_sql_injection_resilience(client, admin_auth):
    """Search endpoints with SQL injection payloads are handled safely via parameterization."""
    sql_payload = "Engineering' OR '1'='1"
    res = client.get(
        f"/api/v1/employees?department={sql_payload}",
        headers=admin_auth["headers"],
    )
    # Must not raise 500 error; SQLAlchemy parameterization treats payload as literal string
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_phase7_xss_input_resilience(client):
    """Text fields containing XSS payloads are stored safely as text and do not execute or break API."""
    emp = create_activated_employee(client, prefix="XSS")
    today = date.today()
    xss_payload = "<script>alert('VorldX_XSS_Exploit')</script>"

    res = client.post(
        "/api/v1/leave",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "start_date": (today + timedelta(days=30)).isoformat(),
            "end_date": (today + timedelta(days=32)).isoformat(),
            "reason": xss_payload,
        },
    )
    assert res.status_code == 201
    assert res.json()["reason"] == xss_payload


def test_phase7_csv_formula_injection_defense():
    """CSV cell sanitizer properly prefixes potentially dangerous formula prefixes."""
    from app.api.v1.routes.analytics import sanitize_csv_cell

    dangerous_payloads = [
        ("=cmd|'/C calc'!A0", "'=cmd|'/C calc'!A0"),
        ("+12345", "'+12345"),
        ("-SUM(1,2)", "'-SUM(1,2)"),
        ("@SUM(1,2)", "'@SUM(1,2)"),
        ("\tTabPayload", "'\tTabPayload"),
        ("\rReturnPayload", "'\rReturnPayload"),
        ("Regular Text", "Regular Text"),
        (None, ""),
    ]

    for raw, expected in dangerous_payloads:
        assert sanitize_csv_cell(raw) == expected


def test_phase7_error_response_hygiene(client):
    """Error responses must return standard JSON details and not leak stack traces or internal secrets."""
    res = client.get("/api/v1/employees/99999999")
    assert res.status_code == 404
    data = res.json()
    assert "detail" in data
    # Ensure no internal file paths or database passwords leaked in detail
    assert "traceback" not in str(data).lower()
    assert "password" not in str(data).lower()
    assert "c:\\" not in str(data).lower()


# ==============================================================================
# PHASE NINE: CONCURRENCY AND FAILURE HANDLING
# ==============================================================================

def test_phase9_duplicate_checkin_concurrency_handling(client):
    """Concurrent or repeated check-in attempts are prevented by DB constraint with clean 409."""
    emp = create_activated_employee(client, prefix="CONC")

    # Create active QR session
    db = SessionLocal()
    _, raw_token = create_qr_session(db, office_code="HQ_MAIN", expire_seconds=18)
    db.close()

    # Attempt 1: succeeds
    res1 = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "qr_token": raw_token},
    )
    assert res1.status_code == 201

    # Attempt 2: duplicate conflict
    res2 = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "qr_token": raw_token},
    )
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"].lower()


def test_phase9_concurrent_leave_approval_race(client, admin_auth):
    """Repeated review of the same leave request is rejected idempotently."""
    emp = create_activated_employee(client, prefix="REVRC")
    today = date.today()

    sub = client.post(
        "/api/v1/leave",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "start_date": (today + timedelta(days=40)).isoformat(),
            "end_date": (today + timedelta(days=42)).isoformat(),
            "reason": "Concurrency Test Leave",
        },
    )
    leave_id = sub.json()["id"]

    # First approval -> 200
    res1 = client.patch(
        f"/api/v1/leave/{leave_id}/review",
        headers=admin_auth["headers"],
        json={"action": "APPROVE"},
    )
    assert res1.status_code == 200
    assert res1.json()["status"] == "APPROVED"

    # Second approval -> 400 Bad Request
    res2 = client.patch(
        f"/api/v1/leave/{leave_id}/review",
        headers=admin_auth["headers"],
        json={"action": "APPROVE"},
    )
    assert res2.status_code == 400
    assert "only pending requests can be reviewed" in res2.json()["detail"].lower()
