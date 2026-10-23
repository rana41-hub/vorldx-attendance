import uuid
import json
from datetime import date, datetime, time, timedelta, timezone
import pytest
from app.models.enums import AttendanceStatus


def get_admin_auth(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    user_id = login_res.json()["user"]["id"]
    return {"token": token, "user_id": user_id, "headers": {"Authorization": f"Bearer {token}"}}


def create_and_activate_employee(client, prefix="DAY10"):
    unique_code = f"VX-{prefix}-{uuid.uuid4().hex[:5].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Day10",
            "last_name": f"Tester-{unique_code}",
            "department": "Engineering",
            "designation": "QA Engineer",
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
# 7.1 Attendance Filtering Tests
# ==============================================================================

def test_attendance_filtering_by_date_and_range(client):
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="FLT")

    # Check in employee today
    now = datetime.now(timezone.utc)
    cin_res = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": now.isoformat()},
    )
    assert cin_res.status_code == 201
    today_rec = cin_res.json()
    rec_date = today_rec["attendance_date"]

    # 1. Filter by exact date
    res_exact = client.get(
        f"/api/v1/attendance?attendance_date={rec_date}",
        headers=admin["headers"],
    )
    assert res_exact.status_code == 200
    exact_records = res_exact.json()
    assert any(r["id"] == today_rec["id"] for r in exact_records)
    assert all(r["attendance_date"] == rec_date for r in exact_records)

    # 2. Filter by date range
    yesterday = (now - timedelta(days=1)).date().isoformat()
    tomorrow = (now + timedelta(days=1)).date().isoformat()
    res_range = client.get(
        f"/api/v1/attendance?start_date={yesterday}&end_date={tomorrow}&employee_id={emp['id']}",
        headers=admin["headers"],
    )
    assert res_range.status_code == 200
    range_records = res_range.json()
    assert len(range_records) == 1
    assert range_records[0]["id"] == today_rec["id"]

    # 3. Filter by employee ID
    res_emp = client.get(
        f"/api/v1/attendance?employee_id={emp['id']}",
        headers=admin["headers"],
    )
    assert res_emp.status_code == 200
    emp_records = res_emp.json()
    assert all(r["employee_id"] == emp["id"] for r in emp_records)

    # 4. Filter by status
    curr_status = today_rec["status"]
    res_status = client.get(
        f"/api/v1/attendance?status={curr_status}&employee_id={emp['id']}",
        headers=admin["headers"],
    )
    assert res_status.status_code == 200
    status_records = res_status.json()
    assert all(r["status"] == curr_status for r in status_records)

    # 5. Combined filters
    res_comb = client.get(
        f"/api/v1/attendance?start_date={yesterday}&end_date={tomorrow}&employee_id={emp['id']}&status={curr_status}",
        headers=admin["headers"],
    )
    assert res_comb.status_code == 200
    assert len(res_comb.json()) == 1

    # Combined filter with non-matching status
    diff_status = "ABSENT" if curr_status != "ABSENT" else "PRESENT"
    res_nomatch = client.get(
        f"/api/v1/attendance?start_date={yesterday}&end_date={tomorrow}&employee_id={emp['id']}&status={diff_status}",
        headers=admin["headers"],
    )
    assert res_nomatch.status_code == 200
    assert len(res_nomatch.json()) == 0

    # 6. Invalid reversed date range (start_date > end_date) -> 422
    res_inv = client.get(
        f"/api/v1/attendance?start_date={tomorrow}&end_date={yesterday}",
        headers=admin["headers"],
    )
    assert res_inv.status_code == 422
    assert "start_date cannot be later than end_date" in res_inv.text


def test_attendance_authorization_and_data_isolation(client):
    emp_a = create_and_activate_employee(client, prefix="ISOLA")
    emp_b = create_and_activate_employee(client, prefix="ISOLB")

    # Check in emp_a
    now = datetime.now(timezone.utc)
    client.post(
        "/api/v1/attendance/check-in",
        headers=emp_a["headers"],
        json={"employee_id": emp_a["id"], "timestamp": now.isoformat()},
    )

    # 1. Unauthenticated request -> 401
    res_unauth = client.get("/api/v1/attendance")
    assert res_unauth.status_code == 401

    # 2. Employee queries their own records -> 200, only their own records returned
    res_emp_a = client.get("/api/v1/attendance", headers=emp_a["headers"])
    assert res_emp_a.status_code == 200
    for r in res_emp_a.json():
        assert r["employee_id"] == emp_a["id"]

    # 3. Employee attempts to query other employee's records via ?employee_id -> isolated to caller only
    res_spoof = client.get(
        f"/api/v1/attendance?employee_id={emp_a['id']}",
        headers=emp_b["headers"],
    )
    assert res_spoof.status_code == 200
    # Emp B gets only Emp B's records (which is empty or only B's)
    for r in res_spoof.json():
        assert r["employee_id"] == emp_b["id"]
        assert r["employee_id"] != emp_a["id"]


# ==============================================================================
# 7.2 Attendance Policy Configuration Tests
# ==============================================================================

def test_attendance_policy_admin_read_and_update(client):
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="POL")

    # 1. Read current policy
    read_res = client.get("/api/v1/attendance/policy")
    assert read_res.status_code == 200
    orig_policy = read_res.json()
    assert "work_start_time" in orig_policy
    assert "work_end_time" in orig_policy
    assert "late_grace_minutes" in orig_policy

    # 2. Employee cannot update policy -> 403
    emp_update = client.put(
        "/api/v1/attendance/policy",
        headers=emp["headers"],
        json={"late_grace_minutes": 20},
    )
    assert emp_update.status_code == 403

    # 3. Unauthenticated cannot update policy -> 401
    unauth_update = client.put(
        "/api/v1/attendance/policy",
        json={"late_grace_minutes": 20},
    )
    assert unauth_update.status_code == 401

    # 4. Invalid policy values rejected:
    # Negative grace period -> 422
    neg_grace = client.put(
        "/api/v1/attendance/policy",
        headers=admin["headers"],
        json={"late_grace_minutes": -5},
    )
    assert neg_grace.status_code == 422

    # Identical start and end times -> 422
    same_times = client.put(
        "/api/v1/attendance/policy",
        headers=admin["headers"],
        json={"work_start_time": "09:00:00", "work_end_time": "09:00:00"},
    )
    assert same_times.status_code == 422

    # 5. Authorized Admin update succeeds and persists
    valid_update = client.put(
        "/api/v1/attendance/policy",
        headers=admin["headers"],
        json={
            "late_grace_minutes": 18,
            "reason": "Administrative grace period adjustment for monsoon season",
        },
    )
    assert valid_update.status_code == 200
    updated_data = valid_update.json()
    assert updated_data["late_grace_minutes"] == 18

    # Verify persistence via fresh GET
    fresh_read = client.get("/api/v1/attendance/policy")
    assert fresh_read.status_code == 200
    assert fresh_read.json()["late_grace_minutes"] == 18

    # Verify audit log was created for policy update
    audit_res = client.get(
        "/api/v1/attendance/audit-logs?action_type=POLICY_UPDATE",
        headers=admin["headers"],
    )
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) > 0
    latest_log = logs[0]
    assert latest_log["action_type"] == "POLICY_UPDATE"
    assert "monsoon season" in latest_log["reason"]
    assert latest_log["admin_id"] == admin["user_id"]
    assert latest_log["updated_values"]["late_grace_minutes"] == 18

    # Revert grace period back to 15 to maintain test isolation
    revert_res = client.put(
        "/api/v1/attendance/policy",
        headers=admin["headers"],
        json={"late_grace_minutes": 15, "reason": "Reverting test grace period"},
    )
    assert revert_res.status_code == 200


# ==============================================================================
# 7.3 Authorized Attendance Corrections Tests
# ==============================================================================

def test_attendance_correction_success_and_validation(client):
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="CORR")

    # Check in and check out
    in_time = datetime(2026, 10, 10, 9, 30, 0, tzinfo=timezone.utc)
    out_time = datetime(2026, 10, 10, 17, 30, 0, tzinfo=timezone.utc)

    cin = client.post(
        "/api/v1/attendance/check-in",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": in_time.isoformat()},
    )
    assert cin.status_code == 201
    rec_id = cin.json()["id"]

    cout = client.post(
        "/api/v1/attendance/check-out",
        headers=emp["headers"],
        json={"employee_id": emp["id"], "timestamp": out_time.isoformat()},
    )
    assert cout.status_code == 200

    # 1. Missing reason or whitespace-only reason rejected -> 422
    no_reason = client.patch(
        f"/api/v1/attendance/{rec_id}/correct",
        headers=admin["headers"],
        json={"status": "PRESENT", "reason": "   "},
    )
    assert no_reason.status_code == 422

    # 2. Check-out earlier than check-in rejected -> 422
    bad_times = client.patch(
        f"/api/v1/attendance/{rec_id}/correct",
        headers=admin["headers"],
        json={
            "check_in": "2026-10-10T18:00:00Z",
            "check_out": "2026-10-10T09:00:00Z",
            "reason": "Faulty timestamps test",
        },
    )
    assert bad_times.status_code == 422
    assert "cannot be earlier than" in bad_times.text

    # 3. Employee cannot perform correction -> 403
    emp_attempt = client.patch(
        f"/api/v1/attendance/{rec_id}/correct",
        headers=emp["headers"],
        json={"status": "PRESENT", "reason": "Self-correcting attendance"},
    )
    assert emp_attempt.status_code == 403

    # 4. Unauthenticated cannot perform correction -> 401
    unauth_attempt = client.patch(
        f"/api/v1/attendance/{rec_id}/correct",
        json={"status": "PRESENT", "reason": "Anonymous attempt"},
    )
    assert unauth_attempt.status_code == 401

    # 5. Non-existent record ID -> 404
    non_existent = client.patch(
        "/api/v1/attendance/99999999/correct",
        headers=admin["headers"],
        json={"status": "PRESENT", "reason": "Non-existent record test"},
    )
    assert non_existent.status_code == 404

    # 6. Authorized Admin correction succeeds
    corr_in = datetime(2026, 10, 10, 9, 0, 0, tzinfo=timezone.utc)
    corr_out = datetime(2026, 10, 10, 17, 0, 0, tzinfo=timezone.utc)
    valid_corr = client.patch(
        f"/api/v1/attendance/{rec_id}/correct",
        headers=admin["headers"],
        json={
            "check_in": corr_in.isoformat(),
            "check_out": corr_out.isoformat(),
            "status": "PRESENT",
            "reason": "Biometric terminal failure at main entrance; manager verified manual arrival at 9 AM.",
        },
    )
    assert valid_corr.status_code == 200
    corr_data = valid_corr.json()
    assert corr_data["id"] == rec_id
    assert corr_data["status"] == "PRESENT"
    assert corr_data["is_corrected"] is True
    assert corr_data["corrected_by"] == admin["user_id"]
    assert corr_data["corrected_at"] is not None

    # Verify persistent state via listing
    list_res = client.get(
        f"/api/v1/attendance?employee_id={emp['id']}",
        headers=admin["headers"],
    )
    assert list_res.status_code == 200
    found_rec = next(r for r in list_res.json() if r["id"] == rec_id)
    assert found_rec["is_corrected"] is True
    assert found_rec["status"] == "PRESENT"

    # 7. Verify persistent AuditLog
    audit_res = client.get(
        f"/api/v1/attendance/audit-logs?attendance_record_id={rec_id}",
        headers=admin["headers"],
    )
    assert audit_res.status_code == 200
    corr_logs = audit_res.json()
    assert len(corr_logs) >= 1
    corr_log = corr_logs[0]
    assert corr_log["action_type"] == "ATTENDANCE_CORRECTION"
    assert corr_log["attendance_record_id"] == rec_id
    assert corr_log["employee_id"] == emp["id"]
    assert corr_log["admin_id"] == admin["user_id"]
    assert "Biometric terminal failure" in corr_log["reason"]
    assert corr_log["previous_values"] is not None
    assert corr_log["updated_values"]["status"] == "PRESENT"


# ==============================================================================
# 7.4 Persistent Audit Trail & Authorization Tests
# ==============================================================================

def test_audit_logs_authorization_and_integrity(client):
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="AUD")

    # 1. Employee cannot view audit logs -> 403
    emp_get = client.get("/api/v1/attendance/audit-logs", headers=emp["headers"])
    assert emp_get.status_code == 403

    # 2. Unauthenticated cannot view audit logs -> 401
    unauth_get = client.get("/api/v1/attendance/audit-logs")
    assert unauth_get.status_code == 401

    # 3. Admin can list audit logs with pagination and filters
    all_logs_res = client.get(
        "/api/v1/attendance/audit-logs?limit=10&offset=0",
        headers=admin["headers"],
    )
    assert all_logs_res.status_code == 200
    all_logs = all_logs_res.json()
    assert isinstance(all_logs, list)

    # 4. Filter audit logs by action_type
    policy_logs = client.get(
        "/api/v1/attendance/audit-logs?action_type=POLICY_UPDATE",
        headers=admin["headers"],
    )
    assert policy_logs.status_code == 200
    for l in policy_logs.json():
        assert l["action_type"] == "POLICY_UPDATE"
