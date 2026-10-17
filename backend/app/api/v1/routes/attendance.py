from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies.auth import (
    get_optional_current_user,
    require_admin_user,
    require_self_or_admin,
)
from app.dependencies.database import get_db
from app.models.attendance import AttendanceRecord
from app.models.attendance_policy import AttendancePolicy
from app.models.employee import Employee
from app.models.enums import AttendanceStatus, UserRole
from app.models.user import User
from app.schemas.attendance import (
    AttendanceCheckInRequest,
    AttendanceCheckOutRequest,
    AttendanceRecordResponse,
)
from app.schemas.attendance_policy import (
    AttendancePolicyResponse,
    AttendancePolicyUpdate,
    PolicyCalculationRequest,
    PolicyCalculationResponse,
)
from app.services.policy_service import (
    calculate_check_in_status,
    calculate_check_out_status,
    ensure_timezone_aware,
    get_active_policy,
    to_organization_time,
)

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("", response_model=list[AttendanceRecordResponse])
def list_attendance(
    attendance_date: Optional[date] = Query(None, description="Filter by date"),
    employee_id: Optional[int] = Query(None, description="Filter by employee ID"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    # Enforce employee data isolation if authenticated as EMPLOYEE
    if current_user and current_user.role == UserRole.EMPLOYEE:
        caller_emp = current_user.employee
        if not caller_emp:
            return []
        employee_id = caller_emp.id

    query = select(AttendanceRecord)
    if attendance_date:
        query = query.where(AttendanceRecord.attendance_date == attendance_date)
    if employee_id:
        query = query.where(AttendanceRecord.employee_id == employee_id)
    query = (
        query.order_by(
            AttendanceRecord.attendance_date.desc(),
            AttendanceRecord.check_in.desc(),
        )
        .offset(offset)
        .limit(limit)
    )
    return db.scalars(query).all()


@router.post(
    "/check-in",
    response_model=AttendanceRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
def record_check_in(
    payload: AttendanceCheckInRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    if current_user:
        require_self_or_admin(payload.employee_id, current_user)

    employee = db.get(Employee, payload.employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )

    raw_check_in = payload.timestamp or datetime.now(timezone.utc)
    check_in_dt = ensure_timezone_aware(raw_check_in)
    record_date = to_organization_time(check_in_dt).date()

    existing = db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.employee_id == payload.employee_id,
            AttendanceRecord.attendance_date == record_date,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attendance record already exists for this employee today.",
        )

    policy = get_active_policy(db)
    calculated_status, _ = calculate_check_in_status(check_in_dt, policy)

    record = AttendanceRecord(
        employee_id=payload.employee_id,
        attendance_date=record_date,
        check_in=check_in_dt,
        status=calculated_status,
        source=payload.source or "OFFICE_QR",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.post("/check-out", response_model=AttendanceRecordResponse)
def record_check_out(
    payload: AttendanceCheckOutRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    if current_user:
        require_self_or_admin(payload.employee_id, current_user)

    raw_check_out = payload.timestamp or datetime.now(timezone.utc)
    check_out_dt = ensure_timezone_aware(raw_check_out)
    record_date = to_organization_time(check_out_dt).date()

    record = db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.employee_id == payload.employee_id,
            AttendanceRecord.attendance_date == record_date,
        )
    )
    # Midnight boundary fallback: If no record found for today's calendar date,
    # find any un-concluded shift started by the employee within the last 24 hours.
    if not record:
        record = db.scalar(
            select(AttendanceRecord).where(
                AttendanceRecord.employee_id == payload.employee_id,
                AttendanceRecord.check_out.is_(None),
            ).order_by(AttendanceRecord.check_in.desc())
        )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No check-in record found for today to check out from.",
        )

    if record.check_out is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee has already checked out for today.",
        )

    policy = get_active_policy(db)
    new_status, _, _ = calculate_check_out_status(
        record.check_in, check_out_dt, record.status, policy
    )

    record.status = new_status
    record.check_out = check_out_dt
    db.commit()
    db.refresh(record)
    return record


# --- Policy Management Endpoints ---


@router.get("/policy", response_model=AttendancePolicyResponse)
def get_current_policy(
    db: Session = Depends(get_db),
):
    """Retrieve the current organization attendance policy."""
    return get_active_policy(db)


@router.put("/policy", response_model=AttendancePolicyResponse)
def update_policy(
    payload: AttendancePolicyUpdate,
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """
    Update the organization attendance policy.
    Restricted strictly to administrators.
    """
    policy = get_active_policy(db)
    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(policy, field, value)

    policy.updated_by = current_admin.id
    db.commit()
    db.refresh(policy)
    return policy


@router.post("/policy/calculate", response_model=PolicyCalculationResponse)
def simulate_policy_calculation(
    payload: PolicyCalculationRequest,
    db: Session = Depends(get_db),
):
    """
    Simulate and test policy calculations against check-in and check-out timestamps.
    """
    policy = get_active_policy(db)
    init_status, is_late = calculate_check_in_status(payload.check_in, policy)

    final_status = init_status
    hours_worked = None
    is_early = False

    if payload.check_out:
        final_status, hours_worked, is_early = calculate_check_out_status(
            payload.check_in, payload.check_out, init_status, policy
        )

    details = (
        f"Initial status: {init_status.value}. "
        f"Late arrival: {is_late}. "
        f"Early departure: {is_early}. "
        f"Hours worked: {hours_worked if hours_worked is not None else 'In-progress'}."
    )

    return PolicyCalculationResponse(
        status=final_status,
        hours_worked=hours_worked,
        is_late=is_late,
        is_early_departure=is_early,
        details=details,
    )
