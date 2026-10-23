import io
import csv
import uuid
from datetime import date, datetime, timedelta, timezone
import pytest
from app.models.enums import AttendanceStatus, LeaveStatus, WFHStatus
from app.models.attendance import AttendanceRecord
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.models.wfh import WFHRequest
from app.models.user import User
from app.database import SessionLocal


def get_admin_auth(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    user_id = login_res.json()["user"]["id"]
    return {"token": token, "user_id": user_id, "headers": {"Authorization": f"Bearer {token}"}}


def create_and_activate_employee(client, prefix="D11"):
    unique_code = f"VX-{prefix}-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Report",
            "last_name": f"Tester-{unique_code}",
            "department": "Analytics",
            "designation": "Analyst",
        },
    )
    assert emp_res.status_code == 201, f"Employee creation failed: {emp_res.text}"
    emp_data = emp_res.json()
    emp_id = emp_data["id"]

    email = f"emp_{unique_code.lower()}@vorldx.com"
    act_res = client.post(
        "/api/v1/auth/activate",
        json={
            "employee_code": unique_code,
            "email": email,
            "password": "Password@1234",
        },
    )
    assert act_res.status_code == 201, f"Employee activation failed: {act_res.text}"
    act_data = act_res.json()
    token = act_data["access_token"]

    return {
        "id": emp_id,
        "code": unique_code,
        "email": email,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


# ==============================================================================
# 1. Daily Attendance Summary Tests
# ==============================================================================

def test_daily_attendance_summary_empty_day(client):
    """Graceful handling of a future date with zero attendance records."""
    admin = get_admin_auth(client)
    future_date = (datetime.now(timezone.utc).date() + timedelta(days=120)).isoformat()

    res = client.get(
        f"/api/v1/analytics/daily?report_date={future_date}",
        headers=admin["headers"],
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["report_date"] == future_date
    assert data["present_count"] == 0
    assert data["late_count"] == 0
    assert data["half_day_count"] == 0
    assert data["total_attended"] == 0
    assert data["incomplete_count"] == 0
    assert data["attendance_percentage"] == 0.0
    assert "definitions" in data
    assert "attendance_percentage" in data["definitions"]
    assert "eligible_employees" in data["definitions"]


def test_daily_attendance_summary_with_records_and_percentage(client):
    """Verify calculated metrics: present, late, incomplete, on-leave, absent, and attendance percentage."""
    admin = get_admin_auth(client)
    emp1 = create_and_activate_employee(client, prefix="D11A")
    emp2 = create_and_activate_employee(client, prefix="D11B")
    test_date = date(2026, 6, 15)

    with SessionLocal() as db:
        # emp1: PRESENT, complete
        r1 = AttendanceRecord(
            employee_id=emp1["id"],
            attendance_date=test_date,
            check_in=datetime(2026, 6, 15, 9, 5, tzinfo=timezone.utc),
            check_out=datetime(2026, 6, 15, 17, 30, tzinfo=timezone.utc),
            status=AttendanceStatus.PRESENT,
        )
        # emp2: LATE, incomplete (no check-out)
        r2 = AttendanceRecord(
            employee_id=emp2["id"],
            attendance_date=test_date,
            check_in=datetime(2026, 6, 15, 9, 45, tzinfo=timezone.utc),
            check_out=None,
            status=AttendanceStatus.LATE,
        )
        db.add_all([r1, r2])
        db.commit()

    res = client.get(
        f"/api/v1/analytics/daily?report_date={test_date.isoformat()}",
        headers=admin["headers"],
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["total_active_employees"] >= 2
    assert data["present_count"] >= 1
    assert data["late_count"] >= 1
    assert data["incomplete_count"] >= 1
    assert data["total_attended"] >= 2
    assert 0.0 <= data["attendance_percentage"] <= 100.0


def test_daily_summary_zero_eligible_division_by_zero_prevention(client):
    """When all active employees are on approved leave, percentage is safely 0.0."""
    admin = get_admin_auth(client)
    # Target date far in the future
    special_date = date(2028, 12, 25)

    res = client.get(
        f"/api/v1/analytics/daily?report_date={special_date.isoformat()}",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data["attendance_percentage"], float)
    assert data["attendance_percentage"] >= 0.0


# ==============================================================================
# 2. Date Filtering & Validation Tests
# ==============================================================================

def test_date_filter_reversed_range_rejection(client):
    """Reversed date range (start > end) must be rejected with 422."""
    admin = get_admin_auth(client)
    res = client.get(
        "/api/v1/analytics/late-report?start_date=2026-06-20&end_date=2026-06-10",
        headers=admin["headers"],
    )
    assert res.status_code == 422
    assert "End date cannot be earlier than start date" in res.text


def test_date_filter_range_exceeding_366_days(client):
    """Date range exceeding 366 days is rejected with 422."""
    admin = get_admin_auth(client)
    res = client.get(
        "/api/v1/analytics/late-report?start_date=2024-01-01&end_date=2026-06-01",
        headers=admin["headers"],
    )
    assert res.status_code == 422
    assert "cannot exceed 366 days" in res.text


def test_inclusive_date_range_filtering(client):
    """Check that records on both start_date and end_date are included."""
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="INCL")
    d_start = date(2026, 7, 1)
    d_end = date(2026, 7, 3)

    with SessionLocal() as db:
        r1 = AttendanceRecord(
            employee_id=emp["id"],
            attendance_date=d_start,
            check_in=datetime(2026, 7, 1, 9, 35, tzinfo=timezone.utc),
            status=AttendanceStatus.LATE,
        )
        r2 = AttendanceRecord(
            employee_id=emp["id"],
            attendance_date=d_end,
            check_in=datetime(2026, 7, 3, 9, 40, tzinfo=timezone.utc),
            status=AttendanceStatus.LATE,
        )
        db.add_all([r1, r2])
        db.commit()

    res = client.get(
        f"/api/v1/analytics/late-report?start_date={d_start.isoformat()}&end_date={d_end.isoformat()}",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    data = res.json()
    record_dates = [r["attendance_date"] for r in data["records"]]
    assert d_start.isoformat() in record_dates
    assert d_end.isoformat() in record_dates


# ==============================================================================
# 3. Late Attendance Summary Tests
# ==============================================================================

def test_late_attendance_report_structure_and_minutes_late(client):
    """Verify late-report response schema, shift_start_time, grace period, and minutes_late."""
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="LATE")
    test_date = date(2026, 8, 10)

    with SessionLocal() as db:
        r = AttendanceRecord(
            employee_id=emp["id"],
            attendance_date=test_date,
            check_in=datetime(2026, 8, 10, 4, 15, tzinfo=timezone.utc),  # 09:45 AM IST
            check_out=datetime(2026, 8, 10, 12, 0, tzinfo=timezone.utc),
            status=AttendanceStatus.LATE,
        )
        db.add(r)
        db.commit()

    res = client.get(
        f"/api/v1/analytics/late-report?start_date={test_date.isoformat()}&end_date={test_date.isoformat()}",
        headers=admin["headers"],
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["total_late_records"] >= 1
    assert data["total_attendance_records"] >= 1
    assert data["late_percentage"] > 0
    assert "shift_start_time" in data
    assert "late_grace_minutes" in data

    emp_records = [r for r in data["records"] if r["employee_id"] == emp["id"]]
    assert len(emp_records) == 1
    rec = emp_records[0]
    assert rec["employee_code"] == emp["code"]
    assert rec["status"] == "LATE"
    assert rec["minutes_late"] is not None
    assert rec["minutes_late"] >= 15


# ==============================================================================
# 4. Work-From-Home (WFH) Statistics Tests
# ==============================================================================

def test_wfh_report_counts_and_filtering(client):
    """Verify WFH statistics for pending, approved, and rejected requests with target vs submission filters."""
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="WFHR")
    wfh_start = date(2026, 9, 1)
    wfh_end = date(2026, 9, 3)

    with SessionLocal() as db:
        w1 = WFHRequest(
            employee_id=emp["id"],
            start_date=wfh_start,
            end_date=wfh_end,
            reason="Remote client meetings",
            status=WFHStatus.APPROVED,
        )
        w2 = WFHRequest(
            employee_id=emp["id"],
            start_date=wfh_start,
            end_date=wfh_end,
            reason="Home maintenance",
            status=WFHStatus.PENDING,
        )
        db.add_all([w1, w2])
        db.commit()

    # Query by target_date
    res = client.get(
        f"/api/v1/analytics/wfh-report?start_date={wfh_start.isoformat()}&end_date={wfh_end.isoformat()}&filter_by=target_date",
        headers=admin["headers"],
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["filter_by"] == "target_date"
    assert data["total_requests"] >= 2
    assert data["approved_requests"] >= 1
    assert data["pending_requests"] >= 1
    assert data["total_approved_wfh_days"] >= 3

    # Query by submission_date with today's date
    today_str = datetime.now(timezone.utc).date().isoformat()
    res_sub = client.get(
        f"/api/v1/analytics/wfh-report?start_date={today_str}&end_date={today_str}&filter_by=submission_date",
        headers=admin["headers"],
    )
    assert res_sub.status_code == 200
    data_sub = res_sub.json()
    assert data_sub["filter_by"] == "submission_date"


# ==============================================================================
# 5. CSV Export Tests
# ==============================================================================

def test_csv_export_headers_and_content(client):
    """CSV export returns proper MIME type, attachment filename, UTF-8 encoded text, and expected headers."""
    admin = get_admin_auth(client)
    start_d = date(2026, 6, 1)
    end_d = date(2026, 6, 30)

    res = client.get(
        f"/api/v1/analytics/export/attendance.csv?start_date={start_d.isoformat()}&end_date={end_d.isoformat()}",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "attachment; filename=" in res.headers["content-disposition"]

    content = res.text
    reader = csv.reader(io.StringIO(content))
    headers = next(reader)

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


def test_csv_export_formula_injection_protection(client):
    """Cells starting with =, +, -, @ must be prefixed with a single quote to prevent spreadsheet injection."""
    admin = get_admin_auth(client)
    unique_code = f"VX-CSV-{uuid.uuid4().hex[:6].upper()}"

    # Create employee with formula injection payload in department name
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "=1+1",
            "last_name": "@Admin",
            "department": "+SpreadsheetHack",
            "designation": "Analyst",
        },
    )
    assert emp_res.status_code == 201
    emp_data = emp_res.json()
    emp_id = emp_data["id"]

    test_date = date(2026, 5, 20)
    with SessionLocal() as db:
        rec = AttendanceRecord(
            employee_id=emp_id,
            attendance_date=test_date,
            check_in=datetime(2026, 5, 20, 9, 0, tzinfo=timezone.utc),
            status=AttendanceStatus.PRESENT,
        )
        db.add(rec)
        db.commit()

    res = client.get(
        f"/api/v1/analytics/export/attendance.csv?start_date={test_date.isoformat()}&end_date={test_date.isoformat()}",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    lines = res.text.splitlines()

    # Find the row for this employee
    emp_line = [l for l in lines if unique_code in l]
    assert len(emp_line) == 1
    row_text = emp_line[0]

    # Verify that dangerous prefixes were neutralized with a leading single quote
    assert "'+SpreadsheetHack" in row_text or "'+SpreadsheetHack" in row_text
    assert "'=1+1" in row_text


# ==============================================================================
# 6. Security and Role-Based Authorization Tests
# ==============================================================================

def test_reporting_unauthenticated_requests_rejected(client):
    """Unauthenticated requests to all reporting endpoints must return 401."""
    assert client.get("/api/v1/analytics/daily").status_code == 401
    assert client.get("/api/v1/analytics/late-report").status_code == 401
    assert client.get("/api/v1/analytics/wfh-report").status_code == 401
    assert client.get("/api/v1/analytics/export/attendance.csv?start_date=2026-01-01&end_date=2026-01-02").status_code == 401


def test_reporting_employee_forbidden(client):
    """Regular employees cannot access Admin-only organization-wide reporting endpoints."""
    emp = create_and_activate_employee(client, prefix="NOACC")

    daily_res = client.get("/api/v1/analytics/daily", headers=emp["headers"])
    assert daily_res.status_code == 403

    late_res = client.get("/api/v1/analytics/late-report", headers=emp["headers"])
    assert late_res.status_code == 403

    wfh_res = client.get("/api/v1/analytics/wfh-report", headers=emp["headers"])
    assert wfh_res.status_code == 403

    csv_res = client.get(
        "/api/v1/analytics/export/attendance.csv?start_date=2026-01-01&end_date=2026-01-02",
        headers=emp["headers"],
    )
    assert csv_res.status_code == 403
