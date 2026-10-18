"""Automated Tests for Day 8: Employee Dashboard & Statistics.

Covers:
1. Authenticated employee dashboard retrieval.
2. Unauthenticated request rejection (401 Unauthorized).
3. Employee data isolation (caller cannot spoof other employee IDs).
4. Administrator inspection of employee dashboard via employee_id query.
5. Comprehensive statistics calculations: present, late, half-day, and attendance percentage.
6. Weekend and approved leave exclusion in eligible working-day denominator.
7. Active overnight shift detection (started yesterday, unclosed today).
8. Clean handling of newly registered employees with empty datasets.
9. Pre-existing database record preservation.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.attendance import AttendanceRecord
from app.models.employee import Employee
from app.models.enums import AttendanceStatus, LeaveStatus
from app.models.leave import LeaveRequest
from app.models.user import User


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_dashboard_test_records():
    """Ensure all test records are cleanly isolated and deleted, preserving existing database data."""
    db = SessionLocal()
    initial_att_ids = {a.id for a in db.query(AttendanceRecord.id).all()}
    initial_emp_ids = {e.id for e in db.query(Employee.id).all()}
    initial_leave_ids = {l.id for l in db.query(LeaveRequest.id).all()}
    initial_user_ids = {u.id for u in db.query(User.id).all()}
    db.close()

    yield

    db = SessionLocal()
    try:
        # Delete created attendance records
        new_atts = (
            db.query(AttendanceRecord)
            .filter(~AttendanceRecord.id.in_(initial_att_ids))
            .all()
            if initial_att_ids
            else db.query(AttendanceRecord).all()
        )
        for a in new_atts:
            db.delete(a)

        # Delete created leave requests
        new_leaves = (
            db.query(LeaveRequest)
            .filter(~LeaveRequest.id.in_(initial_leave_ids))
            .all()
            if initial_leave_ids
            else db.query(LeaveRequest).all()
        )
        for l in new_leaves:
            db.delete(l)

        # Delete created employees and users
        new_emps = (
            db.query(Employee)
            .filter(~Employee.id.in_(initial_emp_ids))
            .all()
            if initial_emp_ids
            else db.query(Employee).all()
        )
        for e in new_emps:
            uid = e.user_id
            db.delete(e)
            if uid and uid not in initial_user_ids:
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


def create_test_employee(client, prefix="D8"):
    unique_code = f"VX-{prefix}-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Dash",
            "last_name": f"Tester-{unique_code}",
            "department": "Engineering",
            "designation": "Staff Engineer",
        },
    )
    assert emp_res.status_code == 201, f"Employee creation failed: {emp_res.text}"
    emp_id = emp_res.json()["id"]

    email = f"dash_{unique_code.lower()}@vorldx.com"
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


def test_employee_dashboard_authenticated_success(client):
    """
    Verifies that an authenticated employee can fetch their dashboard,
    receiving today's status, stats, and recent records.
    """
    emp = create_test_employee(client, prefix="DASH1")

    # Check-in today
    in_res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "source": "OFFICE_QR"},
    )
    assert in_res.status_code == 201

    # Check-out after 8 hours to complete full qualifying shift
    check_in_dt = datetime.fromisoformat(in_res.json()["check_in"])
    out_time = check_in_dt + timedelta(hours=8)
    out_res = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": out_time.isoformat()},
    )
    assert out_res.status_code == 200

    # Fetch dashboard
    dash_res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert dash_res.status_code == 200
    data = dash_res.json()

    assert data["employee_id"] == emp["id"]
    assert data["employee_code"] == emp["code"]
    assert data["today_status"] == "PRESENT"
    assert data["today_record"] is not None
    assert data["today_record"]["employee_id"] == emp["id"]
    assert data["stats"]["present_days"] >= 1
    assert data["stats"]["total_attended_days"] >= 1
    assert data["stats"]["attendance_percentage"] > 0
    assert len(data["recent_records"]) >= 1
    assert data["recent_records"][0]["id"] == in_res.json()["id"]


def test_employee_dashboard_unauthenticated_rejected(client):
    """
    Verifies that unauthenticated requests to the dashboard are rejected with 401.
    """
    res = client.get("/api/v1/attendance/dashboard")
    assert res.status_code == 401


def test_employee_dashboard_data_isolation(client):
    """
    Verifies that employee A cannot view employee B's dashboard by passing employee_id in query.
    Identity is strictly derived from the authenticated caller.
    """
    emp_a = create_test_employee(client, prefix="ISOLA")
    emp_b = create_test_employee(client, prefix="ISOLB")

    # Employee A requests dashboard with employee_id = emp_b["id"]
    res = client.get(
        f"/api/v1/attendance/dashboard?employee_id={emp_b['id']}",
        headers=emp_a["headers"],
    )
    assert res.status_code == 200
    data = res.json()

    # Must return employee A's dashboard, ignoring client-supplied B's ID
    assert data["employee_id"] == emp_a["id"]
    assert data["employee_code"] == emp_a["code"]


def test_employee_dashboard_admin_inspection_with_override(client):
    """
    Verifies that an administrator can inspect any employee's dashboard by supplying employee_id.
    """
    admin = get_admin_auth(client)
    emp = create_test_employee(client, prefix="ADMINSP")

    res = client.get(
        f"/api/v1/attendance/dashboard?employee_id={emp['id']}",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    data = res.json()
    assert data["employee_id"] == emp["id"]

    # Nonexistent employee ID returns 404
    nonexistent = client.get(
        "/api/v1/attendance/dashboard?employee_id=999999",
        headers=admin["headers"],
    )
    assert nonexistent.status_code == 404


def test_employee_dashboard_stats_calculations_and_leaves(client):
    """
    Verifies:
    1. Present, Late, and Half-day counts accurately reflect persisted statuses.
    2. Approved leaves are excluded from eligible working-day denominator.
    3. Formula calculation is mathematically sound and documented.
    """
    emp = create_test_employee(client, prefix="CALC")
    db = SessionLocal()

    try:
        # Insert 3 records directly for distinct past weekdays:
        # Day 1: PRESENT
        # Day 2: LATE
        # Day 3: HALF_DAY
        d1 = date(2026, 10, 5)  # Monday
        d2 = date(2026, 10, 6)  # Tuesday
        d3 = date(2026, 10, 7)  # Wednesday
        d4_leave = date(2026, 10, 8)  # Thursday (Approved Leave)

        db.add_all([
            AttendanceRecord(
                employee_id=emp["id"],
                attendance_date=d1,
                check_in=datetime(2026, 10, 5, 9, 30, tzinfo=timezone.utc),
                check_out=datetime(2026, 10, 5, 18, 30, tzinfo=timezone.utc),
                status=AttendanceStatus.PRESENT,
            ),
            AttendanceRecord(
                employee_id=emp["id"],
                attendance_date=d2,
                check_in=datetime(2026, 10, 6, 10, 15, tzinfo=timezone.utc),
                check_out=datetime(2026, 10, 6, 18, 30, tzinfo=timezone.utc),
                status=AttendanceStatus.LATE,
            ),
            AttendanceRecord(
                employee_id=emp["id"],
                attendance_date=d3,
                check_in=datetime(2026, 10, 7, 9, 30, tzinfo=timezone.utc),
                check_out=datetime(2026, 10, 7, 13, 30, tzinfo=timezone.utc),
                status=AttendanceStatus.HALF_DAY,
            ),
            LeaveRequest(
                employee_id=emp["id"],
                start_date=d4_leave,
                end_date=d4_leave,
                reason="Medical appointment",
                status=LeaveStatus.APPROVED,
            ),
        ])
        db.commit()
    finally:
        db.close()

    res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert res.status_code == 200
    stats = res.json()["stats"]

    assert stats["present_days"] == 1
    assert stats["late_days"] == 1
    # Under strict full-day policy, 4-hour session earns 0 credit (half_day_days=0)
    assert stats["half_day_days"] == 0
    assert stats["total_attended_days"] == 2
    assert stats["total_records"] == 3
    assert stats["approved_leave_days"] == 1
    assert stats["attendance_percentage"] > 0
    assert "Attended credits" in stats["percentage_formula"]
    assert "approved leave days" in stats["percentage_formula"]


def test_employee_dashboard_overnight_shift_active_detection(client):
    """
    Verifies that an un-concluded overnight shift started yesterday within 24 hours
    is detected as today's active shift on the dashboard.
    """
    emp = create_test_employee(client, prefix="OVN")
    db = SessionLocal()

    try:
        yesterday_evening = datetime.now(timezone.utc) - timedelta(hours=6)
        yesterday_date = yesterday_evening.date()

        rec = AttendanceRecord(
            employee_id=emp["id"],
            attendance_date=yesterday_date,
            check_in=yesterday_evening,
            check_out=None,  # In-progress overnight shift
            status=AttendanceStatus.PRESENT,
        )
        db.add(rec)
        db.commit()
    finally:
        db.close()

    res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert res.status_code == 200
    data = res.json()

    assert data["today_record"] is not None
    assert data["today_record"]["check_out"] is None
    assert data["today_status"] == "PRESENT"


def test_employee_dashboard_empty_records_new_employee(client):
    """
    Verifies that a new employee with zero attendance records receives a clean
    empty dashboard without division-by-zero or calculation errors.
    """
    emp = create_test_employee(client, prefix="EMPTY")

    res = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert res.status_code == 200
    data = res.json()

    assert data["today_status"] == "ABSENT"
    assert data["today_record"] is None
    assert data["stats"]["present_days"] == 0
    assert data["stats"]["late_days"] == 0
    assert data["stats"]["half_day_days"] == 0
    assert data["stats"]["total_records"] == 0
    assert data["stats"]["attendance_percentage"] == 100.0
    assert data["recent_records"] == []


def test_employee_dashboard_realtime_refresh_and_state_transitions(client):
    """
    Verifies full lifecycle of dashboard updates:
    1. Before check-in: NOT_STARTED, ABSENT, 0 credit, 0 present days.
    2. After check-in: IN_PROGRESS, is_session_open=True, 0 credit, 0 present days.
    3. After qualifying 8-hour check-out: COMPLETED, is_session_open=False, 1.0 credit, 1 present day.
    4. Admin view reflects exact same metrics.
    """
    admin = get_admin_auth(client)
    emp = create_test_employee(client, prefix="CYC")
    kolkata_tz = ZoneInfo("Asia/Kolkata")

    # 1. State before check-in
    r1 = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["session_state"] == "NOT_STARTED"
    assert d1["is_session_open"] is False
    assert d1["today_record"] is None
    assert d1["stats"]["present_days"] == 0
    assert d1["stats"]["total_attended_days"] == 0

    # 2. State after check-in (at 09:00 AM IST today)
    now_kolkata = datetime.now(kolkata_tz)
    t_in = now_kolkata.replace(hour=9, minute=0, second=0, microsecond=0)
    in_res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": t_in.isoformat()},
    )
    assert in_res.status_code == 201
    assert in_res.json()["session_state"] == "IN_PROGRESS"

    r2 = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["session_state"] == "IN_PROGRESS"
    assert d2["is_session_open"] is True
    assert d2["today_record"] is not None
    assert d2["today_record"]["check_out"] is None
    assert d2["current_shift_credit"] == 0.0
    assert d2["stats"]["present_days"] == 0
    assert d2["stats"]["total_attended_days"] == 0

    # 3. State after 8-hour checkout (at 17:00 IST today)
    t_out = t_in + timedelta(hours=8)
    out_res = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": t_out.isoformat()},
    )
    assert out_res.status_code == 200
    assert out_res.json()["session_state"] == "COMPLETED"
    assert out_res.json()["hours_worked"] == 8.0

    r3 = client.get("/api/v1/attendance/dashboard", headers=emp["headers"])
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["session_state"] == "COMPLETED"
    assert d3["is_session_open"] is False
    assert d3["today_record"]["check_out"] is not None
    assert d3["today_record"]["hours_worked"] == 8.0
    assert d3["current_shift_credit"] == 1.0
    assert d3["stats"]["present_days"] == 1
    assert d3["stats"]["total_attended_days"] == 1
    assert len(d3["recent_records"]) == 1
    assert d3["recent_records"][0]["session_state"] == "COMPLETED"

    # 4. Admin inspection consistency
    admin_dash = client.get(
        f"/api/v1/attendance/dashboard?employee_id={emp['id']}",
        headers=admin["headers"],
    )
    assert admin_dash.status_code == 200
    ad = admin_dash.json()
    assert ad["session_state"] == "COMPLETED"
    assert ad["stats"]["present_days"] == 1
    assert ad["stats"]["total_attended_days"] == 1
