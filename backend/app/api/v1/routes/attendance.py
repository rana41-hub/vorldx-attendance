from datetime import date, datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.dependencies.auth import (
    get_current_user,
    get_optional_current_user,
    require_admin_user,
    require_self_or_admin,
)
from app.dependencies.database import get_db
from app.models.attendance import AttendanceRecord
from app.models.attendance_policy import AttendancePolicy
from app.models.employee import Employee
from app.models.enums import AttendanceStatus, LeaveStatus, UserRole, WFHStatus
from app.models.leave import LeaveRequest
from app.models.user import User
from app.models.wfh import WFHRequest
from app.schemas.attendance import (
    AttendanceCheckInRequest,
    AttendanceCheckOutRequest,
    AttendanceRecordResponse,
    EmployeeAttendanceStats,
    EmployeeDashboardResponse,
)
from app.schemas.attendance_policy import (
    AttendancePolicyResponse,
    AttendancePolicyUpdate,
    PolicyCalculationRequest,
    PolicyCalculationResponse,
)
from app.services.attendance_completion_service import (
    calculate_session_duration,
    evaluate_record_completion,
    is_session_open,
)
from app.services.policy_service import (
    calculate_check_in_status,
    calculate_check_out_status,
    ensure_timezone_aware,
    get_active_policy,
    to_organization_time,
)
from app.services.qr_service import validate_qr_token

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("/dashboard", response_model=EmployeeDashboardResponse)
@router.get("/stats", response_model=EmployeeDashboardResponse)
def get_employee_dashboard(
    employee_id: Optional[int] = Query(None, description="Employee ID (Admin only override)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Authoritative employee attendance dashboard and statistics.
    Derives employee identity strictly from the authenticated user.
    Admins can optionally inspect any employee by providing employee_id.
    """
    if current_user.role == UserRole.EMPLOYEE:
        target_employee = current_user.employee
        if not target_employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No employee profile associated with this account.",
            )
    else:
        # Admin user
        if employee_id is not None:
            target_employee = db.get(Employee, employee_id)
            if not target_employee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Employee with ID {employee_id} not found.",
                )
        elif current_user.employee:
            target_employee = current_user.employee
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrator must provide an employee_id parameter.",
            )

    now_utc = datetime.now(timezone.utc)
    org_now = to_organization_time(now_utc)
    today_date = org_now.date()

    policy = get_active_policy(db)

    # 1. Resolve today's attendance record and active status
    today_record = db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.employee_id == target_employee.id,
            AttendanceRecord.attendance_date == today_date,
        )
    )

    # Overnight shift handling: If no record for today's calendar date,
    # check for an active un-concluded shift started within the last 24 hours.
    if not today_record:
        today_record = db.scalar(
            select(AttendanceRecord).where(
                AttendanceRecord.employee_id == target_employee.id,
                AttendanceRecord.check_out.is_(None),
                AttendanceRecord.check_in >= now_utc - timedelta(hours=24),
            ).order_by(AttendanceRecord.check_in.desc())
        )

    session_state = "NOT_STARTED"
    is_session_open = False
    current_shift_credit = 0.0
    today_status = AttendanceStatus.ABSENT
    today_rec_resp = None

    if today_record:
        t_eval = evaluate_record_completion(
            today_record.check_in, today_record.check_out, policy, today_record.status
        )
        session_state = t_eval.session_state
        is_session_open = t_eval.is_open
        current_shift_credit = t_eval.attendance_credit
        today_status = today_record.status
        today_rec_resp = AttendanceRecordResponse.model_validate(today_record)
        today_rec_resp.hours_worked = t_eval.hours_worked
        today_rec_resp.session_state = t_eval.session_state

    # 2. Query historical attendance records up to today (ordered newest first)
    all_records = db.scalars(
        select(AttendanceRecord)
        .where(
            AttendanceRecord.employee_id == target_employee.id,
            AttendanceRecord.attendance_date <= today_date,
        )
        .order_by(
            AttendanceRecord.attendance_date.desc(),
            AttendanceRecord.check_in.desc(),
        )
    ).all()

    total_records = len(all_records)
    enriched_recent: list[AttendanceRecordResponse] = []
    for r in all_records[:5]:
        r_eval = evaluate_record_completion(r.check_in, r.check_out, policy, r.status)
        r_resp = AttendanceRecordResponse.model_validate(r)
        r_resp.hours_worked = r_eval.hours_worked
        r_resp.session_state = r_eval.session_state
        enriched_recent.append(r_resp)

    # Centralized completion policy: calculate present, late, and credits under strict full-day policy
    present_days = 0
    late_days = 0
    half_day_days = 0
    attended_credits = 0.0

    for r in all_records:
        # Open / unfinished shifts earn NO attendance credit and do not count as completed days
        if r.check_out is None:
            continue

        r_eval = evaluate_record_completion(r.check_in, r.check_out, policy, r.status)

        # Incomplete session (< 8 hours or early departure): earns 0 credit
        if not r_eval.is_complete or r_eval.attendance_credit == 0.0:
            continue

        # Completed qualifying shift (>= 8.0 hours)
        if r_eval.status == AttendanceStatus.LATE:
            late_days += 1
            attended_credits += 1.0
        else:
            present_days += 1
            attended_credits += 1.0

    total_attended_days = present_days + late_days

    # 3. Query approved leaves and WFH
    leave_records = db.scalars(
        select(LeaveRequest).where(
            LeaveRequest.employee_id == target_employee.id,
            LeaveRequest.status == LeaveStatus.APPROVED,
        )
    ).all()
    approved_leave_dates = set()
    for l in leave_records:
        curr = l.start_date
        while curr <= l.end_date:
            if curr <= today_date:
                approved_leave_dates.add(curr)
            curr += timedelta(days=1)
    approved_leave_days = len(approved_leave_dates)

    wfh_records = db.scalars(
        select(WFHRequest).where(
            WFHRequest.employee_id == target_employee.id,
            WFHRequest.status == WFHStatus.APPROVED,
        )
    ).all()
    approved_wfh_dates = set()
    for w in wfh_records:
        curr = w.start_date
        while curr <= w.end_date:
            if curr <= today_date:
                approved_wfh_dates.add(curr)
            curr += timedelta(days=1)
    approved_wfh_days = len(approved_wfh_dates)

    # 4. Calculate eligible working days (weekdays excluding approved leaves)
    emp_created_date = to_organization_time(target_employee.created_at).date()
    if all_records:
        earliest_att_date = all_records[-1].attendance_date
        baseline_start_date = min(emp_created_date, earliest_att_date)
    else:
        baseline_start_date = emp_created_date

    if baseline_start_date > today_date:
        baseline_start_date = today_date

    eligible_working_days = 0
    curr_date = baseline_start_date
    while curr_date <= today_date:
        # Exclude weekends (Saturday = 5, Sunday = 6)
        if curr_date.weekday() < 5:
            # Exclude approved leaves on weekdays
            if curr_date not in approved_leave_dates:
                eligible_working_days += 1
        curr_date += timedelta(days=1)

    if eligible_working_days > 0:
        raw_pct = (attended_credits / eligible_working_days) * 100.0
        attendance_percentage = round(min(100.0, max(0.0, raw_pct)), 1)
        formula_desc = (
            f"Attended credits ({attended_credits:.1f}) / Eligible working weekdays ({eligible_working_days}) * 100. "
            f"Excludes weekends, unfinished open shifts, and {len(approved_leave_dates)} approved leave days."
        )
    elif total_records > 0:
        raw_pct = (attended_credits / total_records) * 100.0
        attendance_percentage = round(min(100.0, max(0.0, raw_pct)), 1)
        formula_desc = (
            f"Attended credits ({attended_credits:.1f}) / Total logged attendance records ({total_records}) * 100."
        )
    else:
        attendance_percentage = 100.0
        formula_desc = "New employee baseline with no working weekdays elapsed."

    stats = EmployeeAttendanceStats(
        present_days=present_days,
        late_days=late_days,
        half_day_days=half_day_days,
        total_attended_days=total_attended_days,
        total_records=total_records,
        approved_leave_days=approved_leave_days,
        approved_wfh_days=approved_wfh_days,
        eligible_working_days=eligible_working_days,
        attendance_percentage=attendance_percentage,
        percentage_formula=formula_desc,
    )

    return EmployeeDashboardResponse(
        employee_id=target_employee.id,
        employee_code=target_employee.employee_code,
        employee_name=target_employee.full_name,
        today_status=today_status,
        today_record=today_rec_resp,
        stats=stats,
        recent_records=enriched_recent,
        session_state=session_state,
        is_session_open=is_session_open,
        current_shift_credit=current_shift_credit,
    )


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
    records = db.scalars(query).all()
    policy = get_active_policy(db)
    enriched = []
    for r in records:
        r_eval = evaluate_record_completion(r.check_in, r.check_out, policy, r.status)
        r_model = AttendanceRecordResponse.model_validate(r)
        r_model.hours_worked = r_eval.hours_worked
        r_model.session_state = r_eval.session_state
        enriched.append(r_model)
    return enriched


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
    init_eval = evaluate_record_completion(check_in_dt, None, policy)
    calculated_status = init_eval.status

    # Dynamic QR Session Validation
    source_tag = payload.source or "OFFICE_QR"
    if payload.qr_token:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required for dynamic QR attendance check-in.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        qr_session = validate_qr_token(db, payload.qr_token)
        source_tag = f"DYNAMIC_QR_{qr_session.office_code}"

    record = AttendanceRecord(
        employee_id=payload.employee_id,
        attendance_date=record_date,
        check_in=check_in_dt,
        status=calculated_status,
        source=source_tag,
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attendance record already exists for this employee today.",
        )
    db.refresh(record)
    resp = AttendanceRecordResponse.model_validate(record)
    resp.hours_worked = init_eval.hours_worked
    resp.session_state = init_eval.session_state
    return resp


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
        ).with_for_update()
    )
    # Midnight boundary fallback: If no record found for today's calendar date,
    # find the most recent shift started by the employee within the last 24 hours.
    if not record:
        record = db.scalar(
            select(AttendanceRecord).where(
                AttendanceRecord.employee_id == payload.employee_id,
                AttendanceRecord.check_in >= check_out_dt - timedelta(hours=24),
            ).order_by(AttendanceRecord.check_in.desc()).with_for_update()
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
    checkout_eval = evaluate_record_completion(
        record.check_in, check_out_dt, policy, record.status
    )

    record.status = checkout_eval.status
    record.check_out = check_out_dt
    db.commit()
    db.refresh(record)
    out_resp = AttendanceRecordResponse.model_validate(record)
    out_resp.hours_worked = checkout_eval.hours_worked
    out_resp.session_state = checkout_eval.session_state
    return out_resp


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
