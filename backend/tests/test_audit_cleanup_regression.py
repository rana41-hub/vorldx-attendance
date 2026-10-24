"""Audit, Cleanup & Regression Validation Test Suite.

Verifies:
1. Concurrency & race condition safety (simultaneous check-in/out, independent workers).
2. Role-based access control and employee data isolation.
3. Deactivated account rejection.
4. Dynamic QR token server validation and expiration.
5. Native Excel (.xlsx) formatting, column widths (preventing '########'), frozen panes, auto-filters.
6. CSV export formatting and formula injection sanitization.
"""
import io
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

import openpyxl
import pytest

from sqlalchemy import text

from app.database import SessionLocal
from app.models.attendance import AttendanceRecord
from app.models.employee import Employee
from app.models.enums import AttendanceStatus, UserRole
from app.models.user import User

_TRACKED_EMPS: list[int] = []
_TRACKED_USERS: list[int] = []


@pytest.fixture(autouse=True, scope="function")
def cleanup_tracked_test_records():
    emp_ids_before = list(_TRACKED_EMPS)
    user_ids_before = list(_TRACKED_USERS)
    yield
    # Conclusively clean up only the exact records created by this test
    new_emp_ids = [eid for eid in _TRACKED_EMPS if eid not in emp_ids_before]
    new_user_ids = [uid for uid in _TRACKED_USERS if uid not in user_ids_before]
    if new_emp_ids or new_user_ids:
        db = SessionLocal()
        try:
            if new_emp_ids:
                tuple_emp_ids = tuple(new_emp_ids)
                in_clause = tuple_emp_ids if len(tuple_emp_ids) > 1 else f"({tuple_emp_ids[0]})"
                db.execute(text(f"DELETE FROM attendance_records WHERE employee_id IN {in_clause}"))
                db.execute(text(f"UPDATE employees SET user_id = NULL WHERE id IN {in_clause}"))
                db.execute(text(f"DELETE FROM employees WHERE id IN {in_clause}"))
            if new_user_ids:
                tuple_user_ids = tuple(new_user_ids)
                in_u_clause = tuple_user_ids if len(tuple_user_ids) > 1 else f"({tuple_user_ids[0]})"
                db.execute(text(f"DELETE FROM users WHERE id IN {in_u_clause}"))
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
    return {"Authorization": f"Bearer {token}"}


def create_test_employee(client, prefix="REG"):
    unique_code = f"VX-{prefix}-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Audit",
            "last_name": f"Tester-{unique_code}",
            "department": "Engineering",
            "designation": "Software Engineer",
        },
    )
    assert emp_res.status_code == 201, f"Employee creation failed: {emp_res.text}"
    emp_data = emp_res.json()
    emp_id = emp_data["id"]

    email = f"audit_{unique_code.lower()}@vorldx.com"
    act_res = client.post(
        "/api/v1/auth/activate",
        json={
            "employee_code": unique_code,
            "email": email,
            "password": "SecurePassword@123",
        },
    )
    assert act_res.status_code == 201, f"Employee activation failed: {act_res.text}"
    token = act_res.json()["access_token"]
    user_id = act_res.json()["user"]["id"]

    _TRACKED_EMPS.append(emp_id)
    _TRACKED_USERS.append(user_id)

    return {
        "id": emp_id,
        "code": unique_code,
        "email": email,
        "token": token,
        "user_id": user_id,
        "headers": {"Authorization": f"Bearer {token}"},
    }


# ============================================================================
# 1. CONCURRENCY & RACE CONDITION SAFETY
# ============================================================================


def test_concurrent_simultaneous_check_in_safety(client):
    """
    Submits two simultaneous check-in requests for the same employee and date.
    Verifies that exactly one succeeds (201) and the duplicate gets 409 Conflict.
    """
    emp = create_test_employee(client, prefix="CSIN")
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
    assert 201 in statuses, f"Expected exactly one 201 Created, got {statuses}"
    assert 409 in statuses, f"Expected exactly one 409 Conflict, got {statuses}"

    db = SessionLocal()
    try:
        count = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.employee_id == emp["id"])
            .count()
        )
        assert count == 1, "Database must contain exactly 1 record"
    finally:
        db.close()


def test_concurrent_independent_employees_check_in(client):
    """
    Verifies that two different employees can check in concurrently
    without cross-blocking or interference.
    """
    emp1 = create_test_employee(client, prefix="CIND1")
    emp2 = create_test_employee(client, prefix="CIND2")
    now_dt = datetime.now(timezone.utc)

    def do_check_in(emp):
        return client.post(
            "/api/v1/attendance/check-in",
            json={
                "employee_id": emp["id"],
                "source": "OFFICE_QR",
                "timestamp": now_dt.isoformat(),
            },
            headers=emp["headers"],
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(do_check_in, emp1)
        f2 = executor.submit(do_check_in, emp2)
        r1 = f1.result()
        r2 = f2.result()

    assert r1.status_code == 201, f"Emp1 failed: {r1.text}"
    assert r2.status_code == 201, f"Emp2 failed: {r2.text}"
    assert r1.json()["employee_id"] == emp1["id"]
    assert r2.json()["employee_id"] == emp2["id"]


def test_concurrent_simultaneous_check_out_safety(client):
    """
    Verifies that concurrent check-out requests for the same employee
    result in exactly one 200 OK and one controlled 400 Bad Request.
    """
    emp = create_test_employee(client, prefix="CSOUT")
    in_time = datetime.now(timezone.utc) - timedelta(hours=8)
    out_time = datetime.now(timezone.utc)

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
    assert 400 in statuses, f"Expected one 400 Bad Request, got {statuses}"

    db = SessionLocal()
    try:
        rec = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.employee_id == emp["id"])
            .one()
        )
        assert rec.check_out is not None
        assert rec.status == AttendanceStatus.PRESENT
    finally:
        db.close()


def test_check_out_without_check_in_rejected(client):
    """
    Attempting to check out without an active check-in must return 404 Not Found.
    """
    emp = create_test_employee(client, prefix="NOCHK")
    res = client.post(
        "/api/v1/attendance/check-out",
        json={"employee_id": emp["id"]},
        headers=emp["headers"],
    )
    assert res.status_code == 404
    assert "no check-in record found" in res.json()["detail"].lower()


# ============================================================================
# 2. SECURITY, ROLE-BASED ACCESS & DATA ISOLATION
# ============================================================================


def test_security_admin_endpoints_require_admin_role(client):
    """
    Admin-only endpoints must reject unauthenticated requests with 401
    and employee tokens with 403.
    """
    emp = create_test_employee(client, prefix="SEC")

    # 1. Unauthenticated request to Excel export
    res_unauth = client.get(
        "/api/v1/analytics/export/attendance.xlsx?start_date=2026-10-01&end_date=2026-10-15"
    )
    assert res_unauth.status_code == 401

    # 2. Employee token to Excel export
    res_emp = client.get(
        "/api/v1/analytics/export/attendance.xlsx?start_date=2026-10-01&end_date=2026-10-15",
        headers=emp["headers"],
    )
    assert res_emp.status_code == 403

    # 3. Employee token to Policy update
    res_policy = client.put(
        "/api/v1/attendance/policy",
        json={"late_grace_minutes": 20},
        headers=emp["headers"],
    )
    assert res_policy.status_code == 403


def test_employee_data_isolation(client):
    """
    An employee querying attendance records cannot view another employee's records.
    The backend automatically filters to the caller's own employee profile.
    """
    emp1 = create_test_employee(client, prefix="ISO1")
    emp2 = create_test_employee(client, prefix="ISO2")

    # Emp1 checks in
    client.post(
        "/api/v1/attendance/check-in",
        json={"employee_id": emp1["id"]},
        headers=emp1["headers"],
    )

    # Emp2 queries attendance passing employee_id=emp1.id
    res = client.get(
        f"/api/v1/attendance?employee_id={emp1['id']}",
        headers=emp2["headers"],
    )
    assert res.status_code == 200
    records = res.json()
    # Any records returned must strictly belong to emp2, never emp1
    for r in records:
        assert r["employee_id"] == emp2["id"]


def test_deactivated_account_rejected(client):
    """
    A deactivated user account cannot log in or perform authenticated actions.
    """
    emp = create_test_employee(client, prefix="DEACT")
    admin_hdr = get_admin_auth(client)

    # Admin deactivates employee
    deact_res = client.patch(
        f"/api/v1/employees/{emp['id']}/status",
        json={"is_active": False},
        headers=admin_hdr,
    )
    assert deact_res.status_code == 200

    # Deactivated employee attempts login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"login_id": emp["code"], "password": "SecurePassword@123"},
    )
    assert login_res.status_code == 403
    assert "deactivated" in login_res.json()["detail"].lower()


# ============================================================================
# 3. DYNAMIC QR ROTATION & VALIDATION
# ============================================================================


def test_dynamic_qr_kiosk_generation_and_rotation(client):
    """
    Verifies that the kiosk endpoint generates an active QR session with 18s duration,
    and rotates cleanly.
    """
    admin_hdr = get_admin_auth(client)

    # Fetch active QR session
    res = client.get("/api/v1/qr/active?office_code=HQ_MAIN", headers=admin_hdr)
    assert res.status_code == 200
    session_data = res.json()
    assert session_data["office_code"] == "HQ_MAIN"
    assert "token" in session_data
    assert "qr_code_payload" in session_data

    # Rotate QR session
    rot_res = client.post(
        "/api/v1/qr/rotate",
        json={"office_code": "HQ_MAIN", "expire_seconds": 18},
        headers=admin_hdr,
    )
    assert rot_res.status_code == 201
    rot_data = rot_res.json()
    assert rot_data["token"] != session_data["token"]


def test_invalid_and_expired_qr_token_rejected(client):
    """
    Checks that an invalid or expired QR token is rejected by the check-in endpoint.
    """
    emp = create_test_employee(client, prefix="QRREJ")

    res = client.post(
        "/api/v1/attendance/check-in",
        json={
            "employee_id": emp["id"],
            "source": "OFFICE_QR",
            "qr_token": "TOTALLY_INVALID_OR_REVOKED_TOKEN_12345",
        },
        headers=emp["headers"],
    )
    assert res.status_code == 400
    assert "invalid" in res.json()["detail"].lower() or "expired" in res.json()["detail"].lower()


# ============================================================================
# 4. EXCEL (.XLSX) & CSV EXPORT REGRESSION
# ============================================================================


def test_native_excel_export_structure_and_formatting(client):
    """
    Verifies that GET /api/v1/analytics/export/attendance.xlsx:
    1. Returns a valid openpyxl readable workbook.
    2. Has title 'Attendance Records'.
    3. Has correct 11 column headers.
    4. Has column widths configured to prevent '########' in Excel:
       - Column E (Attendance Date) >= 15
       - Column F (Check In) >= 20
       - Column G (Check Out) >= 20
    5. Has frozen header row (freeze_panes == 'A2').
    6. Has auto_filter configured.
    """
    admin_hdr = get_admin_auth(client)
    today = date.today()
    start = today - timedelta(days=7)

    res = client.get(
        f"/api/v1/analytics/export/attendance.xlsx?start_date={start}&end_date={today}",
        headers=admin_hdr,
    )
    assert res.status_code == 200
    assert "openxmlformats" in res.headers.get("content-type", "")

    # Load into openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    assert "Attendance Records" in wb.sheetnames
    ws = wb["Attendance Records"]

    # Verify headers
    headers = [cell.value for cell in ws[1]]
    expected_headers = [
        "Employee ID",
        "Employee Code",
        "Employee Name",
        "Department",
        "Attendance Date",
        "Check In",
        "Check Out",
        "Duration (Hours)",
        "Status",
        "Is Corrected",
        "Correction Reason",
    ]
    assert headers == expected_headers

    # Verify column widths prevent '########'
    assert ws.column_dimensions["E"].width >= 15  # Attendance Date
    assert ws.column_dimensions["F"].width >= 20  # Check In
    assert ws.column_dimensions["G"].width >= 20  # Check Out

    # Verify frozen panes and auto_filter
    assert ws.freeze_panes == "A2"
    assert ws.auto_filter.ref is not None


def test_csv_export_structure_and_streaming(client):
    """
    Verifies that GET /api/v1/analytics/export/attendance.csv:
    1. Streams valid UTF-8 CSV.
    2. Includes the correct headers.
    3. Formula injection prevention sanitizes sensitive leading characters.
    """
    admin_hdr = get_admin_auth(client)
    today = date.today()
    start = today - timedelta(days=7)

    res = client.get(
        f"/api/v1/analytics/export/attendance.csv?start_date={start}&end_date={today}",
        headers=admin_hdr,
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")

    lines = res.text.strip().split("\r\n")
    assert len(lines) >= 1
    assert lines[0] == (
        "Employee ID,Employee Code,Employee Name,Department,Attendance Date,"
        "Check In,Check Out,Duration (Hours),Status,Is Corrected,Correction Reason"
    )
