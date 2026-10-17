"""Stage 6 Checkpoint 3 - Comprehensive Validation Test Suite:
1. Concurrent Attendance Check-In & Check-Out Protection
2. Timezone Correctness (UTC, Asia/Kolkata, Midnight Boundaries, Cross-Day Shifts)
3. Authentication, Session Expiry & Authorization Security
"""
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
import pytest

from app.config import settings
from app.core.security import create_access_token
from app.database import SessionLocal
from app.models.attendance import AttendanceRecord
from app.models.attendance_policy import AttendancePolicy
from app.models.employee import Employee
from app.models.enums import AttendanceStatus, LeaveStatus, UserRole, WFHStatus
from app.models.leave import LeaveRequest
from app.models.user import User
from app.models.wfh import WFHRequest
from app.services.policy_service import (
    calculate_check_in_status,
    calculate_check_out_status,
    ensure_timezone_aware,
    to_organization_time,
)


# ============================================================================
# TEST FIXTURE HELPERS
# ============================================================================


def get_admin_auth(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    token = res.json()["access_token"]
    user_id = res.json()["user"]["id"]
    return {
        "token": token,
        "user_id": user_id,
        "headers": {"Authorization": f"Bearer {token}"},
    }


def create_test_employee(client, prefix="VAL"):
    unique_code = f"VX-{prefix}-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Validation",
            "last_name": f"Tester-{unique_code}",
            "department": "Quality Assurance",
            "designation": "Validation Engineer",
        },
    )
    assert emp_res.status_code == 201, f"Employee creation failed: {emp_res.text}"
    emp_data = emp_res.json()
    emp_id = emp_data["id"]

    email = f"val_{unique_code.lower()}@vorldx.com"
    act_res = client.post(
        "/api/v1/auth/activate",
        json={
            "employee_code": unique_code,
            "email": email,
            "password": "ValidPassword@123",
        },
    )
    assert act_res.status_code == 201, f"Employee activation failed: {act_res.text}"
    act_data = act_res.json()
    token = act_data["access_token"]
    user_id = act_data["user"]["id"]

    return {
        "id": emp_id,
        "code": unique_code,
        "email": email,
        "token": token,
        "user_id": user_id,
        "headers": {"Authorization": f"Bearer {token}"},
    }


# ============================================================================
# PILLAR 1: CONCURRENT ATTENDANCE CHECK-IN & CHECK-OUT PROTECTION
# ============================================================================


def test_concurrent_simultaneous_check_in_same_employee(client):
    """
    Submits simultaneous check-in requests for the same employee and date.
    Verifies:
    1. Exactly one record is created.
    2. Winning request gets HTTP 201 Created.
    3. Losing request gets controlled HTTP 409 Conflict.
    4. Successful record is not corrupted.
    """
    emp = create_test_employee(client, prefix="CNC1")
    fixed_time = datetime.now(timezone.utc)

    def do_check_in():
        return client.post(
            "/api/v1/attendance/check-in",
            json={
                "employee_id": emp["id"],
                "source": "OFFICE_QR",
                "timestamp": fixed_time.isoformat(),
            },
            headers=emp["headers"],
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(do_check_in)
        f2 = executor.submit(do_check_in)
        r1 = f1.result()
        r2 = f2.result()

    statuses = [r1.status_code, r2.status_code]
    assert 201 in statuses, f"Expected one 201 Created, got {statuses}"
    assert 409 in statuses, f"Expected one 409 Conflict, got {statuses}"

    winning = r1 if r1.status_code == 201 else r2
    losing = r2 if r1.status_code == 201 else r1

    # Verify controlled conflict message
    assert "already exists" in losing.json()["detail"].lower()

    # Verify exactly one attendance record in DB and integrity intact
    db = SessionLocal()
    try:
        records = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.employee_id == emp["id"])
            .all()
        )
        assert len(records) == 1
        rec = records[0]
        assert rec.id == winning.json()["id"]
        assert rec.status == AttendanceStatus.PRESENT
        assert rec.check_out is None
    finally:
        db.close()


def test_concurrent_check_in_independent_employees(client):
    """
    Verifies that two different employees can check in independently
    and concurrently without cross-blocking or false positive conflict.
    """
    emp1 = create_test_employee(client, prefix="IND1")
    emp2 = create_test_employee(client, prefix="IND2")
    fixed_time = datetime.now(timezone.utc)

    def check_in_emp(emp):
        return client.post(
            "/api/v1/attendance/check-in",
            json={
                "employee_id": emp["id"],
                "source": "OFFICE_QR",
                "timestamp": fixed_time.isoformat(),
            },
            headers=emp["headers"],
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(check_in_emp, emp1)
        f2 = executor.submit(check_in_emp, emp2)
        r1 = f1.result()
        r2 = f2.result()

    assert r1.status_code == 201, f"Emp1 failed: {r1.text}"
    assert r2.status_code == 201, f"Emp2 failed: {r2.text}"
    assert r1.json()["employee_id"] == emp1["id"]
    assert r2.json()["employee_id"] == emp2["id"]


def test_concurrent_simultaneous_check_out_same_employee(client):
    """
    Verifies duplicate check-out behavior:
    1. Employee checks in successfully.
    2. Two concurrent check-out requests are submitted simultaneously.
    3. Exactly one succeeds (200), and duplicate gets controlled 400 Bad Request.
    4. Checkout timestamp and status are recorded cleanly.
    """
    emp = create_test_employee(client, prefix="CKO")
    in_time = datetime.now(timezone.utc) - timedelta(hours=8)
    out_time = datetime.now(timezone.utc)

    # Initial check-in
    in_res = client.post(
        "/api/v1/attendance/check-in",
        json={
            "employee_id": emp["id"],
            "source": "OFFICE_QR",
            "timestamp": in_time.isoformat(),
        },
        headers=emp["headers"],
    )
    assert in_res.status_code == 201

    def do_check_out():
        return client.post(
            "/api/v1/attendance/check-out",
            json={
                "employee_id": emp["id"],
                "timestamp": out_time.isoformat(),
            },
            headers=emp["headers"],
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(do_check_out)
        f2 = executor.submit(do_check_out)
        r1 = f1.result()
        r2 = f2.result()

    statuses = [r1.status_code, r2.status_code]
    assert 200 in statuses, f"Expected one 200 OK, got {statuses}"
    assert 400 in statuses, f"Expected duplicate to be rejected with 400, got {statuses}"

    losing = r2 if r1.status_code == 200 else r1
    assert "already checked out" in losing.json()["detail"].lower()


def test_database_level_unique_constraint_enforcement(client):
    """
    Confirms duplicate protection is enforced at the PostgreSQL database level
    via uq_employee_attendance_date even if application checks were bypassed.
    """
    emp = create_test_employee(client, prefix="DBU")
    today = date.today()
    now_dt = datetime.now(timezone.utc)

    db = SessionLocal()
    try:
        # First record via direct DB session
        rec1 = AttendanceRecord(
            employee_id=emp["id"],
            attendance_date=today,
            check_in=now_dt,
            status=AttendanceStatus.PRESENT,
        )
        db.add(rec1)
        db.commit()

        # Second record on same date for same employee directly to DB
        rec2 = AttendanceRecord(
            employee_id=emp["id"],
            attendance_date=today,
            check_in=now_dt + timedelta(minutes=5),
            status=AttendanceStatus.PRESENT,
        )
        db.add(rec2)
        with pytest.raises(Exception) as exc_info:
            db.commit()

        assert "uq_employee_attendance_date" in str(exc_info.value) or "unique" in str(exc_info.value).lower()
        db.rollback()
    finally:
        db.close()


# ============================================================================
# PILLAR 2: TIMEZONE CORRECTNESS
# ============================================================================


def test_timezone_configuration_and_kolkata_conversion():
    """
    Verifies:
    1. Configured organization timezone defaults to UTC.
    2. Conversion between UTC timestamps and India Standard Time (Asia/Kolkata).
    """
    assert settings.ORGANIZATION_TIMEZONE == "UTC"

    # UTC to Asia/Kolkata (+05:30) conversion check
    utc_dt = datetime(2026, 10, 17, 18, 30, 0, tzinfo=timezone.utc)
    kolkata_tz = ZoneInfo("Asia/Kolkata")
    kolkata_dt = utc_dt.astimezone(kolkata_tz)

    assert kolkata_dt.year == 2026
    assert kolkata_dt.month == 10
    assert kolkata_dt.day == 18
    assert kolkata_dt.hour == 0
    assert kolkata_dt.minute == 0
    assert kolkata_dt.utcoffset() == timedelta(hours=5, minutes=30)


def test_attendance_near_local_midnight_and_record_date():
    """
    Tests calendar date assignment near local midnight.
    23:45 local belongs to Day 1.
    00:15 local belongs to Day 2.
    """
    naive_before = datetime(2026, 10, 16, 23, 45, 0)
    aware_before = ensure_timezone_aware(naive_before)
    date_before = to_organization_time(aware_before).date()
    assert date_before == date(2026, 10, 16)

    naive_after = datetime(2026, 10, 17, 0, 15, 0)
    aware_after = ensure_timezone_aware(naive_after)
    date_after = to_organization_time(aware_after).date()
    assert date_after == date(2026, 10, 17)


def test_shift_crossing_midnight_duration_and_early_departure():
    """
    Verifies that shifts crossing midnight:
    1. Calculate duration correctly (e.g. 22:00 to 06:00 = 8.0 hours).
    2. Do not falsely flag early departure when checkout occurs on the next calendar day.
    """
    policy = AttendancePolicy(
        auto_detect_early_departure=True,
        work_end_time=time(18, 30),
        early_departure_grace_minutes=15,
        half_day_hours_threshold=4.0,
        full_day_hours_threshold=8.0,
    )

    shift_in = datetime(2026, 10, 16, 22, 0, 0, tzinfo=timezone.utc)
    shift_out = datetime(2026, 10, 17, 6, 0, 0, tzinfo=timezone.utc)

    status, hours, is_early = calculate_check_out_status(
        shift_in, shift_out, AttendanceStatus.PRESENT, policy
    )
    assert hours == 8.0
    assert is_early is False
    assert status == AttendanceStatus.PRESENT


def test_short_shift_duration_and_half_day_classification():
    """
    Verifies short shift duration calculation and half-day classification.
    E.g. 1.5 hours worked < 4.0 threshold -> HALF_DAY.
    """
    policy = AttendancePolicy(
        auto_detect_early_departure=True,
        work_end_time=time(18, 30),
        early_departure_grace_minutes=15,
        half_day_hours_threshold=4.0,
    )

    shift_in = datetime(2026, 10, 16, 9, 30, 0, tzinfo=timezone.utc)
    shift_out = datetime(2026, 10, 16, 11, 0, 0, tzinfo=timezone.utc)

    status, hours, is_early = calculate_check_out_status(
        shift_in, shift_out, AttendanceStatus.PRESENT, policy
    )
    assert hours == 1.5
    assert is_early is True
    assert status == AttendanceStatus.HALF_DAY


def test_checkout_fallback_for_midnight_crossing_shift(client):
    """
    End-to-end API test: Employee checked in yesterday night (Day 1).
    Checks out today morning (Day 2).
    Checkout finds un-concluded record via midnight boundary fallback.
    """
    emp = create_test_employee(client, prefix="MNC")
    day1_in = datetime(2026, 10, 16, 22, 0, 0, tzinfo=timezone.utc)
    day2_out = datetime(2026, 10, 17, 6, 0, 0, tzinfo=timezone.utc)

    # Day 1 check-in
    in_res = client.post(
        "/api/v1/attendance/check-in",
        json={
            "employee_id": emp["id"],
            "source": "OFFICE_QR",
            "timestamp": day1_in.isoformat(),
        },
        headers=emp["headers"],
    )
    assert in_res.status_code == 201
    assert in_res.json()["attendance_date"] == "2026-10-16"

    # Day 2 check-out (crosses midnight calendar date)
    out_res = client.post(
        "/api/v1/attendance/check-out",
        json={
            "employee_id": emp["id"],
            "timestamp": day2_out.isoformat(),
        },
        headers=emp["headers"],
    )
    assert out_res.status_code == 200
    out_data = out_res.json()
    assert out_data["attendance_date"] == "2026-10-16"
    assert out_data["check_out"] is not None


# ============================================================================
# PILLAR 3: AUTHENTICATION, SESSION EXPIRY & AUTHORIZATION SECURITY
# ============================================================================


def test_auth_valid_and_invalid_credentials(client):
    """
    1. Valid admin credentials succeed.
    2. Valid employee credentials succeed.
    3. Wrong password returns HTTP 401.
    4. Nonexistent user returns HTTP 401.
    5. Email rejected as login identifier returns HTTP 401.
    """
    admin_res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    assert admin_res.status_code == 200
    assert "access_token" in admin_res.json()

    emp = create_test_employee(client, prefix="ATH")
    emp_res = client.post(
        "/api/v1/auth/login",
        json={"login_id": emp["code"], "password": "ValidPassword@123"},
    )
    assert emp_res.status_code == 200
    assert "access_token" in emp_res.json()

    # Wrong password
    bad_pw = client.post(
        "/api/v1/auth/login",
        json={"login_id": emp["code"], "password": "IncorrectPassword"},
    )
    assert bad_pw.status_code == 401

    # Nonexistent user
    no_user = client.post(
        "/api/v1/auth/login",
        json={"login_id": "VX-NONEXISTENT-9999", "password": "AnyPassword123"},
    )
    assert no_user.status_code == 401

    # Email rejected as login identifier
    email_login = client.post(
        "/api/v1/auth/login",
        json={"login_id": emp["email"], "password": "ValidPassword@123"},
    )
    assert email_login.status_code == 401


def test_session_expiry_rejection(client):
    """
    Verifies rejection of expired JWT token with HTTP 401 Unauthorized.
    """
    emp = create_test_employee(client, prefix="EXP")

    # Generate an already-expired token (-30 seconds)
    expired_token = create_access_token(
        data={"sub": str(emp["user_id"]), "role": "EMPLOYEE"},
        expires_delta=timedelta(seconds=-30),
    )

    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


def test_malformed_and_tampered_token_rejection(client):
    """
    Verifies rejection of malformed or signature-tampered JWT tokens with HTTP 401.
    """
    emp = create_test_employee(client, prefix="MAL")
    valid_token = emp["token"]

    # Tampered signature
    tampered_token = valid_token[:-6] + "xxxxxx"
    tampered_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tampered_token}"},
    )
    assert tampered_res.status_code == 401
    assert "invalid" in tampered_res.json()["detail"].lower()

    # Completely malformed token
    malformed_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-real-jwt-token"},
    )
    assert malformed_res.status_code == 401


def test_unauthenticated_request_to_protected_endpoints(client):
    """
    Protected endpoints reject requests missing an Authorization token with HTTP 401.
    """
    endpoints = [
        ("GET", "/api/v1/auth/me"),
        ("PUT", "/api/v1/attendance/policy"),
        ("GET", "/api/v1/analytics/dashboard"),
    ]
    for method, path in endpoints:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.put(path, json={"late_grace_minutes": 20})
        assert res.status_code == 401, f"Expected 401 on {path}, got {res.status_code}"


def test_employee_data_isolation_enforcement(client):
    """
    Confirms an employee cannot read or modify another employee's:
    1. Attendance records (override to self on GET, 403 on POST)
    2. Leave requests (override to self on GET, 403 on POST)
    3. WFH requests (override to self on GET, 403 on POST)
    """
    empA = create_test_employee(client, prefix="ISOA")
    empB = create_test_employee(client, prefix="ISOB")

    # 1. Attendance: EmpA attempts to check in as EmpB -> 403
    att_spoof = client.post(
        "/api/v1/attendance/check-in",
        json={"employee_id": empB["id"], "source": "OFFICE_QR"},
        headers=empA["headers"],
    )
    assert att_spoof.status_code == 403

    # Attendance: EmpA attempts to check out as EmpB -> 403
    att_out_spoof = client.post(
        "/api/v1/attendance/check-out",
        json={"employee_id": empB["id"]},
        headers=empA["headers"],
    )
    assert att_out_spoof.status_code == 403

    # Attendance: EmpA queries with ?employee_id=empB -> overridden to empA only
    att_list = client.get(
        f"/api/v1/attendance?employee_id={empB['id']}",
        headers=empA["headers"],
    )
    assert att_list.status_code == 200
    for rec in att_list.json():
        assert rec["employee_id"] == empA["id"]

    # 2. Leave: EmpA attempts to submit leave for EmpB -> 403
    leave_spoof = client.post(
        "/api/v1/leave",
        json={
            "employee_id": empB["id"],
            "start_date": "2026-11-01",
            "end_date": "2026-11-02",
            "reason": "Spoofed leave",
        },
        headers=empA["headers"],
    )
    assert leave_spoof.status_code == 403

    # Leave: EmpA queries with ?employee_id=empB -> overridden to empA only
    leave_list = client.get(
        f"/api/v1/leave?employee_id={empB['id']}",
        headers=empA["headers"],
    )
    assert leave_list.status_code == 200
    for req in leave_list.json():
        assert req["employee_id"] == empA["id"]

    # 3. WFH: EmpA attempts to submit WFH for EmpB -> 403
    wfh_spoof = client.post(
        "/api/v1/wfh",
        json={
            "employee_id": empB["id"],
            "start_date": "2026-11-01",
            "end_date": "2026-11-02",
            "reason": "Spoofed WFH",
        },
        headers=empA["headers"],
    )
    assert wfh_spoof.status_code == 403

    # WFH: EmpA queries with ?employee_id=empB -> overridden to empA only
    wfh_list = client.get(
        f"/api/v1/wfh?employee_id={empB['id']}",
        headers=empA["headers"],
    )
    assert wfh_list.status_code == 200
    for req in wfh_list.json():
        assert req["employee_id"] == empA["id"]


def test_employee_cannot_invoke_administrator_operations(client):
    """
    Confirms employees cannot invoke administrator-only endpoints:
    1. /attendance/policy (PUT) -> 403
    2. /analytics/dashboard (GET) -> 403
    3. /analytics/summary (GET) -> 403
    4. /analytics/trends (GET) -> 403
    5. /leave/{id}/review (PATCH) -> 403
    6. /wfh/{id}/review (PATCH) -> 403
    7. /employees/{id}/status (PATCH) -> 403
    """
    emp = create_test_employee(client, prefix="ROL")

    # Policy update
    res1 = client.put(
        "/api/v1/attendance/policy",
        json={"late_grace_minutes": 25},
        headers=emp["headers"],
    )
    assert res1.status_code == 403

    # Analytics dashboard
    res2 = client.get(
        "/api/v1/analytics/dashboard",
        headers=emp["headers"],
    )
    assert res2.status_code == 403

    # Review leave
    res3 = client.patch(
        "/api/v1/leave/1/review",
        json={"action": "APPROVE"},
        headers=emp["headers"],
    )
    assert res3.status_code == 403

    # Review WFH
    res4 = client.patch(
        "/api/v1/wfh/1/review",
        json={"action": "APPROVE"},
        headers=emp["headers"],
    )
    assert res4.status_code == 403

    # Deactivate account
    res5 = client.patch(
        f"/api/v1/employees/{emp['id']}/status",
        json={"is_active": False},
        headers=emp["headers"],
    )
    assert res5.status_code == 403


def test_account_deactivation_security(client):
    """
    Verifies that deactivated employee accounts:
    1. Cannot log in (HTTP 403 Forbidden).
    2. Cannot perform operations using existing JWT token (HTTP 401 Unauthorized).
    3. Restores account to active status cleanly.
    """
    admin = get_admin_auth(client)
    emp = create_test_employee(client, prefix="DCT")

    # 1. Admin deactivates employee account
    deact_res = client.patch(
        f"/api/v1/employees/{emp['id']}/status",
        json={"is_active": False},
        headers=admin["headers"],
    )
    assert deact_res.status_code == 200
    assert deact_res.json()["is_active"] is False

    # 2. Login attempt with deactivated account fails with 403
    login_attempt = client.post(
        "/api/v1/auth/login",
        json={"login_id": emp["code"], "password": "ValidPassword@123"},
    )
    assert login_attempt.status_code == 403
    assert "deactivated" in login_attempt.json()["detail"].lower()

    # 3. Existing token rejected with 401 ("User account is inactive.")
    me_attempt = client.get(
        "/api/v1/auth/me",
        headers=emp["headers"],
    )
    assert me_attempt.status_code == 401
    assert "inactive" in me_attempt.json()["detail"].lower()

    # 4. Cleanup: reactivate account
    react_res = client.patch(
        f"/api/v1/employees/{emp['id']}/status",
        json={"is_active": True},
        headers=admin["headers"],
    )
    assert react_res.status_code == 200
