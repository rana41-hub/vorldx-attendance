import uuid
from datetime import date, timedelta


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
