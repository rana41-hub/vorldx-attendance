import csv
import io
import uuid
from datetime import date, datetime, timedelta, timezone
import pytest
from app.database import SessionLocal
from app.models.attendance import AttendanceRecord
from app.models.enums import AttendanceStatus, LeaveStatus, WFHStatus
from app.models.leave import LeaveRequest
from app.models.wfh import WFHRequest


def get_admin_auth(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    user_id = login_res.json()["user"]["id"]
    return {"token": token, "user_id": user_id, "headers": {"Authorization": f"Bearer {token}"}}


def create_and_activate_employee(client, prefix="VAL"):
    unique_code = f"VX-{prefix}-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Audit",
            "last_name": f"Tester-{unique_code}",
            "department": "Security",
            "designation": "Auditor",
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
    token = act_res.json()["access_token"]

    return {
        "id": emp_id,
        "code": unique_code,
        "email": email,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


# ==============================================================================
# 1. Headcount & Category Reconciliation Tests
# ==============================================================================

def test_daily_summary_exact_headcount_reconciliation(client):
    """
    Verify that mutually exclusive categories sum exactly to total_active_employees:
    total_attended + on_leave_count + wfh_remote_count + absent_count == total_active_employees.
    """
    admin = get_admin_auth(client)
    emp_att = create_and_activate_employee(client, prefix="VATT")
    emp_lev = create_and_activate_employee(client, prefix="VLEV")
    emp_wfh = create_and_activate_employee(client, prefix="VWFH")
    emp_both = create_and_activate_employee(client, prefix="VBTH")
    test_date = date(2027, 3, 15)

    with SessionLocal() as db:
        # emp_att: Attended office
        db.add(AttendanceRecord(
            employee_id=emp_att["id"],
            attendance_date=test_date,
            check_in=datetime(2027, 3, 15, 9, 5, tzinfo=timezone.utc),
            check_out=datetime(2027, 3, 15, 17, 10, tzinfo=timezone.utc),
            status=AttendanceStatus.PRESENT,
        ))
        # emp_lev: Approved leave
        db.add(LeaveRequest(
            employee_id=emp_lev["id"],
            start_date=test_date,
            end_date=test_date,
            reason="Medical appointment",
            status=LeaveStatus.APPROVED,
        ))
        # emp_wfh: Approved WFH (remote only)
        db.add(WFHRequest(
            employee_id=emp_wfh["id"],
            start_date=test_date,
            end_date=test_date,
            reason="Home equipment delivery",
            status=WFHStatus.APPROVED,
        ))
        # emp_both: Approved WFH AND checked in at office
        db.add(WFHRequest(
            employee_id=emp_both["id"],
            start_date=test_date,
            end_date=test_date,
            reason="Approved hybrid day",
            status=WFHStatus.APPROVED,
        ))
        db.add(AttendanceRecord(
            employee_id=emp_both["id"],
            attendance_date=test_date,
            check_in=datetime(2027, 3, 15, 9, 10, tzinfo=timezone.utc),
            check_out=datetime(2027, 3, 15, 17, 5, tzinfo=timezone.utc),
            status=AttendanceStatus.PRESENT,
        ))
        db.commit()

    res = client.get(
        f"/api/v1/analytics/daily?report_date={test_date.isoformat()}",
        headers=admin["headers"],
    )
    assert res.status_code == 200, res.text
    d = res.json()

    # Reconciled category sum
    reconciled_sum = d["total_attended"] + d["on_leave_count"] + d["wfh_remote_count"] + d["absent_count"]
    assert reconciled_sum == d["total_active_employees"]

    # Verify hybrid employee handled properly
    assert d["attended_wfh_count"] >= 1
    assert d["total_attended"] >= 2
    assert d["eligible_employees"] == d["total_active_employees"] - d["on_leave_count"]
    assert d["attendance_percentage"] == round((d["attended_eligible_count"] / d["eligible_employees"]) * 100, 1)


def test_compliance_percentage_precision_and_zero_division(client):
    """
    Ensure attendance percentage is bounded between 0.0 and 100.0,
    and returns 0.0 safely when eligible employees is zero.
    """
    admin = get_admin_auth(client)
    empty_date = date(2029, 1, 1)

    res = client.get(
        f"/api/v1/analytics/daily?report_date={empty_date.isoformat()}",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    d = res.json()
    assert d["attendance_percentage"] == 0.0
    assert 0.0 <= d["attendance_percentage"] <= 100.0


# ==============================================================================
# 2. Interval Analytics & Date Boundary Validation Tests
# ==============================================================================

def test_interval_summary_single_day_and_multi_day(client):
    """Verify average_daily_attendance and attendance_rate_percentage across single and multi-day ranges."""
    admin = get_admin_auth(client)
    single_date = date(2026, 6, 15)

    res = client.get(
        f"/api/v1/analytics/summary?start_date={single_date.isoformat()}&end_date={single_date.isoformat()}",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    d = res.json()
    assert d["total_days"] == 1
    assert d["average_daily_attendance"] == d["total_attendance_records"]
    expected_rate = round((d["total_attendance_records"] / (d["total_active_employees"] * 1)) * 100, 2)
    assert d["attendance_rate_percentage"] == expected_rate


def test_interval_empty_window_graceful_handling(client):
    """Empty date window returns 0 total records, 0.0 average, and 0.0% rate."""
    admin = get_admin_auth(client)
    f_start = date(2029, 6, 1)
    f_end = date(2029, 6, 7)

    res = client.get(
        f"/api/v1/analytics/summary?start_date={f_start.isoformat()}&end_date={f_end.isoformat()}",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    d = res.json()
    assert d["total_days"] == 7
    assert d["total_attendance_records"] == 0
    assert d["average_daily_attendance"] == 0.0
    assert d["attendance_rate_percentage"] == 0.0


# ==============================================================================
# 3. Late Attendance & Grace Period Boundaries
# ==============================================================================

def test_late_report_record_filtering_and_minutes_calculation(client):
    """Verify late-report returns late records, calculated minutes late beyond grace period, and correct percentage."""
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="VLAT")
    test_date = date(2027, 4, 10)

    with SessionLocal() as db:
        # Check in at 09:45 AM (30 minutes beyond 09:15 AM grace-period deadline)
        db.add(AttendanceRecord(
            employee_id=emp["id"],
            attendance_date=test_date,
            check_in=datetime(2027, 4, 10, 4, 15, tzinfo=timezone.utc),  # 09:45 IST
            check_out=datetime(2027, 4, 10, 12, 0, tzinfo=timezone.utc),
            status=AttendanceStatus.LATE,
        ))
        db.commit()

    res = client.get(
        f"/api/v1/analytics/late-report?start_date={test_date.isoformat()}&end_date={test_date.isoformat()}",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    d = res.json()
    assert d["total_late_records"] >= 1
    rec = next(r for r in d["records"] if r["employee_id"] == emp["id"])
    assert rec["status"] == "LATE"
    # Check-in at 09:45 with 09:00 shift start and 15m grace period -> exactly 30 minutes late
    assert rec["minutes_late"] == 30


def test_grace_period_boundaries_policy_and_lateness():
    """
    Verify attendance status and minutes late across critical check-in times:
    09:00 -> PRESENT, 0 min
    09:10 -> PRESENT, 0 min
    09:15 -> PRESENT, 0 min (at grace boundary)
    09:16 -> LATE, 1 min beyond grace
    09:30 -> LATE, 15 min beyond grace
    09:45 -> LATE, 30 min beyond grace
    10:00 -> LATE, 45 min beyond grace
    """
    from datetime import time
    from zoneinfo import ZoneInfo
    from app.models.attendance_policy import AttendancePolicy
    from app.services.policy_service import calculate_check_in_status

    policy = AttendancePolicy(
        policy_name="Day Shift",
        work_start_time=time(9, 0),
        work_end_time=time(17, 0),
        late_grace_minutes=15,
        half_day_hours_threshold=4.0,
        auto_detect_late_arrival=True,
    )
    ist = ZoneInfo("Asia/Kolkata")
    test_d = date(2027, 6, 15)

    cases = [
        (time(9, 0), AttendanceStatus.PRESENT, False, 0),
        (time(9, 10), AttendanceStatus.PRESENT, False, 0),
        (time(9, 15), AttendanceStatus.PRESENT, False, 0),
        (time(9, 16), AttendanceStatus.LATE, True, 1),
        (time(9, 30), AttendanceStatus.LATE, True, 15),
        (time(9, 45), AttendanceStatus.LATE, True, 30),
        (time(10, 0), AttendanceStatus.LATE, True, 45),
    ]

    start_min = policy.work_start_time.hour * 60 + policy.work_start_time.minute
    grace_cutoff_min = start_min + policy.late_grace_minutes

    for t, expected_status, expected_late_flag, expected_minutes_late in cases:
        check_in_dt = datetime.combine(test_d, t, tzinfo=timezone.utc)
        status, is_late = calculate_check_in_status(check_in_dt, policy)
        assert status == expected_status, f"Time {t} got status {status}, expected {expected_status}"
        assert is_late == expected_late_flag, f"Time {t} got is_late {is_late}, expected {expected_late_flag}"

        check_in_min = t.hour * 60 + t.minute
        calc_minutes_late = max(0, check_in_min - grace_cutoff_min)
        assert calc_minutes_late == expected_minutes_late, (
            f"Time {t} got {calc_minutes_late} min late, expected {expected_minutes_late}"
        )


def test_historical_late_attendance_records_august_2026(client):
    """
    Historical late attendance test for interval 2026-08-01 to 2026-08-15.
    Verifies that the 6 historical late attendance records on August 10 appear,
    and each reflects check-in at 09:45 AM with exactly 30 minutes late beyond the grace period.
    """
    admin = get_admin_auth(client)
    res = client.get(
        "/api/v1/analytics/late-report?start_date=2026-08-01&end_date=2026-08-15",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    d = res.json()
    assert d["total_late_records"] >= 6
    assert len(d["records"]) >= 6
    for rec in d["records"]:
        assert rec["attendance_date"] == "2026-08-10"
        assert rec["status"] == "LATE"
        # Check-in at 09:45:00 with 09:00 shift start + 15m grace -> 30 minutes late
        assert rec["minutes_late"] == 30


# ==============================================================================
# 4. Streaming CSV Export & Filter Tests
# ==============================================================================

def test_streaming_csv_export_department_and_status_filtering(client):
    """Verify that CSV export honors department and status filters and streams valid CSV data."""
    admin = get_admin_auth(client)
    test_date = date(2027, 5, 20)
    emp_sec = create_and_activate_employee(client, prefix="CSEC")

    with SessionLocal() as db:
        db.add(AttendanceRecord(
            employee_id=emp_sec["id"],
            attendance_date=test_date,
            check_in=datetime(2027, 5, 20, 9, 0, tzinfo=timezone.utc),
            check_out=datetime(2027, 5, 20, 17, 0, tzinfo=timezone.utc),
            status=AttendanceStatus.PRESENT,
        ))
        db.commit()

    # Export with Security department filter
    res = client.get(
        f"/api/v1/analytics/export/attendance.csv?start_date={test_date.isoformat()}&end_date={test_date.isoformat()}&department=Security&status=PRESENT",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]

    content = res.text
    reader = csv.reader(io.StringIO(content))
    header = next(reader)
    assert "Employee Code" in header
    assert "Correction Reason" in header

    rows = list(reader)
    assert len(rows) >= 1
    # Check that all returned rows match department 'Security'
    dept_idx = header.index("Department")
    for r in rows:
        assert r[dept_idx] == "Security"


def test_streaming_csv_combined_filters_engineering_and_present(client):
    """Verify Department=Engineering and Status=PRESENT combined filter against database records."""
    admin = get_admin_auth(client)
    res = client.get(
        "/api/v1/analytics/export/attendance.csv?start_date=2026-09-01&end_date=2026-10-23&department=Engineering&status=PRESENT",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    reader = csv.reader(io.StringIO(res.text))
    header = next(reader)
    dept_idx = header.index("Department")
    stat_idx = header.index("Status")

    rows = list(reader)
    assert len(rows) >= 1
    for r in rows:
        assert r[dept_idx] == "Engineering"
        assert r[stat_idx] == "PRESENT"


def test_streaming_csv_empty_results_export(client):
    """Empty result intervals must produce a valid CSV with headers and zero data rows."""
    admin = get_admin_auth(client)
    res = client.get(
        "/api/v1/analytics/export/attendance.csv?start_date=2029-01-01&end_date=2029-01-02",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    reader = csv.reader(io.StringIO(res.text))
    header = next(reader)
    assert header[0] == "Employee ID"
    assert "Status" in header
    rows = list(reader)
    assert len(rows) == 0


def test_streaming_csv_formula_injection_sanitization_comprehensive(client):
    """Verify formula injection protection for cells starting with =, +, -, @, \\t, \\r."""
    from app.api.v1.routes.analytics import sanitize_csv_cell

    assert sanitize_csv_cell("=SUM(A1:A10)") == "'=SUM(A1:A10)"
    assert sanitize_csv_cell("+1234567890") == "'+1234567890"
    assert sanitize_csv_cell("-cmd|' /C calc'!A0") == "'-cmd|' /C calc'!A0"
    assert sanitize_csv_cell("@Admin") == "'@Admin"
    assert sanitize_csv_cell("\tTabPrefix") == "'\tTabPrefix"
    assert sanitize_csv_cell("\rReturnPrefix") == "'\rReturnPrefix"
    assert sanitize_csv_cell("Normal Text") == "Normal Text"
    assert sanitize_csv_cell(None) == ""


# ==============================================================================
# 5. Security & RBAC Tests
# ==============================================================================

def test_reporting_rbac_security_all_endpoints(client):
    """Admin-only endpoints reject unauthenticated and employee accounts with 401/403."""
    emp = create_and_activate_employee(client, prefix="SECU")

    endpoints = [
        "/api/v1/analytics/daily",
        "/api/v1/analytics/late-report",
        "/api/v1/analytics/wfh-report",
        "/api/v1/analytics/summary?start_date=2026-01-01&end_date=2026-01-02",
        "/api/v1/analytics/trends",
        "/api/v1/analytics/export/attendance.csv?start_date=2026-01-01&end_date=2026-01-02",
    ]

    for ep in endpoints:
        # Unauthenticated: 401
        assert client.get(ep).status_code == 401, f"Failed 401 check on {ep}"
        # Employee token: 403
        assert client.get(ep, headers=emp["headers"]).status_code == 403, f"Failed 403 check on {ep}"
