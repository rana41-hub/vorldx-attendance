import uuid
from datetime import date, datetime, time, timedelta, timezone
import pytest


def get_admin_auth(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    user_id = login_res.json()["user"]["id"]
    return {"token": token, "user_id": user_id, "headers": {"Authorization": f"Bearer {token}"}}


def create_and_activate_employee(client, prefix="ANL"):
    unique_code = f"VX-{prefix}-{uuid.uuid4().hex[:5].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Analytic",
            "last_name": f"User-{unique_code}",
            "department": "Analytics",
            "designation": "Data Scientist",
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


# =====================================================================
# 1. ATTENDANCE POLICY ENDPOINTS AND PERMISSION TESTS
# =====================================================================


def test_get_attendance_policy(client):
    res = client.get("/api/v1/attendance/policy")
    assert res.status_code == 200
    data = res.json()
    assert "work_start_time" in data
    assert "work_end_time" in data
    assert "late_grace_minutes" in data
    assert "early_departure_grace_minutes" in data
    assert "half_day_hours_threshold" in data
    assert "full_day_hours_threshold" in data
    assert "auto_detect_late_arrival" in data


def test_update_attendance_policy_admin_only(client):
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="POL")

    # 1. Admin updates policy
    update_payload = {
        "late_grace_minutes": 25,
        "early_departure_grace_minutes": 20,
    }
    update_res = client.put(
        "/api/v1/attendance/policy",
        json=update_payload,
        headers=admin["headers"],
    )
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["late_grace_minutes"] == 25
    assert data["early_departure_grace_minutes"] == 20
    assert data["updated_by"] == admin["user_id"]

    # 2. Ordinary employee is forbidden from updating policy
    emp_res = client.put(
        "/api/v1/attendance/policy",
        json={"late_grace_minutes": 30},
        headers=emp["headers"],
    )
    assert emp_res.status_code == 403
    assert "admin privileges required" in emp_res.json()["detail"].lower()

    # 3. Unauthenticated request is rejected
    unauth_res = client.put(
        "/api/v1/attendance/policy",
        json={"late_grace_minutes": 30},
    )
    assert unauth_res.status_code == 401

    # Restore default policy
    client.put(
        "/api/v1/attendance/policy",
        json={
            "late_grace_minutes": 15,
            "early_departure_grace_minutes": 15,
            "auto_detect_late_arrival": False,
            "auto_detect_early_departure": False,
        },
        headers=admin["headers"],
    )


def test_policy_calculation_simulation(client):
    # Simulation: On-time check-in and full day
    on_time_res = client.post(
        "/api/v1/attendance/policy/calculate",
        json={
            "check_in": "2026-10-15T09:15:00Z",
            "check_out": "2026-10-15T18:30:00Z",
        },
    )
    assert on_time_res.status_code == 200
    data = on_time_res.json()
    assert data["status"] == "PRESENT"
    assert data["hours_worked"] == 9.25

    # Simulation with policy enabling late detection
    admin = get_admin_auth(client)
    client.put(
        "/api/v1/attendance/policy",
        json={"auto_detect_late_arrival": True, "late_grace_minutes": 15},
        headers=admin["headers"],
    )

    # Late arrival at 10:15
    late_res = client.post(
        "/api/v1/attendance/policy/calculate",
        json={
            "check_in": "2026-10-15T10:15:00Z",
            "check_out": "2026-10-15T18:30:00Z",
        },
    )
    assert late_res.status_code == 200
    assert late_res.json()["is_late"] is True
    assert late_res.json()["status"] == "LATE"

    # Restore
    client.put(
        "/api/v1/attendance/policy",
        json={"auto_detect_late_arrival": False},
        headers=admin["headers"],
    )


# =====================================================================
# 2. LATE ARRIVAL AND EARLY DEPARTURE ENFORCEMENT
# =====================================================================


def test_policy_late_arrival_and_early_departure_enforcement(client):
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="ENF")

    # Enable policy enforcement
    client.put(
        "/api/v1/attendance/policy",
        json={
            "auto_detect_late_arrival": True,
            "auto_detect_early_departure": True,
            "work_start_time": "09:30:00",
            "late_grace_minutes": 15,
            "half_day_hours_threshold": 4.0,
        },
        headers=admin["headers"],
    )

    # Today's date with check-in at 10:30 (Late!)
    today = date.today()
    late_check_in_dt = datetime(
        today.year, today.month, today.day, 10, 30, 0, tzinfo=timezone.utc
    )

    check_in_res = client.post(
        "/api/v1/attendance/check-in",
        json={
            "employee_id": emp["id"],
            "source": "OFFICE_QR",
            "timestamp": late_check_in_dt.isoformat(),
        },
        headers=emp["headers"],
    )
    assert check_in_res.status_code == 201
    assert check_in_res.json()["status"] == "LATE"

    # Check out only 2 hours later (less than 4 hours half-day threshold)
    early_check_out_dt = datetime(
        today.year, today.month, today.day, 12, 30, 0, tzinfo=timezone.utc
    )
    check_out_res = client.post(
        "/api/v1/attendance/check-out",
        json={
            "employee_id": emp["id"],
            "timestamp": early_check_out_dt.isoformat(),
        },
        headers=emp["headers"],
    )
    assert check_out_res.status_code == 200
    assert check_out_res.json()["status"] == "HALF_DAY"

    # Restore default policy for other tests
    client.put(
        "/api/v1/attendance/policy",
        json={
            "work_start_time": "09:00:00",
            "auto_detect_late_arrival": False,
            "auto_detect_early_departure": False,
        },
        headers=admin["headers"],
    )


# =====================================================================
# 3. DUPLICATE AND INVALID ATTENDANCE OPERATIONS
# =====================================================================


def test_duplicate_checkin_and_invalid_checkout(client):
    emp = create_and_activate_employee(client, prefix="DUP")

    # 1. Invalid checkout without prior check-in returns 404
    no_checkin_out = client.post(
        "/api/v1/attendance/check-out",
        json={"employee_id": emp["id"]},
        headers=emp["headers"],
    )
    assert no_checkin_out.status_code == 404
    assert "no check-in record found" in no_checkin_out.json()["detail"].lower()

    # 2. Check in succeeds
    in_res = client.post(
        "/api/v1/attendance/check-in",
        json={"employee_id": emp["id"]},
        headers=emp["headers"],
    )
    assert in_res.status_code == 201

    # 3. Duplicate check-in on the same day fails with 409
    dup_res = client.post(
        "/api/v1/attendance/check-in",
        json={"employee_id": emp["id"]},
        headers=emp["headers"],
    )
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["detail"].lower()

    # 4. First check-out succeeds
    out_res = client.post(
        "/api/v1/attendance/check-out",
        json={"employee_id": emp["id"]},
        headers=emp["headers"],
    )
    assert out_res.status_code == 200

    # 5. Duplicate check-out fails with 400
    dup_out = client.post(
        "/api/v1/attendance/check-out",
        json={"employee_id": emp["id"]},
        headers=emp["headers"],
    )
    assert dup_out.status_code == 400
    assert "already checked out" in dup_out.json()["detail"].lower()


# =====================================================================
# 4. ANALYTICS ACCESS CONTROL & AUTHORIZATION
# =====================================================================


def test_analytics_endpoints_require_admin(client):
    emp = create_and_activate_employee(client, prefix="UNAUTH")

    # Employee forbidden from dashboard metrics
    d_res = client.get("/api/v1/analytics/dashboard", headers=emp["headers"])
    assert d_res.status_code == 403
    assert "admin privileges required" in d_res.json()["detail"].lower()

    # Employee forbidden from summary
    s_res = client.get(
        "/api/v1/analytics/summary?start_date=2026-10-01&end_date=2026-10-07",
        headers=emp["headers"],
    )
    assert s_res.status_code == 403

    # Employee forbidden from trends
    t_res = client.get("/api/v1/analytics/trends", headers=emp["headers"])
    assert t_res.status_code == 403

    # Unauthenticated rejected with 401
    assert client.get("/api/v1/analytics/dashboard").status_code == 401
    assert client.get("/api/v1/analytics/summary?start_date=2026-10-01&end_date=2026-10-07").status_code == 401
    assert client.get("/api/v1/analytics/trends").status_code == 401


# =====================================================================
# 5. DASHBOARD METRICS CALCULATION AND CLASSIFICATION
# =====================================================================


def test_dashboard_metrics_calculation_and_classification(client):
    admin = get_admin_auth(client)

    # Create 4 dedicated employees
    emp_present = create_and_activate_employee(client, prefix="MPRES")
    emp_leave = create_and_activate_employee(client, prefix="MLEAV")
    emp_wfh = create_and_activate_employee(client, prefix="MWFH")
    emp_absent = create_and_activate_employee(client, prefix="MABSN")

    today = date.today()

    # 1. Emp Present checks in today
    res_in = client.post(
        "/api/v1/attendance/check-in",
        json={"employee_id": emp_present["id"]},
        headers=emp_present["headers"],
    )
    assert res_in.status_code == 201

    # 2. Emp Leave submits leave covering today, Admin approves
    leave_res = client.post(
        "/api/v1/leave",
        json={
            "employee_id": emp_leave["id"],
            "start_date": today.isoformat(),
            "end_date": (today + timedelta(days=2)).isoformat(),
            "reason": "Family emergency leave.",
        },
        headers=emp_leave["headers"],
    )
    assert leave_res.status_code == 201
    leave_id = leave_res.json()["id"]

    approve_leave = client.patch(
        f"/api/v1/leave/{leave_id}/review",
        json={"action": "APPROVE"},
        headers=admin["headers"],
    )
    assert approve_leave.status_code == 200

    # 3. Emp WFH submits WFH covering today, Admin approves
    wfh_res = client.post(
        "/api/v1/wfh",
        json={
            "employee_id": emp_wfh["id"],
            "start_date": today.isoformat(),
            "end_date": (today + timedelta(days=1)).isoformat(),
            "reason": "Home equipment inspection.",
        },
        headers=emp_wfh["headers"],
    )
    assert wfh_res.status_code == 201
    wfh_id = wfh_res.json()["id"]

    approve_wfh = client.patch(
        f"/api/v1/wfh/{wfh_id}/review",
        json={"action": "APPROVE"},
        headers=admin["headers"],
    )
    assert approve_wfh.status_code == 200

    # 4. Emp Absent takes no action -> should be categorized as ABSENT

    # Fetch dashboard metrics
    dash_res = client.get(
        f"/api/v1/analytics/dashboard?target_date={today.isoformat()}",
        headers=admin["headers"],
    )
    assert dash_res.status_code == 200
    metrics = dash_res.json()

    assert metrics["date"] == today.isoformat()
    assert metrics["total_active_employees"] >= 4
    assert metrics["present_today"] >= 1
    assert metrics["on_leave_today"] >= 1
    assert metrics["wfh_today"] >= 1
    assert metrics["absent_today"] >= 1

    # Verify approved WFH did NOT create an attendance record for emp_wfh
    emp_wfh_att = client.get(
        f"/api/v1/attendance?employee_id={emp_wfh['id']}&attendance_date={today.isoformat()}",
        headers=admin["headers"],
    )
    assert emp_wfh_att.status_code == 200
    assert len(emp_wfh_att.json()) == 0


# =====================================================================
# 6. ATTENDANCE SUMMARY & DATE RANGE VALIDATION
# =====================================================================


def test_attendance_summary_calculations_and_validation(client):
    admin = get_admin_auth(client)
    today = date.today()

    # 1. Invalid date range (end_date < start_date) returns 422
    inv_res = client.get(
        f"/api/v1/analytics/summary?start_date={today.isoformat()}&end_date={(today - timedelta(days=1)).isoformat()}",
        headers=admin["headers"],
    )
    assert inv_res.status_code == 422
    assert "earlier than start date" in inv_res.json()["detail"].lower()

    # 2. Date range exceeding 366 days returns 422
    large_res = client.get(
        f"/api/v1/analytics/summary?start_date=2024-01-01&end_date=2026-01-01",
        headers=admin["headers"],
    )
    assert large_res.status_code == 422
    assert "cannot exceed 366 days" in large_res.json()["detail"].lower()

    # 3. Valid summary request
    start = today - timedelta(days=6)
    end = today
    sum_res = client.get(
        f"/api/v1/analytics/summary?start_date={start.isoformat()}&end_date={end.isoformat()}",
        headers=admin["headers"],
    )
    assert sum_res.status_code == 200
    data = sum_res.json()
    assert data["start_date"] == start.isoformat()
    assert data["end_date"] == end.isoformat()
    assert data["total_days"] == 7
    assert data["total_active_employees"] >= 1
    assert "total_attendance_records" in data
    assert "average_daily_attendance" in data
    assert "attendance_rate_percentage" in data


# =====================================================================
# 7. ATTENDANCE TRENDS & TIME-SERIES CHARTS
# =====================================================================


def test_attendance_trends_calculations_and_validation(client):
    admin = get_admin_auth(client)
    today = date.today()

    # 1. Invalid date range returns 422
    inv_res = client.get(
        f"/api/v1/analytics/trends?start_date={today.isoformat()}&end_date={(today - timedelta(days=2)).isoformat()}",
        headers=admin["headers"],
    )
    assert inv_res.status_code == 422

    # 2. Trends exceeding 90 days returns 422
    large_res = client.get(
        f"/api/v1/analytics/trends?start_date={(today - timedelta(days=95)).isoformat()}&end_date={today.isoformat()}",
        headers=admin["headers"],
    )
    assert large_res.status_code == 422
    assert "cannot exceed 90 days" in large_res.json()["detail"].lower()

    # 3. Valid trends request
    trends_res = client.get(
        f"/api/v1/analytics/trends?start_date={(today - timedelta(days=4)).isoformat()}&end_date={today.isoformat()}",
        headers=admin["headers"],
    )
    assert trends_res.status_code == 200
    data = trends_res.json()
    assert len(data["trends"]) == 5
    for item in data["trends"]:
        assert "date" in item
        assert "present" in item
        assert "late" in item
        assert "half_day" in item
        assert "on_leave" in item
        assert "wfh" in item
        assert "absent" in item
        assert "total_active" in item
