import uuid
from datetime import date, timedelta
import pytest


def test_admin_login_flow(client):
    # 1. Admin login with Admin ID succeeds
    res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["admin_id"] == "ADM-001"
    admin_token = data["access_token"]

    # 2. Rejection of email as login identifier (strictly require Admin ID)
    email_res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "admin@vorldx.com", "password": "Admin@VorldX2026"},
    )
    assert email_res.status_code == 401

    # 3. Invalid password fails
    wrong_pw = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "WrongPassword999"},
    )
    assert wrong_pw.status_code == 401

    # 4. GET /auth/me returns admin profile
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["admin_id"] == "ADM-001"
    assert me_res.json()["role"] == "ADMIN"


def test_employee_activation_and_login_flow(client):
    # 1. HR registers employee record (without credentials yet)
    unique_code = f"VX-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Alan",
            "last_name": "Kay",
            "department": "Research",
            "designation": "Fellow",
        },
    )
    assert emp_res.status_code == 201
    employee_id = emp_res.json()["id"]

    # 2. Login before activation fails with 400
    unact_res = client.post(
        "/api/v1/auth/login",
        json={"login_id": unique_code, "password": "SomePassword123"},
    )
    assert unact_res.status_code == 400
    assert "not activated" in unact_res.json()["detail"].lower()

    # 3. Activation for non-existent employee fails with 404
    non_exist_act = client.post(
        "/api/v1/auth/activate",
        json={
            "employee_code": "NON-EXISTENT-CODE",
            "email": f"ghost_{uuid.uuid4().hex[:6]}@vorldx.com",
            "password": "Password12345",
        },
    )
    assert non_exist_act.status_code == 404

    # 4. Successful employee self-activation
    emp_email = f"alan_{uuid.uuid4().hex[:6]}@vorldx.com"
    act_res = client.post(
        "/api/v1/auth/activate",
        json={
            "employee_code": unique_code,
            "email": emp_email,
            "password": "SecurePassword123",
        },
    )
    assert act_res.status_code == 201
    act_data = act_res.json()
    assert "access_token" in act_data
    assert act_data["user"]["employee_code"] == unique_code
    assert act_data["user"]["role"] == "EMPLOYEE"

    # 5. Duplicate activation attempt fails with 400
    dup_act = client.post(
        "/api/v1/auth/activate",
        json={
            "employee_code": unique_code,
            "email": f"another_{uuid.uuid4().hex[:6]}@vorldx.com",
            "password": "SecurePassword123",
        },
    )
    assert dup_act.status_code == 400

    # 6. Employee login with Employee ID succeeds
    login_res = client.post(
        "/api/v1/auth/login",
        json={"login_id": unique_code, "password": "SecurePassword123"},
    )
    assert login_res.status_code == 200
    emp_token = login_res.json()["access_token"]
    assert login_res.json()["user"]["employee_code"] == unique_code
    assert login_res.json()["user"]["employee_id"] == employee_id

    # 7. Employee login with email fails (strictly require Employee ID)
    email_fail = client.post(
        "/api/v1/auth/login",
        json={"login_id": emp_email, "password": "SecurePassword123"},
    )
    assert email_fail.status_code == 401

    # 8. GET /auth/me returns employee profile
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["employee_code"] == unique_code
    assert me_res.json()["role"] == "EMPLOYEE"


def test_account_deactivation_enforcement(client):
    # Admin login
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create & activate employee
    code = f"VX-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": code,
            "first_name": "John",
            "last_name": "Backus",
            "department": "Compilers",
            "designation": "Lead",
        },
    )
    emp_id = emp_res.json()["id"]

    client.post(
        "/api/v1/auth/activate",
        json={
            "employee_code": code,
            "email": f"john_{uuid.uuid4().hex[:6]}@vorldx.com",
            "password": "Password12345",
        },
    )

    # Admin deactivates account
    deact_res = client.patch(
        f"/api/v1/employees/{emp_id}/status",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert deact_res.status_code == 200
    assert deact_res.json()["is_active"] is False

    # Login attempt for deactivated employee fails with 403
    login_attempt = client.post(
        "/api/v1/auth/login",
        json={"login_id": code, "password": "Password12345"},
    )
    assert login_attempt.status_code == 403

    # Admin reactivates account
    react_res = client.patch(
        f"/api/v1/employees/{emp_id}/status",
        headers=admin_headers,
        json={"is_active": True},
    )
    assert react_res.status_code == 200

    # Login now succeeds
    success_login = client.post(
        "/api/v1/auth/login",
        json={"login_id": code, "password": "Password12345"},
    )
    assert success_login.status_code == 200


def test_data_isolation_between_employees(client):
    # Setup Employee A
    code_a = f"VX-{uuid.uuid4().hex[:6].upper()}"
    emp_a = client.post(
        "/api/v1/employees",
        json={
            "employee_code": code_a,
            "first_name": "Alice",
            "last_name": "Smith",
            "department": "Security",
            "designation": "Specialist",
        },
    ).json()
    emp_a_id = emp_a["id"]

    act_a = client.post(
        "/api/v1/auth/activate",
        json={
            "employee_code": code_a,
            "email": f"alice_{uuid.uuid4().hex[:6]}@vorldx.com",
            "password": "Password12345",
        },
    ).json()
    token_a = act_a["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Setup Employee B
    code_b = f"VX-{uuid.uuid4().hex[:6].upper()}"
    emp_b = client.post(
        "/api/v1/employees",
        json={
            "employee_code": code_b,
            "first_name": "Bob",
            "last_name": "Jones",
            "department": "Finance",
            "designation": "Analyst",
        },
    ).json()
    emp_b_id = emp_b["id"]

    act_b = client.post(
        "/api/v1/auth/activate",
        json={
            "employee_code": code_b,
            "email": f"bob_{uuid.uuid4().hex[:6]}@vorldx.com",
            "password": "Password12345",
        },
    ).json()
    token_b = act_b["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Employee A checks in
    client.post(
        "/api/v1/attendance/check-in",
        headers=headers_a,
        json={"employee_id": emp_a_id, "source": "OFFICE_QR"},
    )

    # 1. Employee B tries to check-in using Employee A's ID -> 403 Forbidden
    spoof_checkin = client.post(
        "/api/v1/attendance/check-in",
        headers=headers_b,
        json={"employee_id": emp_a_id, "source": "OFFICE_QR"},
    )
    assert spoof_checkin.status_code == 403

    # 2. Employee B attempts to query Employee A's attendance -> isolated to B only (empty)
    b_query_a_att = client.get(
        f"/api/v1/attendance?employee_id={emp_a_id}",
        headers=headers_b,
    )
    assert b_query_a_att.status_code == 200
    assert not any(rec["employee_id"] == emp_a_id for rec in b_query_a_att.json())

    # 3. Employee A queries their attendance -> receives their record
    a_query = client.get("/api/v1/attendance", headers=headers_a)
    assert a_query.status_code == 200
    assert any(rec["employee_id"] == emp_a_id for rec in a_query.json())

    # 4. Employee A submits leave request
    today = date.today()
    client.post(
        "/api/v1/leave",
        headers=headers_a,
        json={
            "employee_id": emp_a_id,
            "start_date": (today + timedelta(days=5)).isoformat(),
            "end_date": (today + timedelta(days=7)).isoformat(),
            "reason": "Family gathering",
        },
    )

    # 5. Employee B tries to submit leave for Employee A -> 403 Forbidden
    spoof_leave = client.post(
        "/api/v1/leave",
        headers=headers_b,
        json={
            "employee_id": emp_a_id,
            "start_date": (today + timedelta(days=5)).isoformat(),
            "end_date": (today + timedelta(days=7)).isoformat(),
            "reason": "Spoofed request",
        },
    )
    assert spoof_leave.status_code == 403

    # 6. Employee B queries leave requests -> isolated to B (does not see A's request)
    b_leave_query = client.get(
        f"/api/v1/leave?employee_id={emp_a_id}",
        headers=headers_b,
    )
    assert b_leave_query.status_code == 200
    assert not any(r["employee_id"] == emp_a_id for r in b_leave_query.json())

    # 7. Admin can query Employee A's attendance and leave
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    admin_att = client.get(
        f"/api/v1/attendance?employee_id={emp_a_id}",
        headers=admin_headers,
    )
    assert admin_att.status_code == 200
    assert any(rec["employee_id"] == emp_a_id for rec in admin_att.json())
