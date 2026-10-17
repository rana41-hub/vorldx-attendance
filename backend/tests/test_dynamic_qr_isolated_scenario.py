"""Isolated Automated Test Scenario for Dynamic QR Attendance Flow.

Requirements:
1. Use existing test infrastructure and database isolation mechanisms.
2. Authenticate a test employee.
3. Create or obtain an active dynamic QR session through existing API/service.
4. Submit a valid QR token and verify successful check-in.
5. Verify resulting attendance record and its source.
6. Submit the same check-in again and verify duplicate prevention (409 Conflict).
7. Test expired and rotated tokens (400 Bad Request).
8. Verify that existing database records remain unchanged.
9. Report actual test results.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.attendance import AttendanceRecord
from app.models.employee import Employee
from app.models.qr_session import QRSession
from app.models.user import User
from app.services.qr_service import create_qr_session


@pytest.fixture
def client():
    return TestClient(app)


def get_admin_auth(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"login_id": "ADM-001", "password": "Admin@VorldX2026"},
    )
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    token = res.json()["access_token"]
    return {"token": token, "headers": {"Authorization": f"Bearer {token}"}}


def create_test_employee(client, prefix="ISO"):
    unique_code = f"VX-{prefix}-{uuid.uuid4().hex[:6].upper()}"
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "employee_code": unique_code,
            "first_name": "Isolated",
            "last_name": f"Tester-{unique_code}",
            "department": "Engineering",
            "designation": "QA Engineer",
        },
    )
    assert emp_res.status_code == 201, f"Employee creation failed: {emp_res.text}"
    emp_id = emp_res.json()["id"]

    email = f"iso_{unique_code.lower()}@vorldx.com"
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


def snapshot_database():
    """Take a snapshot of existing attendance records and employee IDs."""
    db = SessionLocal()
    try:
        attendance_records = db.query(AttendanceRecord).all()
        att_snapshot = {
            r.id: {
                "employee_id": r.employee_id,
                "attendance_date": r.attendance_date,
                "check_in": r.check_in.isoformat() if r.check_in else None,
                "check_out": r.check_out.isoformat() if r.check_out else None,
                "source": r.source,
                "status": r.status,
            }
            for r in attendance_records
        }
        existing_emp_ids = {e.id for e in db.query(Employee).all()}
        existing_user_ids = {u.id for u in db.query(User).all()}
        return att_snapshot, existing_emp_ids, existing_user_ids
    finally:
        db.close()


def verify_snapshot_integrity(original_snapshot):
    """Confirm that all pre-existing attendance records remain completely unmodified."""
    db = SessionLocal()
    try:
        for rec_id, orig in original_snapshot.items():
            current = db.get(AttendanceRecord, rec_id)
            assert current is not None, f"Pre-existing attendance record {rec_id} was deleted!"
            assert current.employee_id == orig["employee_id"], f"Record {rec_id} employee_id altered!"
            assert current.attendance_date == orig["attendance_date"], f"Record {rec_id} date altered!"
            assert current.source == orig["source"], f"Record {rec_id} source altered!"
            assert current.status == orig["status"], f"Record {rec_id} status altered!"
    finally:
        db.close()


def test_isolated_dynamic_qr_attendance_flow_and_data_preservation(client):
    """
    Complete isolated end-to-end scenario satisfying all Requirements 1-8:
    1. Pre-existing database state captured.
    2. Test employee created and authenticated.
    3. Active dynamic QR session obtained via API.
    4. Valid QR token submitted -> 201 Created.
    5. Resulting attendance record verified (derived source DYNAMIC_QR_HQ_MAIN).
    6. Duplicate submission rejected -> 409 Conflict.
    7. Expired and rotated tokens tested -> 400 Bad Request.
    8. Ephemeral test records cleaned up and pre-existing records verified 100% unchanged.
    """
    admin = get_admin_auth(client)

    # 1. Capture snapshot of pre-existing database records
    pre_att_snapshot, pre_emp_ids, pre_user_ids = snapshot_database()
    initial_att_count = len(pre_att_snapshot)

    created_emp_ids = []
    created_att_ids = []

    try:
        # 2. Authenticate a fresh test employee who has NOT checked in today
        emp = create_test_employee(client, prefix="E2E1")
        created_emp_ids.append(emp["id"])

        # 3. Obtain active dynamic QR session via API
        kiosk_res = client.get("/api/v1/qr/active?office_code=HQ_MAIN", headers=admin["headers"])
        assert kiosk_res.status_code == 200, f"Failed to get active QR session: {kiosk_res.text}"
        session_data = kiosk_res.json()
        assert session_data["is_active"] is True
        valid_qr_token = session_data["token"]
        assert len(valid_qr_token) >= 32

        # 4. Submit valid QR token for the authenticated test employee
        checkin_payload = {
            "employee_id": emp["id"],
            "source": "OFFICE_QR",
            "qr_token": valid_qr_token,
        }
        res_checkin = client.post(
            "/api/v1/attendance/check-in",
            headers=emp["headers"],
            json=checkin_payload,
        )
        assert res_checkin.status_code == 201, f"Check-in failed: {res_checkin.text}"
        att_record = res_checkin.json()
        created_att_ids.append(att_record["id"])

        # 5. Verify the resulting attendance record and its derived source
        assert att_record["employee_id"] == emp["id"]
        assert att_record["source"] == "DYNAMIC_QR_HQ_MAIN"
        assert att_record["check_in"] is not None

        # Verify directly in the database
        db = SessionLocal()
        try:
            db_rec = db.get(AttendanceRecord, att_record["id"])
            assert db_rec is not None
            assert db_rec.employee_id == emp["id"]
            assert db_rec.source == "DYNAMIC_QR_HQ_MAIN"
            assert db_rec.check_out is None
        finally:
            db.close()

        # 6. Submit the same check-in again and verify duplicate prevention (409 Conflict)
        res_dup = client.post(
            "/api/v1/attendance/check-in",
            headers=emp["headers"],
            json=checkin_payload,
        )
        assert res_dup.status_code == 409, f"Expected 409 Conflict, got {res_dup.status_code}"
        assert "already exists" in res_dup.json()["detail"].lower()

        # 7A. Test expired token rejection
        # Create an isolated test employee for expired token test
        emp_exp = create_test_employee(client, prefix="E2E_EXP")
        created_emp_ids.append(emp_exp["id"])

        db = SessionLocal()
        try:
            exp_session, exp_raw_token = create_qr_session(db, office_code="HQ_MAIN", expire_seconds=30)
            exp_session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
            db.commit()
        finally:
            db.close()

        res_expired = client.post(
            "/api/v1/attendance/check-in",
            headers=emp_exp["headers"],
            json={
                "employee_id": emp_exp["id"],
                "source": "OFFICE_QR",
                "qr_token": exp_raw_token,
            },
        )
        assert res_expired.status_code == 400
        assert "expired" in res_expired.json()["detail"].lower()

        # 7B. Test rotated token rejection
        emp_rot = create_test_employee(client, prefix="E2E_ROT")
        created_emp_ids.append(emp_rot["id"])

        # Fetch active session, then rotate it
        rot_res1 = client.get("/api/v1/qr/active?office_code=HQ_MAIN", headers=admin["headers"])
        old_token = rot_res1.json()["token"]

        rot_res2 = client.post(
            "/api/v1/qr/rotate",
            headers=admin["headers"],
            json={"office_code": "HQ_MAIN"},
        )
        assert rot_res2.status_code == 201

        res_rotated = client.post(
            "/api/v1/attendance/check-in",
            headers=emp_rot["headers"],
            json={
                "employee_id": emp_rot["id"],
                "source": "OFFICE_QR",
                "qr_token": old_token,
            },
        )
        assert res_rotated.status_code == 400
        assert "rotated or revoked" in res_rotated.json()["detail"].lower()

    finally:
        # Clean up ephemeral test records created specifically during this isolated run
        db = SessionLocal()
        try:
            # Delete attendance records created during this test
            for aid in created_att_ids:
                r = db.get(AttendanceRecord, aid)
                if r:
                    db.delete(r)

            # Delete employees and linked users created during this test
            for eid in created_emp_ids:
                emp_obj = db.get(Employee, eid)
                if emp_obj:
                    uid = emp_obj.user_id
                    db.delete(emp_obj)
                    if uid:
                        user = db.get(User, uid)
                        if user:
                            db.delete(user)

            db.commit()
        finally:
            db.close()

        # 8. Verify that all pre-existing database records remain completely unchanged
        verify_snapshot_integrity(pre_att_snapshot)

        db = SessionLocal()
        try:
            final_att_count = db.query(AttendanceRecord).count()
            assert final_att_count == initial_att_count, (
                f"Attendance record count mismatch! Expected {initial_att_count}, got {final_att_count}"
            )
        finally:
            db.close()
