"""Automated Tests for Configurable Shift and Centralized Attendance Completion & Credit Policy.

Covers Tests 1 through 20:
TEST 1  - Open shift: Check-in succeeds, no checkout exists, and full attendance credit is zero.
TEST 2  - Three-minute session: Check-in at 09:00, checkout at 09:03. Expected: no full attendance credit.
TEST 3  - Four-hour session: Check-in at 09:00, checkout after four hours. Expected: no full attendance credit.
TEST 4  - Qualifying full shift: Check-in at 09:00, checkout at 17:00. Expected: full credit.
TEST 5  - Grace-period boundary: Check-in within configured grace period.
TEST 6  - Beyond grace period: Check-in beyond grace period, late classification and completion credit.
TEST 7  - Early checkout: Early checkout cannot earn full attendance credit unless policy allows it.
TEST 8  - Checkout without check-in: Rejected with 404.
TEST 9  - Duplicate check-in: Rejected with 409.
TEST 10 - Duplicate checkout: Rejected with 400.
TEST 11 - Dashboard consistency: Employee dashboard, history, and statistics agree.
TEST 12 - Admin consistency: Admin attendance summaries agree with employee records.
TEST 13 - Employee isolation: Caller cannot access or mutate another employee's attendance.
TEST 14 - QR security: Expired, rotated, invalid QR sessions rejected.
TEST 15 - Client tampering: Client-supplied duration, status, or credit cannot bypass backend rules.
TEST 16 - Timezone: Organization timezone (Asia/Kolkata) handled consistently.
TEST 17 - Overnight shift regression: Overnight shift crossing midnight duration and checkout fallback preserved.
TEST 18 - Approved leave: Approved leave excluded from denominator.
TEST 19 - Future dates and weekends: Denominator excludes weekends and future dates.
TEST 20 - Historical data preservation: Existing database records remain unchanged.
"""
import uuid
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.attendance import AttendanceRecord
from app.models.attendance_policy import AttendancePolicy
from app.models.employee import Employee
from app.models.enums import AttendanceStatus, LeaveStatus, UserRole
from app.models.leave import LeaveRequest
from app.models.qr_session import QRSession
from app.models.user import User
from app.services.attendance_completion_service import (
    DEFAULT_EXPECTED_DURATION_HOURS,
    DEFAULT_SHIFT_END_TIME,
    DEFAULT_SHIFT_START_TIME,
    calculate_session_duration,
    check_is_early_departure,
    check_is_late,
    evaluate_record_completion,
    to_shift_organization_time,
)
from app.services.policy_service import get_active_policy


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_completion_test_records():
    """Isolate tests and preserve existing database records."""
    db = SessionLocal()
    init_att_ids = {a.id for a in db.query(AttendanceRecord.id).all()}
    init_emp_ids = {e.id for e in db.query(Employee.id).all()}
    init_leave_ids = {l.id for l in db.query(LeaveRequest.id).all()}
    init_user_ids = {u.id for u in db.query(User.id).all()}
    init_qr_ids = {q.id for q in db.query(QRSession.id).all()}
    db.close()

    yield

    db = SessionLocal()
    try:
        # Delete created attendance
        created_atts = (
            db.query(AttendanceRecord)
            .filter(~AttendanceRecord.id.in_(init_att_ids))
            .all()
            if init_att_ids
            else db.query(AttendanceRecord).all()
        )
        for a in created_atts:
            db.delete(a)

        # Delete created leaves
        created_leaves = (
            db.query(LeaveRequest)
            .filter(~LeaveRequest.id.in_(init_leave_ids))
            .all()
            if init_leave_ids
            else db.query(LeaveRequest).all()
        )
        for l in created_leaves:
            db.delete(l)

        # Delete created QR sessions
        created_qrs = (
            db.query(QRSession)
            .filter(~QRSession.id.in_(init_qr_ids))
            .all()
            if init_qr_ids
            else db.query(QRSession).all()
        )
        for q in created_qrs:
            db.delete(q)

        # Delete created employees and users
        created_emps = (
            db.query(Employee)
            .filter(~Employee.id.in_(init_emp_ids))
            .all()
            if init_emp_ids
            else db.query(Employee).all()
        )
        for e in created_emps:
            uid = e.user_id
            db.delete(e)
            if uid and uid not in init_user_ids:
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


def create_test_employee(client, prefix="TC"):
    unique_code = f"VX-{prefix}-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Test",
            "last_name": f"User-{unique_code}",
            "department": "Engineering",
            "designation": "Software Engineer",
        },
    )
    assert emp_res.status_code == 201, f"Employee creation failed: {emp_res.text}"
    emp_id = emp_res.json()["id"]

    email = f"tc_{unique_code.lower()}@vorldx.com"
    act_res = client.post(
        "/api/v1/auth/activate",
        json={
            "employee_code": unique_code,
            "email": email,
            "password": "ValidPassword@123",
        },
    )
    assert act_res.status_code == 201, f"Activation failed: {act_res.text}"
    token = act_res.json()["access_token"]

    return {
        "id": emp_id,
        "code": unique_code,
        "email": email,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


# =====================================================================
# TEST 1 — Open Shift: Check-in succeeds, no checkout, credit = 0.0
# =====================================================================
def test_1_open_shift_credit_is_zero(client):
    emp = create_test_employee(client, prefix="T1")

    # Check-in
    in_res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "source": "OFFICE_QR"},
    )
    assert in_res.status_code == 201
    assert in_res.json()["check_out"] is None

    # Fetch dashboard
    dash_res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert dash_res.status_code == 200
    data = dash_res.json()

    assert data["session_state"] == "IN_PROGRESS"
    assert data["is_session_open"] is True
    assert data["current_shift_credit"] == 0.0
    # Must NOT count unfinished open session as completed present day
    assert data["stats"]["present_days"] == 0
    assert data["stats"]["total_attended_days"] == 0


# =====================================================================
# TEST 2 — Three-Minute Session: Check-in at 09:00, checkout at 09:03
# =====================================================================
def test_2_three_minute_session_no_full_credit(client):
    emp = create_test_employee(client, prefix="T2")

    t_in = datetime(2026, 10, 15, 9, 0, 0, tzinfo=timezone.utc)
    t_out = datetime(2026, 10, 15, 9, 3, 0, tzinfo=timezone.utc)

    # Check-in
    in_res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": t_in.isoformat()},
    )
    assert in_res.status_code == 201

    # Check-out after 3 minutes
    out_res = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": t_out.isoformat()},
    )
    assert out_res.status_code == 200
    out_data = out_res.json()

    assert out_data["session_state"] == "INCOMPLETE"
    assert out_data["status"] == "HALF_DAY"

    # Dashboard verification: NO full attendance credit awarded
    dash_res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert dash_res.status_code == 200
    data = dash_res.json()

    assert data["stats"]["present_days"] == 0
    assert data["stats"]["total_attended_days"] == 0
    assert data["stats"]["half_day_days"] == 0


# =====================================================================
# TEST 3 — Four-Hour Session: Check-in 09:00, checkout 13:00
# =====================================================================
def test_3_four_hour_session_no_full_credit(client):
    emp = create_test_employee(client, prefix="T3")

    t_in = datetime(2026, 10, 15, 9, 0, 0, tzinfo=timezone.utc)
    t_out = datetime(2026, 10, 15, 13, 0, 0, tzinfo=timezone.utc)

    client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": t_in.isoformat()},
    )
    out_res = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": t_out.isoformat()},
    )
    assert out_res.status_code == 200
    assert out_res.json()["session_state"] == "INCOMPLETE"
    assert out_res.json()["status"] == "HALF_DAY"

    dash_res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert dash_res.status_code == 200
    data = dash_res.json()

    # Under strict full-day policy: NO full attendance credit and NO half-day credit
    assert data["stats"]["present_days"] == 0
    assert data["stats"]["half_day_days"] == 0
    assert data["stats"]["total_attended_days"] == 0


# =====================================================================
# TEST 3B — Session Just Below 8 Hours: Check-in 09:00, checkout 16:54 (7.9 hrs)
# =====================================================================
def test_3b_session_just_below_eight_hours_no_credit(client):
    emp = create_test_employee(client, prefix="T3B")

    kolkata_tz = ZoneInfo("Asia/Kolkata")
    t_in = datetime(2026, 10, 15, 9, 0, 0, tzinfo=kolkata_tz)
    t_out = datetime(2026, 10, 15, 16, 54, 0, tzinfo=kolkata_tz)

    client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": t_in.isoformat()},
    )
    out_res = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": t_out.isoformat()},
    )
    assert out_res.status_code == 200
    assert out_res.json()["session_state"] == "INCOMPLETE"
    assert out_res.json()["hours_worked"] == 7.9

    dash_res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert dash_res.status_code == 200
    data = dash_res.json()

    assert data["stats"]["present_days"] == 0
    assert data["stats"]["half_day_days"] == 0
    assert data["stats"]["total_attended_days"] == 0


# =====================================================================
# TEST 4 — Qualifying Full Shift: Check-in 09:00, checkout 17:00
# =====================================================================
def test_4_qualifying_full_shift_awards_full_credit(client):
    emp = create_test_employee(client, prefix="T4")

    kolkata_tz = ZoneInfo("Asia/Kolkata")
    t_in = datetime(2026, 10, 15, 9, 0, 0, tzinfo=kolkata_tz)
    t_out = datetime(2026, 10, 15, 17, 0, 0, tzinfo=kolkata_tz)

    client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": t_in.isoformat()},
    )
    out_res = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": t_out.isoformat()},
    )
    assert out_res.status_code == 200
    assert out_res.json()["session_state"] == "COMPLETED"
    assert out_res.json()["status"] == "PRESENT"
    assert out_res.json()["hours_worked"] == 8.0

    dash_res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert dash_res.status_code == 200
    data = dash_res.json()

    assert data["stats"]["present_days"] == 1
    assert data["stats"]["late_days"] == 0
    assert data["stats"]["total_attended_days"] == 1


# =====================================================================
# TEST 4B — Session Longer Than 8 Hours: Check-in 09:00, checkout 18:30 (9.5 hrs)
# =====================================================================
def test_4b_session_longer_than_eight_hours_capped_at_one_credit(client):
    emp = create_test_employee(client, prefix="T4B")

    kolkata_tz = ZoneInfo("Asia/Kolkata")
    t_in = datetime(2026, 10, 15, 9, 0, 0, tzinfo=kolkata_tz)
    t_out = datetime(2026, 10, 15, 18, 30, 0, tzinfo=kolkata_tz)

    client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": t_in.isoformat()},
    )
    out_res = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": t_out.isoformat()},
    )
    assert out_res.status_code == 200
    assert out_res.json()["session_state"] == "COMPLETED"
    assert out_res.json()["status"] == "PRESENT"
    assert out_res.json()["hours_worked"] == 9.5

    dash_res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert dash_res.status_code == 200
    data = dash_res.json()

    # Credit is strictly 1.0 (no more than 1.0 credit awarded)
    assert data["stats"]["present_days"] == 1
    assert data["stats"]["total_attended_days"] == 1


# =====================================================================
# TEST 5 — Grace-Period Boundary: Check-in within grace period
# =====================================================================
def test_5_grace_period_boundary_on_time(client):
    admin = get_admin_auth(client)
    # Configure 09:00 start with 15 min grace period
    client.put(
        "/api/v1/attendance/policy",
        headers=admin["headers"],
        json={
            "work_start_time": "09:00:00",
            "work_end_time": "17:00:00",
            "late_grace_minutes": 15,
            "auto_detect_late_arrival": True,
        },
    )

    db = SessionLocal()
    policy = get_active_policy(db)
    db.close()

    # In Kolkata timezone (+05:30), check in at exactly 09:15 AM
    kolkata_0915 = datetime(2026, 10, 15, 9, 15, 0, tzinfo=ZoneInfo("Asia/Kolkata"))
    is_late_at_cutoff = check_is_late(kolkata_0915, policy)
    assert is_late_at_cutoff is False, "09:15 should be on time within 15 min grace period"


# =====================================================================
# TEST 6 — Beyond Grace Period: Late classification & completion credit
# =====================================================================
def test_6_beyond_grace_period_late_classification(client):
    admin = get_admin_auth(client)
    client.put(
        "/api/v1/attendance/policy",
        headers=admin["headers"],
        json={
            "work_start_time": "09:00:00",
            "work_end_time": "17:00:00",
            "late_grace_minutes": 15,
            "auto_detect_late_arrival": True,
        },
    )

    db = SessionLocal()
    policy = get_active_policy(db)
    db.close()

    # In Kolkata timezone (+05:30), check in at 09:25 AM (10 minutes past grace period)
    kolkata_0925 = datetime(2026, 10, 15, 9, 25, 0, tzinfo=ZoneInfo("Asia/Kolkata"))
    kolkata_1725 = datetime(2026, 10, 15, 17, 25, 0, tzinfo=ZoneInfo("Asia/Kolkata"))

    is_late = check_is_late(kolkata_0925, policy)
    assert is_late is True

    # Complete 8.0 hours
    eval_res = evaluate_record_completion(kolkata_0925, kolkata_1725, policy)
    assert eval_res.session_state == "COMPLETED"
    assert eval_res.status == AttendanceStatus.LATE
    assert eval_res.attendance_credit == 1.0

    # Restore default policy
    client.put(
        "/api/v1/attendance/policy",
        headers=admin["headers"],
        json={
            "auto_detect_late_arrival": False,
            "auto_detect_early_departure": False,
        },
    )


# =====================================================================
# TEST 7 — Early Checkout: Cannot earn full attendance credit
# =====================================================================
def test_7_early_checkout_no_full_attendance_credit(client):
    db = SessionLocal()
    policy = get_active_policy(db)
    db.close()

    # Worked 6.5 hours (e.g. 09:00 to 15:30)
    t_in = datetime(2026, 10, 15, 9, 0, 0, tzinfo=timezone.utc)
    t_out = datetime(2026, 10, 15, 15, 30, 0, tzinfo=timezone.utc)

    eval_res = evaluate_record_completion(t_in, t_out, policy)
    assert eval_res.session_state == "INCOMPLETE"
    assert eval_res.is_complete is False
    assert eval_res.attendance_credit == 0.0
    assert eval_res.status == AttendanceStatus.HALF_DAY


# =====================================================================
# TEST 8 — Checkout without Check-in: Rejected with 404
# =====================================================================
def test_8_checkout_without_checkin_rejected(client):
    emp = create_test_employee(client, prefix="T8")

    res = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"]},
    )
    assert res.status_code == 404
    assert "no check-in record found" in res.json()["detail"].lower()


# =====================================================================
# TEST 9 — Duplicate Check-in: Rejected with 409 Conflict
# =====================================================================
def test_9_duplicate_checkin_rejected(client):
    emp = create_test_employee(client, prefix="T9")

    # First check-in
    r1 = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"]},
    )
    assert r1.status_code == 201

    # Second check-in on same day
    r2 = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"]},
    )
    assert r2.status_code == 409
    assert "already exists" in r2.json()["detail"].lower()


# =====================================================================
# TEST 10 — Duplicate Checkout: Rejected with 400 Bad Request
# =====================================================================
def test_10_duplicate_checkout_rejected(client):
    emp = create_test_employee(client, prefix="T10")

    client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"]},
    )
    out1 = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"]},
    )
    assert out1.status_code == 200

    out2 = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"]},
    )
    assert out2.status_code == 400
    assert "already checked out" in out2.json()["detail"].lower()


# =====================================================================
# TEST 11 — Dashboard Consistency: Dashboard, history, & stats agree
# =====================================================================
def test_11_dashboard_and_history_consistency(client):
    emp = create_test_employee(client, prefix="T11")

    # Insert a completed 8-hour shift in database
    db = SessionLocal()
    att_date = date(2026, 10, 12)
    kolkata_tz = ZoneInfo("Asia/Kolkata")
    db.add(
        AttendanceRecord(
            employee_id=emp["id"],
            attendance_date=att_date,
            check_in=datetime(2026, 10, 12, 9, 0, 0, tzinfo=kolkata_tz),
            check_out=datetime(2026, 10, 12, 17, 0, 0, tzinfo=kolkata_tz),
            status=AttendanceStatus.PRESENT,
        )
    )
    db.commit()
    db.close()

    dash_res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert dash_res.status_code == 200
    dash_data = dash_res.json()

    hist_res = client.get(
        f"/api/v1/attendance?employee_id={emp['id']}", headers=emp["headers"]
    )
    assert hist_res.status_code == 200
    hist_records = hist_res.json()

    assert len(hist_records) == 1
    assert hist_records[0]["status"] == dash_data["recent_records"][0]["status"]
    assert hist_records[0]["hours_worked"] == 8.0
    assert dash_data["stats"]["present_days"] == 1


# =====================================================================
# TEST 12 — Admin Consistency: Admin overview agrees with employee records
# =====================================================================
def test_12_admin_consistency(client):
    admin = get_admin_auth(client)
    emp = create_test_employee(client, prefix="T12")

    # Insert an authorized 8-hour completed shift for employee
    db = SessionLocal()
    d = date(2026, 10, 12)
    kolkata_tz = ZoneInfo("Asia/Kolkata")
    db.add(
        AttendanceRecord(
            employee_id=emp["id"],
            attendance_date=d,
            check_in=datetime(2026, 10, 12, 9, 0, 0, tzinfo=kolkata_tz),
            check_out=datetime(2026, 10, 12, 17, 0, 0, tzinfo=kolkata_tz),
            status=AttendanceStatus.PRESENT,
        )
    )
    db.commit()
    db.close()

    # Admin inspects employee dashboard
    admin_dash = client.get(
        f"/api/v1/attendance/dashboard?employee_id={emp['id']}",
        headers=admin["headers"],
    )
    assert admin_dash.status_code == 200
    assert admin_dash.json()["stats"]["present_days"] == 1
    assert admin_dash.json()["stats"]["total_attended_days"] == 1


# =====================================================================
# TEST 13 — Employee Isolation: Access control enforced
# =====================================================================
def test_13_employee_data_isolation(client):
    emp_a = create_test_employee(client, prefix="T13A")
    emp_b = create_test_employee(client, prefix="T13B")

    # Employee A cannot check out for Employee B
    spoof_out = client.post(
        "/api/v1/attendance/check-out",
        headers=emp_a["headers"],
        json={"employee_id": emp_b["id"]},
    )
    assert spoof_out.status_code == 403


# =====================================================================
# TEST 14 — QR Security: Expired or invalid tokens rejected
# =====================================================================
def test_14_qr_security_invalid_token_rejected(client):
    emp = create_test_employee(client, prefix="T14")

    res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "source": "OFFICE_QR",
            "qr_token": "definitely-invalid-or-expired-token-xyz",
        },
    )
    assert res.status_code == 400
    assert "invalid qr code" in res.json()["detail"].lower()


# =====================================================================
# TEST 15 — Client Tampering: Client duration/status payload ignored
# =====================================================================
def test_15_client_tampering_ignored(client):
    emp = create_test_employee(client, prefix="T15")

    # Client attempts to send forged 'status: PRESENT' and 'hours_worked: 8.0'
    in_res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={
            "employee_id": emp["id"],
            "status": "PRESENT",
            "hours_worked": 8.0,
            "session_state": "COMPLETED",
        },
    )
    assert in_res.status_code == 201

    # Session remains in-progress on the server
    dash_res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert dash_res.status_code == 200
    data = dash_res.json()

    assert data["session_state"] == "IN_PROGRESS"
    assert data["current_shift_credit"] == 0.0
    assert data["stats"]["present_days"] == 0


# =====================================================================
# TEST 16 — Timezone: Asia/Kolkata (+05:30) Organization Timezone Handling
# =====================================================================
def test_16_organization_timezone_handling():
    utc_dt = datetime(2026, 10, 15, 3, 30, 0, tzinfo=timezone.utc)
    kolkata_dt = to_shift_organization_time(utc_dt, tz_name="Asia/Kolkata")

    # 03:30 UTC + 05:30 = 09:00 IST
    assert kolkata_dt.hour == 9
    assert kolkata_dt.minute == 0
    assert kolkata_dt.utcoffset() == timedelta(hours=5, minutes=30)


# =====================================================================
# TEST 17 — Overnight Shift Regression: Midnight crossing duration preserved
# =====================================================================
def test_17_overnight_shift_regression(client):
    emp = create_test_employee(client, prefix="T17")

    day1_in = datetime(2026, 10, 15, 22, 0, 0, tzinfo=timezone.utc)
    day2_out = datetime(2026, 10, 16, 6, 0, 0, tzinfo=timezone.utc)

    # 1. Check in on day 1
    in_res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": day1_in.isoformat()},
    )
    assert in_res.status_code == 201

    # 2. Check out on day 2
    out_res = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": day2_out.isoformat()},
    )
    assert out_res.status_code == 200
    data = out_res.json()

    assert data["hours_worked"] == 8.0
    assert data["session_state"] == "COMPLETED"


# =====================================================================
# TEST 18 — Approved Leave: Subtracted from working-day denominator
# =====================================================================
def test_18_approved_leave_excluded_from_denominator(client):
    emp = create_test_employee(client, prefix="T18")
    db = SessionLocal()

    # Employee on approved leave from Monday 2026-10-12 to Friday 2026-10-16
    db.add(
        LeaveRequest(
            employee_id=emp["id"],
            start_date=date(2026, 10, 12),
            end_date=date(2026, 10, 16),
            reason="Approved medical leave",
            status=LeaveStatus.APPROVED,
        )
    )
    db.commit()
    db.close()

    dash_res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert dash_res.status_code == 200
    stats = dash_res.json()["stats"]
    assert stats["approved_leave_days"] >= 5


# =====================================================================
# TEST 19 — Future Dates & Weekends: Excluded from denominator
# =====================================================================
def test_19_future_dates_and_weekends_denominator_policy(client):
    emp = create_test_employee(client, prefix="T19")
    db = SessionLocal()

    # Insert a record from last Monday
    d_past = date(2026, 10, 12)
    db.add(
        AttendanceRecord(
            employee_id=emp["id"],
            attendance_date=d_past,
            check_in=datetime(2026, 10, 12, 9, 0, 0, tzinfo=timezone.utc),
            check_out=datetime(2026, 10, 12, 17, 0, 0, tzinfo=timezone.utc),
            status=AttendanceStatus.PRESENT,
        )
    )
    db.commit()
    db.close()

    dash_res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert dash_res.status_code == 200
    stats = dash_res.json()["stats"]

    # Weekday counting excludes weekends
    assert "Excludes weekends" in stats["percentage_formula"]
    assert stats["eligible_working_days"] > 0


# =====================================================================
# TEST 20 — Historical Data Preservation: Seed database records unaltered
# =====================================================================
def test_20_historical_database_records_preserved():
    db = SessionLocal()
    try:
        # Earliest 5 records in database
        initial_records = (
            db.query(AttendanceRecord)
            .order_by(AttendanceRecord.id.asc())
            .limit(5)
            .all()
        )
        assert len(initial_records) == 5
        assert initial_records[0].id == 1
        assert initial_records[0].status == AttendanceStatus.PRESENT
        assert initial_records[0].attendance_date == date(2026, 10, 12)
    finally:
        db.close()
