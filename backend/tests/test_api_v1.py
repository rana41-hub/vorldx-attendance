import uuid
from datetime import date, timedelta

from app.core.security import create_access_token
from app.database import SessionLocal
from app.models.enums import UserRole
from app.models.user import User


def test_auth_status(client):
    response = client.get("/api/v1/auth/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["version"] == "v1"


def test_employee_creation_and_retrieval(client):
    unique_code = f"VX-{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "employee_code": unique_code,
        "first_name": "Sarah",
        "last_name": "Connor",
        "department": "Engineering",
        "designation": "Staff Security Architect",
        "phone": "+1-555-0199",
    }
    # Create employee
    create_res = client.post("/api/v1/employees", json=payload)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["employee_code"] == unique_code
    assert created["full_name"] == "Sarah Connor"
    employee_id = created["id"]

    # Retrieve by ID
    get_res = client.get(f"/api/v1/employees/{employee_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == employee_id

    # List employees with filter
    list_res = client.get("/api/v1/employees?department=Engineering")
    assert list_res.status_code == 200
    assert any(emp["id"] == employee_id for emp in list_res.json())

    # Duplicate code should fail with 409
    dup_res = client.post("/api/v1/employees", json=payload)
    assert dup_res.status_code == 409


def test_attendance_checkin_checkout_flow(client):
    # Create fresh employee for attendance
    unique_code = f"VX-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Marcus",
            "last_name": "Wright",
            "department": "Operations",
            "designation": "Systems Operator",
        },
    )
    assert emp_res.status_code == 201
    employee_id = emp_res.json()["id"]

    # Check in
    check_in_res = client.post(
        "/api/v1/attendance/check-in",
        json={"employee_id": employee_id, "source": "OFFICE_QR"},
    )
    assert check_in_res.status_code == 201
    record = check_in_res.json()
    assert record["employee_id"] == employee_id
    assert record["status"] == "PRESENT"
    assert record["check_out"] is None

    # Duplicate check in same day should fail with 409
    dup_res = client.post(
        "/api/v1/attendance/check-in",
        json={"employee_id": employee_id, "source": "OFFICE_QR"},
    )
    assert dup_res.status_code == 409

    # Check out
    check_out_res = client.post(
        "/api/v1/attendance/check-out",
        json={"employee_id": employee_id},
    )
    assert check_out_res.status_code == 200
    assert check_out_res.json()["check_out"] is not None

    # Second check out should fail with 400
    second_out = client.post(
        "/api/v1/attendance/check-out",
        json={"employee_id": employee_id},
    )
    assert second_out.status_code == 400


def test_leave_request_flow(client):
    unique_code = f"VX-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Kyle",
            "last_name": "Reese",
            "department": "Infrastructure",
            "designation": "Site Reliability Engineer",
        },
    )
    assert emp_res.status_code == 201
    employee_id = emp_res.json()["id"]

    today = date.today()
    start_date = today + timedelta(days=5)
    end_date = today + timedelta(days=8)

    # Valid submission
    leave_res = client.post(
        "/api/v1/leave",
        json={
            "employee_id": employee_id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "reason": "Annual team conference attendance",
        },
    )
    assert leave_res.status_code == 201
    leave_data = leave_res.json()
    assert leave_data["status"] == "PENDING"
    assert leave_data["employee_id"] == employee_id

    # Invalid end date earlier than start date
    invalid_res = client.post(
        "/api/v1/leave",
        json={
            "employee_id": employee_id,
            "start_date": end_date.isoformat(),
            "end_date": start_date.isoformat(),
            "reason": "Invalid dates",
        },
    )
    assert invalid_res.status_code == 422


def test_employee_update_flow(client):
    code_a = f"VX-{uuid.uuid4().hex[:6].upper()}"
    emp_res_a = client.post(
        "/api/v1/employees",
        json={
            "employee_code": code_a,
            "first_name": "Ada",
            "last_name": "Lovelace",
            "department": "Mathematics",
            "designation": "Analyst",
            "phone": "+1-555-0101",
        },
    )
    assert emp_res_a.status_code == 201
    emp_id_a = emp_res_a.json()["id"]

    # 1. Successful employee update with partial fields
    update_res = client.put(
        f"/api/v1/employees/{emp_id_a}",
        json={
            "designation": "Principal Computing Pioneer",
            "department": "Advanced Computing",
        },
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["designation"] == "Principal Computing Pioneer"
    assert updated_data["department"] == "Advanced Computing"
    # Preserved fields
    assert updated_data["first_name"] == "Ada"
    assert updated_data["last_name"] == "Lovelace"
    assert updated_data["employee_code"] == code_a
    assert updated_data["phone"] == "+1-555-0101"

    # 2. Updating a nonexistent employee -> 404
    non_existent_res = client.put(
        "/api/v1/employees/99999999",
        json={"first_name": "Ghost"},
    )
    assert non_existent_res.status_code == 404

    # Create second employee to test code conflict
    code_b = f"VX-{uuid.uuid4().hex[:6].upper()}"
    emp_res_b = client.post(
        "/api/v1/employees",
        json={
            "employee_code": code_b,
            "first_name": "Charles",
            "last_name": "Babbage",
            "department": "Engineering",
            "designation": "Chief Architect",
        },
    )
    assert emp_res_b.status_code == 201
    emp_id_b = emp_res_b.json()["id"]

    # 3. Duplicate employee_code conflict -> 409
    dup_res = client.put(
        f"/api/v1/employees/{emp_id_b}",
        json={"employee_code": code_a},
    )
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["detail"]

    # Updating with own employee_code should succeed without conflict
    self_code_res = client.put(
        f"/api/v1/employees/{emp_id_b}",
        json={"employee_code": code_b, "designation": "Distinguished Engineer"},
    )
    assert self_code_res.status_code == 200
    assert self_code_res.json()["designation"] == "Distinguished Engineer"


def test_employee_deletion_flow(client):
    code = f"VX-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": code,
            "first_name": "Grace",
            "last_name": "Hopper",
            "department": "Naval Computing",
            "designation": "Rear Admiral",
        },
    )
    assert emp_res.status_code == 201
    emp_id = emp_res.json()["id"]

    # 1. Deleting nonexistent employee -> 404
    non_existent_del = client.delete("/api/v1/employees/99999999")
    assert non_existent_del.status_code == 404

    # 2. Deletion when related records exist (attendance record) -> 400
    checkin_res = client.post(
        "/api/v1/attendance/check-in",
        json={"employee_id": emp_id, "source": "OFFICE_QR"},
    )
    assert checkin_res.status_code == 201

    # Attempt delete -> rejected to protect audit history
    del_with_attendance = client.delete(f"/api/v1/employees/{emp_id}")
    assert del_with_attendance.status_code == 400
    assert "historical records" in del_with_attendance.json()["detail"].lower()

    # Create another employee with leave request
    code_leave = f"VX-{uuid.uuid4().hex[:6].upper()}"
    emp_leave_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": code_leave,
            "first_name": "Alan",
            "last_name": "Turing",
            "department": "Cryptography",
            "designation": "Codebreaker",
        },
    )
    assert emp_leave_res.status_code == 201
    emp_leave_id = emp_leave_res.json()["id"]

    today = date.today()
    client.post(
        "/api/v1/leave",
        json={
            "employee_id": emp_leave_id,
            "start_date": (today + timedelta(days=2)).isoformat(),
            "end_date": (today + timedelta(days=4)).isoformat(),
            "reason": "Research retreat",
        },
    )
    # Attempt delete -> rejected because leave requests exist
    del_with_leave = client.delete(f"/api/v1/employees/{emp_leave_id}")
    assert del_with_leave.status_code == 400

    # 3. Successful deletion when permitted (clean employee)
    clean_code = f"VX-{uuid.uuid4().hex[:6].upper()}"
    clean_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": clean_code,
            "first_name": "Katherine",
            "last_name": "Johnson",
            "department": "Orbital Mechanics",
            "designation": "Lead Mathematician",
        },
    )
    assert clean_res.status_code == 201
    clean_id = clean_res.json()["id"]

    del_res = client.delete(f"/api/v1/employees/{clean_id}")
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["status"] == "success"
    assert del_data["id"] == clean_id

    # Verify subsequent GET returns 404
    get_after_del = client.get(f"/api/v1/employees/{clean_id}")
    assert get_after_del.status_code == 404


def test_leave_review_workflow_and_authorization(client):
    # Setup test users: one ADMIN, one EMPLOYEE in database
    db = SessionLocal()
    admin_email = f"admin_{uuid.uuid4().hex[:6]}@vorldx.com"
    emp_user_email = f"emp_{uuid.uuid4().hex[:6]}@vorldx.com"
    admin_user = User(
        email=admin_email,
        password_hash="mock_hash_for_testing",
        role=UserRole.ADMIN,
        is_active=True,
    )
    emp_user = User(
        email=emp_user_email,
        password_hash="mock_hash_for_testing",
        role=UserRole.EMPLOYEE,
        is_active=True,
    )
    db.add_all([admin_user, emp_user])
    db.commit()
    db.refresh(admin_user)
    db.refresh(emp_user)
    admin_id = admin_user.id
    db.close()

    admin_token = create_access_token({"sub": str(admin_id), "role": "ADMIN"})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    emp_token = create_access_token({"sub": str(emp_user.id), "role": "EMPLOYEE"})
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # Setup employee for leave request
    code = f"VX-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": code,
            "first_name": "Rosalind",
            "last_name": "Franklin",
            "department": "Biophysics",
            "designation": "Senior Researcher",
        },
    )
    assert emp_res.status_code == 201
    employee_id = emp_res.json()["id"]

    # Submit a pending leave request
    today = date.today()
    submit_res = client.post(
        "/api/v1/leave",
        json={
            "employee_id": employee_id,
            "start_date": (today + timedelta(days=10)).isoformat(),
            "end_date": (today + timedelta(days=12)).isoformat(),
            "reason": "Scientific Symposium",
        },
    )
    assert submit_res.status_code == 201
    leave_id = submit_res.json()["id"]
    assert submit_res.json()["status"] == "PENDING"

    # 1. Authorization requirement: missing token -> 401
    unauth_res = client.patch(
        f"/api/v1/leave/{leave_id}/review",
        json={"action": "APPROVE"},
    )
    assert unauth_res.status_code == 401

    # 2. Authorization requirement: invalid token -> 401
    invalid_token_res = client.patch(
        f"/api/v1/leave/{leave_id}/review",
        headers={"Authorization": "Bearer invalid_garbage_token"},
        json={"action": "APPROVE"},
    )
    assert invalid_token_res.status_code == 401

    # 3. Authorization requirement: non-admin (EMPLOYEE role) -> 403
    forbidden_res = client.patch(
        f"/api/v1/leave/{leave_id}/review",
        headers=emp_headers,
        json={"action": "APPROVE"},
    )
    assert forbidden_res.status_code == 403

    # 4. Reviewing nonexistent leave request -> 404
    non_existent_res = client.patch(
        "/api/v1/leave/99999999/review",
        headers=admin_headers,
        json={"action": "APPROVE"},
    )
    assert non_existent_res.status_code == 404

    # 5. Invalid review action -> 422
    invalid_action_res = client.patch(
        f"/api/v1/leave/{leave_id}/review",
        headers=admin_headers,
        json={"action": "MAYBE"},
    )
    assert invalid_action_res.status_code == 422

    # 6. Approving a pending request -> 200
    approve_res = client.patch(
        f"/api/v1/leave/{leave_id}/review",
        headers=admin_headers,
        json={"action": "APPROVE", "review_notes": "Coverage arranged."},
    )
    assert approve_res.status_code == 200
    app_data = approve_res.json()
    assert app_data["status"] == "APPROVED"
    assert app_data["reviewed_by"] == admin_id
    assert app_data["reviewed_at"] is not None

    # 7. Attempting to review an already reviewed request -> 400
    re_review_res = client.patch(
        f"/api/v1/leave/{leave_id}/review",
        headers=admin_headers,
        json={"action": "REJECT"},
    )
    assert re_review_res.status_code == 400
    assert "only pending requests" in re_review_res.json()["detail"].lower()

    # 8. Rejecting a pending request
    submit_res_2 = client.post(
        "/api/v1/leave",
        json={
            "employee_id": employee_id,
            "start_date": (today + timedelta(days=20)).isoformat(),
            "end_date": (today + timedelta(days=22)).isoformat(),
            "reason": "Personal time off",
        },
    )
    assert submit_res_2.status_code == 201
    leave_id_2 = submit_res_2.json()["id"]

    reject_res = client.patch(
        f"/api/v1/leave/{leave_id_2}/review",
        headers=admin_headers,
        json={"action": "REJECT", "review_notes": "Blackout period during audit."},
    )
    assert reject_res.status_code == 200
    rej_data = reject_res.json()
    assert rej_data["status"] == "REJECTED"
    assert rej_data["reviewed_by"] == admin_id
    assert rej_data["reviewed_at"] is not None

    # 9. Existing leave listing continues to reflect reviewed status
    list_res = client.get(f"/api/v1/leave?employee_id={employee_id}")
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(item["id"] == leave_id and item["status"] == "APPROVED" for item in items)
    assert any(item["id"] == leave_id_2 and item["status"] == "REJECTED" for item in items)
