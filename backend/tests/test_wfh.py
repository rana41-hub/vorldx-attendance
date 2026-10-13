import uuid
from datetime import date, timedelta
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


def create_and_activate_employee(client, prefix="WFH"):
    unique_code = f"VX-{prefix}-{uuid.uuid4().hex[:5].upper()}"
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


def test_wfh_employee_submission_success(client):
    emp = create_and_activate_employee(client, prefix="SUB")
    start = date.today() + timedelta(days=2)
    end = date.today() + timedelta(days=4)

    payload = {
        "employee_id": emp["id"],
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "reason": "Home fiber optic maintenance scheduled.",
    }

    res = client.post("/api/v1/wfh", json=payload, headers=emp["headers"])
    assert res.status_code == 201
    data = res.json()
    assert data["id"] is not None
    assert data["employee_id"] == emp["id"]
    assert data["start_date"] == start.isoformat()
    assert data["end_date"] == end.isoformat()
    assert data["reason"] == "Home fiber optic maintenance scheduled."
    assert data["status"] == "PENDING"
    assert data["reviewed_by"] is None
    assert data["reviewed_at"] is None
    assert "created_at" in data


def test_wfh_submission_date_validation(client):
    emp = create_and_activate_employee(client, prefix="DVAL")
    start = date.today() + timedelta(days=5)
    end = date.today() + timedelta(days=2)  # Earlier than start date!

    payload = {
        "employee_id": emp["id"],
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "reason": "Testing invalid date range validation.",
    }

    res = client.post("/api/v1/wfh", json=payload, headers=emp["headers"])
    assert res.status_code == 422
    assert "earlier than start date" in res.json()["detail"].lower()


def test_wfh_submission_nonexistent_employee(client):
    admin = get_admin_auth(client)
    start = date.today() + timedelta(days=1)
    end = date.today() + timedelta(days=2)

    payload = {
        "employee_id": 999999,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "reason": "Request for non-existent employee.",
    }

    res = client.post("/api/v1/wfh", json=payload, headers=admin["headers"])
    assert res.status_code == 404
    assert "employee not found" in res.json()["detail"].lower()


def test_wfh_employee_cannot_spoof_other_employee(client):
    emp_a = create_and_activate_employee(client, prefix="SPFA")
    emp_b = create_and_activate_employee(client, prefix="SPFB")

    start = date.today() + timedelta(days=1)
    end = date.today() + timedelta(days=2)

    # Emp A attempts to submit WFH request on behalf of Emp B
    payload = {
        "employee_id": emp_b["id"],
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "reason": "Attempting to spoof another employee ID.",
    }

    res = client.post("/api/v1/wfh", json=payload, headers=emp_a["headers"])
    assert res.status_code == 403
    assert "only authorized to access your own employee records" in res.json()["detail"].lower()


def test_wfh_employee_data_isolation(client):
    emp_a = create_and_activate_employee(client, prefix="ISOA")
    emp_b = create_and_activate_employee(client, prefix="ISOB")

    # Emp A creates request
    res_a = client.post(
        "/api/v1/wfh",
        json={
            "employee_id": emp_a["id"],
            "start_date": (date.today() + timedelta(days=1)).isoformat(),
            "end_date": (date.today() + timedelta(days=2)).isoformat(),
            "reason": "Emp A private WFH request.",
        },
        headers=emp_a["headers"],
    )
    assert res_a.status_code == 201
    wfh_a_id = res_a.json()["id"]

    # Emp B creates request
    res_b = client.post(
        "/api/v1/wfh",
        json={
            "employee_id": emp_b["id"],
            "start_date": (date.today() + timedelta(days=3)).isoformat(),
            "end_date": (date.today() + timedelta(days=4)).isoformat(),
            "reason": "Emp B private WFH request.",
        },
        headers=emp_b["headers"],
    )
    assert res_b.status_code == 201
    wfh_b_id = res_b.json()["id"]

    # Emp A queries /api/v1/wfh -> must only see their own request
    list_a = client.get("/api/v1/wfh", headers=emp_a["headers"])
    assert list_a.status_code == 200
    emp_a_ids = [item["id"] for item in list_a.json()]
    assert wfh_a_id in emp_a_ids
    assert wfh_b_id not in emp_a_ids

    # Emp A passes query param trying to access Emp B's requests -> server forces Emp A's ID
    leak_attempt = client.get(
        f"/api/v1/wfh?employee_id={emp_b['id']}",
        headers=emp_a["headers"],
    )
    assert leak_attempt.status_code == 200
    leak_ids = [item["id"] for item in leak_attempt.json()]
    assert wfh_b_id not in leak_ids
    assert wfh_a_id in leak_ids

    # Emp B queries /api/v1/wfh -> must only see their own request
    list_b = client.get("/api/v1/wfh", headers=emp_b["headers"])
    assert list_b.status_code == 200
    emp_b_ids = [item["id"] for item in list_b.json()]
    assert wfh_b_id in emp_b_ids
    assert wfh_a_id not in emp_b_ids


def test_wfh_admin_organization_listing_and_filtering(client):
    admin = get_admin_auth(client)
    emp_a = create_and_activate_employee(client, prefix="ADMA")
    emp_b = create_and_activate_employee(client, prefix="ADMB")

    # Create WFH request for Emp A
    res_a = client.post(
        "/api/v1/wfh",
        json={
            "employee_id": emp_a["id"],
            "start_date": (date.today() + timedelta(days=1)).isoformat(),
            "end_date": (date.today() + timedelta(days=2)).isoformat(),
            "reason": "Admin test Emp A WFH.",
        },
        headers=emp_a["headers"],
    )
    assert res_a.status_code == 201
    wfh_a_id = res_a.json()["id"]

    # Create WFH request for Emp B
    res_b = client.post(
        "/api/v1/wfh",
        json={
            "employee_id": emp_b["id"],
            "start_date": (date.today() + timedelta(days=3)).isoformat(),
            "end_date": (date.today() + timedelta(days=4)).isoformat(),
            "reason": "Admin test Emp B WFH.",
        },
        headers=emp_b["headers"],
    )
    assert res_b.status_code == 201
    wfh_b_id = res_b.json()["id"]

    # Admin lists organization-wide requests
    all_res = client.get("/api/v1/wfh", headers=admin["headers"])
    assert all_res.status_code == 200
    all_ids = [item["id"] for item in all_res.json()]
    assert wfh_a_id in all_ids
    assert wfh_b_id in all_ids

    # Admin filters by employee_id
    filter_res = client.get(
        f"/api/v1/wfh?employee_id={emp_a['id']}",
        headers=admin["headers"],
    )
    assert filter_res.status_code == 200
    filtered_items = filter_res.json()
    assert all(item["employee_id"] == emp_a["id"] for item in filtered_items)
    filtered_ids = [item["id"] for item in filtered_items]
    assert wfh_a_id in filtered_ids
    assert wfh_b_id not in filtered_ids


def test_wfh_admin_approval_workflow(client):
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="APPR")

    create_res = client.post(
        "/api/v1/wfh",
        json={
            "employee_id": emp["id"],
            "start_date": (date.today() + timedelta(days=5)).isoformat(),
            "end_date": (date.today() + timedelta(days=6)).isoformat(),
            "reason": "Need to WFH for electrical inspection.",
        },
        headers=emp["headers"],
    )
    assert create_res.status_code == 201
    wfh_id = create_res.json()["id"]

    # Admin approves request
    review_res = client.patch(
        f"/api/v1/wfh/{wfh_id}/review",
        json={"action": "APPROVE", "review_notes": "Approved for 2 days."},
        headers=admin["headers"],
    )
    assert review_res.status_code == 200
    reviewed_data = review_res.json()
    assert reviewed_data["id"] == wfh_id
    assert reviewed_data["status"] == "APPROVED"
    assert reviewed_data["reviewed_by"] == admin["user_id"]
    assert reviewed_data["reviewed_at"] is not None


def test_wfh_admin_rejection_workflow(client):
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="REJ")

    create_res = client.post(
        "/api/v1/wfh",
        json={
            "employee_id": emp["id"],
            "start_date": (date.today() + timedelta(days=7)).isoformat(),
            "end_date": (date.today() + timedelta(days=8)).isoformat(),
            "reason": "WFH request for quiet focus.",
        },
        headers=emp["headers"],
    )
    assert create_res.status_code == 201
    wfh_id = create_res.json()["id"]

    # Admin rejects request
    review_res = client.patch(
        f"/api/v1/wfh/{wfh_id}/review",
        json={"action": "REJECT", "review_notes": "On-site team presence required."},
        headers=admin["headers"],
    )
    assert review_res.status_code == 200
    reviewed_data = review_res.json()
    assert reviewed_data["id"] == wfh_id
    assert reviewed_data["status"] == "REJECTED"
    assert reviewed_data["reviewed_by"] == admin["user_id"]
    assert reviewed_data["reviewed_at"] is not None


def test_wfh_employee_cannot_review(client):
    emp = create_and_activate_employee(client, prefix="NOADM")

    create_res = client.post(
        "/api/v1/wfh",
        json={
            "employee_id": emp["id"],
            "start_date": (date.today() + timedelta(days=1)).isoformat(),
            "end_date": (date.today() + timedelta(days=2)).isoformat(),
            "reason": "Personal WFH.",
        },
        headers=emp["headers"],
    )
    assert create_res.status_code == 201
    wfh_id = create_res.json()["id"]

    # Employee tries to review their own or any request
    emp_review = client.patch(
        f"/api/v1/wfh/{wfh_id}/review",
        json={"action": "APPROVE"},
        headers=emp["headers"],
    )
    assert emp_review.status_code == 403
    assert "admin privileges required" in emp_review.json()["detail"].lower()


def test_wfh_unauthenticated_cannot_review(client):
    unauth_res = client.patch(
        "/api/v1/wfh/1/review",
        json={"action": "APPROVE"},
    )
    assert unauth_res.status_code == 401


def test_wfh_invalid_request_id_and_status_transitions(client):
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="STAT")

    # 1. Non-existent WFH request returns 404
    non_exist = client.patch(
        "/api/v1/wfh/999999/review",
        json={"action": "APPROVE"},
        headers=admin["headers"],
    )
    assert non_exist.status_code == 404
    assert "not found" in non_exist.json()["detail"].lower()

    # Create request
    create_res = client.post(
        "/api/v1/wfh",
        json={
            "employee_id": emp["id"],
            "start_date": (date.today() + timedelta(days=1)).isoformat(),
            "end_date": (date.today() + timedelta(days=2)).isoformat(),
            "reason": "Transition test.",
        },
        headers=emp["headers"],
    )
    assert create_res.status_code == 201
    wfh_id = create_res.json()["id"]

    # 2. Approve once succeeds
    ok_res = client.patch(
        f"/api/v1/wfh/{wfh_id}/review",
        json={"action": "APPROVE"},
        headers=admin["headers"],
    )
    assert ok_res.status_code == 200
    assert ok_res.json()["status"] == "APPROVED"

    # 3. Second review on already approved request fails with 400
    re_review = client.patch(
        f"/api/v1/wfh/{wfh_id}/review",
        json={"action": "REJECT"},
        headers=admin["headers"],
    )
    assert re_review.status_code == 400
    assert "only pending requests can be reviewed" in re_review.json()["detail"].lower()

    # 4. Invalid review action returns 422
    bad_action = client.patch(
        f"/api/v1/wfh/{wfh_id}/review",
        json={"action": "INVALID_ACTION"},
        headers=admin["headers"],
    )
    assert bad_action.status_code == 422


def test_wfh_approval_does_not_create_attendance_checkin(client):
    """
    CRITICAL BUSINESS RULE:
    An approved WFH request must NOT automatically create an attendance
    check-in or mark an employee present.
    """
    admin = get_admin_auth(client)
    emp = create_and_activate_employee(client, prefix="NOATT")

    # Check attendance before
    att_before = client.get(
        f"/api/v1/attendance?employee_id={emp['id']}",
        headers=admin["headers"],
    )
    assert att_before.status_code == 200
    initial_att_count = len(att_before.json())

    # Create and approve WFH request
    create_res = client.post(
        "/api/v1/wfh",
        json={
            "employee_id": emp["id"],
            "start_date": date.today().isoformat(),
            "end_date": (date.today() + timedelta(days=1)).isoformat(),
            "reason": "Business rule attendance isolation test.",
        },
        headers=emp["headers"],
    )
    assert create_res.status_code == 201
    wfh_id = create_res.json()["id"]

    approve_res = client.patch(
        f"/api/v1/wfh/{wfh_id}/review",
        json={"action": "APPROVE"},
        headers=admin["headers"],
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "APPROVED"

    # Check attendance after approval -> MUST REMAIN UNCHANGED
    att_after = client.get(
        f"/api/v1/attendance?employee_id={emp['id']}",
        headers=admin["headers"],
    )
    assert att_after.status_code == 200
    after_att_count = len(att_after.json())
    assert after_att_count == initial_att_count, (
        f"Approved WFH created attendance records! "
        f"Before: {initial_att_count}, After: {after_att_count}"
    )


def test_employee_deletion_prevented_with_wfh_history(client):
    """
    Integrity rule: Employees with WFH records cannot be deleted.
    """
    emp = create_and_activate_employee(client, prefix="DELPREV")

    # Create WFH request
    res = client.post(
        "/api/v1/wfh",
        json={
            "employee_id": emp["id"],
            "start_date": (date.today() + timedelta(days=2)).isoformat(),
            "end_date": (date.today() + timedelta(days=3)).isoformat(),
            "reason": "Historical record prevention test.",
        },
        headers=emp["headers"],
    )
    assert res.status_code == 201

    # Attempt deletion
    del_res = client.delete(f"/api/v1/employees/{emp['id']}")
    assert del_res.status_code == 400
    assert "historical records must be preserved" in del_res.json()["detail"].lower()
    assert "wfh request" in del_res.json()["detail"].lower()
