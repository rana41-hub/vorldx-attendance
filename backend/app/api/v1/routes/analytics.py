from datetime import date, datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.dependencies.auth import require_admin_user
from app.dependencies.database import get_db
from app.models.attendance import AttendanceRecord
from app.models.employee import Employee
from app.models.enums import AttendanceStatus, LeaveStatus, WFHStatus
from app.models.leave import LeaveRequest
from app.models.user import User
from app.models.wfh import WFHRequest
from app.schemas.analytics import (
    AttendanceSummaryResponse,
    AttendanceTrendsResponse,
    DailyTrendItem,
    DashboardMetricsResponse,
)

router = APIRouter(prefix="/analytics", tags=["Dashboard & Analytics"])


def get_active_employee_ids(db: Session) -> set[int]:
    """
    Retrieve IDs of all active employees (excluding deactivated user accounts).
    """
    query = (
        select(Employee.id)
        .outerjoin(User, Employee.user_id == User.id)
        .where(or_(User.id.is_(None), User.is_active.is_(True)))
    )
    return set(db.scalars(query).all())


@router.get("/dashboard", response_model=DashboardMetricsResponse)
@router.get("/metrics", response_model=DashboardMetricsResponse)
def get_dashboard_metrics(
    target_date: Optional[date] = Query(
        None, description="Target date for metrics; defaults to current date."
    ),
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """
    Administrator dashboard metrics for a specified date (defaults to today).
    Includes active headcount, present, late, half-day, absent, on-leave, WFH,
    and pending approval requests.
    """
    eval_date = target_date or datetime.now(timezone.utc).date()
    active_ids = get_active_employee_ids(db)
    total_active = len(active_ids)

    if not active_ids:
        # No employees in organization
        pending_leaves = db.scalar(
            select(func.count(LeaveRequest.id)).where(
                LeaveRequest.status == LeaveStatus.PENDING
            )
        ) or 0
        pending_wfh = db.scalar(
            select(func.count(WFHRequest.id)).where(
                WFHRequest.status == WFHStatus.PENDING
            )
        ) or 0
        return DashboardMetricsResponse(
            date=eval_date,
            total_active_employees=0,
            present_today=0,
            absent_today=0,
            on_leave_today=0,
            wfh_today=0,
            half_day_today=0,
            late_today=0,
            pending_leave_requests=pending_leaves,
            pending_wfh_requests=pending_wfh,
        )

    # 1. Attendance records for evaluated date
    att_records = db.scalars(
        select(AttendanceRecord).where(
            AttendanceRecord.attendance_date == eval_date,
            AttendanceRecord.employee_id.in_(active_ids),
        )
    ).all()

    present_ids = {r.employee_id for r in att_records}
    late_count = sum(1 for r in att_records if r.status == AttendanceStatus.LATE)
    half_day_count = sum(1 for r in att_records if r.status == AttendanceStatus.HALF_DAY)

    # 2. Approved leave requests covering evaluated date
    leave_records = db.scalars(
        select(LeaveRequest.employee_id).where(
            LeaveRequest.status == LeaveStatus.APPROVED,
            LeaveRequest.start_date <= eval_date,
            LeaveRequest.end_date >= eval_date,
            LeaveRequest.employee_id.in_(active_ids),
        )
    ).all()
    on_leave_ids = set(leave_records)

    # 3. Approved WFH requests covering evaluated date
    wfh_records = db.scalars(
        select(WFHRequest.employee_id).where(
            WFHRequest.status == WFHStatus.APPROVED,
            WFHRequest.start_date <= eval_date,
            WFHRequest.end_date >= eval_date,
            WFHRequest.employee_id.in_(active_ids),
        )
    ).all()
    wfh_ids = set(wfh_records)

    # 4. Absent classification: active employees without check-in, approved leave, or approved WFH
    accounted_for = present_ids.union(on_leave_ids).union(wfh_ids)
    absent_count = len(active_ids - accounted_for)

    # 5. Organization-wide pending requests
    pending_leaves = db.scalar(
        select(func.count(LeaveRequest.id)).where(
            LeaveRequest.status == LeaveStatus.PENDING
        )
    ) or 0
    pending_wfh = db.scalar(
        select(func.count(WFHRequest.id)).where(
            WFHRequest.status == WFHStatus.PENDING
        )
    ) or 0

    return DashboardMetricsResponse(
        date=eval_date,
        total_active_employees=total_active,
        present_today=len(present_ids),
        absent_today=absent_count,
        on_leave_today=len(on_leave_ids),
        wfh_today=len(wfh_ids),
        half_day_today=half_day_count,
        late_today=late_count,
        pending_leave_requests=pending_leaves,
        pending_wfh_requests=pending_wfh,
    )


@router.get("/summary", response_model=AttendanceSummaryResponse)
def get_attendance_summary(
    start_date: date = Query(..., description="Start date of the summary window"),
    end_date: date = Query(..., description="End date of the summary window"),
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """
    Summary metrics for a selected date range.
    Enforces date range bounds and computes aggregated attendance ratios.
    """
    if end_date < start_date:
        err_status = (
            status.HTTP_422_UNPROCESSABLE_CONTENT
            if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT")
            else 422
        )
        raise HTTPException(
            status_code=err_status,
            detail="End date cannot be earlier than start date.",
        )

    total_days = (end_date - start_date).days + 1
    if total_days > 366:
        err_status = (
            status.HTTP_422_UNPROCESSABLE_CONTENT
            if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT")
            else 422
        )
        raise HTTPException(
            status_code=err_status,
            detail="Summary date range cannot exceed 366 days.",
        )

    active_ids = get_active_employee_ids(db)
    total_active = len(active_ids)

    # Attendance records in range
    att_records = db.scalars(
        select(AttendanceRecord).where(
            AttendanceRecord.attendance_date >= start_date,
            AttendanceRecord.attendance_date <= end_date,
            AttendanceRecord.employee_id.in_(active_ids) if active_ids else True,
        )
    ).all() if active_ids else []

    total_att = len(att_records)
    present_cnt = sum(1 for r in att_records if r.status == AttendanceStatus.PRESENT)
    late_cnt = sum(1 for r in att_records if r.status == AttendanceStatus.LATE)
    half_day_cnt = sum(1 for r in att_records if r.status == AttendanceStatus.HALF_DAY)

    # Calculate employee-days on approved leave within [start_date, end_date]
    leaves = db.scalars(
        select(LeaveRequest).where(
            LeaveRequest.status == LeaveStatus.APPROVED,
            LeaveRequest.start_date <= end_date,
            LeaveRequest.end_date >= start_date,
            LeaveRequest.employee_id.in_(active_ids) if active_ids else True,
        )
    ).all() if active_ids else []

    leave_days = 0
    for leave in leaves:
        overlap_start = max(leave.start_date, start_date)
        overlap_end = min(leave.end_date, end_date)
        if overlap_end >= overlap_start:
            leave_days += (overlap_end - overlap_start).days + 1

    # Calculate employee-days on approved WFH within [start_date, end_date]
    wfhs = db.scalars(
        select(WFHRequest).where(
            WFHRequest.status == WFHStatus.APPROVED,
            WFHRequest.start_date <= end_date,
            WFHRequest.end_date >= start_date,
            WFHRequest.employee_id.in_(active_ids) if active_ids else True,
        )
    ).all() if active_ids else []

    wfh_days = 0
    for w in wfhs:
        overlap_start = max(w.start_date, start_date)
        overlap_end = min(w.end_date, end_date)
        if overlap_end >= overlap_start:
            wfh_days += (overlap_end - overlap_start).days + 1

    avg_daily_attendance = round(total_att / total_days, 2) if total_days > 0 else 0.0
    expected_employee_days = total_active * total_days
    attendance_rate = (
        round((total_att / expected_employee_days) * 100, 2)
        if expected_employee_days > 0
        else 0.0
    )

    return AttendanceSummaryResponse(
        start_date=start_date,
        end_date=end_date,
        total_days=total_days,
        total_active_employees=total_active,
        total_attendance_records=total_att,
        present_count=present_cnt,
        late_count=late_cnt,
        half_day_count=half_day_cnt,
        approved_leave_days=leave_days,
        approved_wfh_days=wfh_days,
        average_daily_attendance=avg_daily_attendance,
        attendance_rate_percentage=attendance_rate,
    )


@router.get("/trends", response_model=AttendanceTrendsResponse)
def get_attendance_trends(
    start_date: Optional[date] = Query(
        None, description="Start date; defaults to 7 days before end date."
    ),
    end_date: Optional[date] = Query(
        None, description="End date; defaults to today."
    ),
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """
    Day-by-day attendance trends for time-series charts.
    Optimized with batch loading across the target date interval.
    """
    computed_end = end_date or datetime.now(timezone.utc).date()
    computed_start = start_date or (computed_end - timedelta(days=6))

    if computed_end < computed_start:
        err_status = (
            status.HTTP_422_UNPROCESSABLE_CONTENT
            if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT")
            else 422
        )
        raise HTTPException(
            status_code=err_status,
            detail="End date cannot be earlier than start date.",
        )

    if (computed_end - computed_start).days > 90:
        err_status = (
            status.HTTP_422_UNPROCESSABLE_CONTENT
            if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT")
            else 422
        )
        raise HTTPException(
            status_code=err_status,
            detail="Trends date range cannot exceed 90 days.",
        )

    active_ids = get_active_employee_ids(db)
    total_active = len(active_ids)

    # 1. Fetch all attendance records in window
    att_records = db.scalars(
        select(AttendanceRecord).where(
            AttendanceRecord.attendance_date >= computed_start,
            AttendanceRecord.attendance_date <= computed_end,
            AttendanceRecord.employee_id.in_(active_ids) if active_ids else True,
        )
    ).all() if active_ids else []

    # Group attendance by date -> {date: {employee_id: status}}
    att_by_date: dict[date, dict[int, AttendanceStatus]] = {}
    for r in att_records:
        if r.attendance_date not in att_by_date:
            att_by_date[r.attendance_date] = {}
        att_by_date[r.attendance_date][r.employee_id] = r.status

    # 2. Fetch approved leaves overlapping window
    leaves = db.scalars(
        select(LeaveRequest).where(
            LeaveRequest.status == LeaveStatus.APPROVED,
            LeaveRequest.start_date <= computed_end,
            LeaveRequest.end_date >= computed_start,
            LeaveRequest.employee_id.in_(active_ids) if active_ids else True,
        )
    ).all() if active_ids else []

    # 3. Fetch approved WFH overlapping window
    wfhs = db.scalars(
        select(WFHRequest).where(
            WFHRequest.status == WFHStatus.APPROVED,
            WFHRequest.start_date <= computed_end,
            WFHRequest.end_date >= computed_start,
            WFHRequest.employee_id.in_(active_ids) if active_ids else True,
        )
    ).all() if active_ids else []

    trends: list[DailyTrendItem] = []
    curr = computed_start
    while curr <= computed_end:
        day_att = att_by_date.get(curr, {})
        day_present_ids = set(day_att.keys())

        day_late = sum(1 for s in day_att.values() if s == AttendanceStatus.LATE)
        day_half_day = sum(1 for s in day_att.values() if s == AttendanceStatus.HALF_DAY)
        # Note: 'present' metric includes all attendees (PRESENT, LATE, HALF_DAY)
        day_total_present = len(day_present_ids)

        # Active employees with approved leave covering curr
        day_leave_ids = {
            l.employee_id
            for l in leaves
            if l.start_date <= curr <= l.end_date and l.employee_id in active_ids
        }

        # Active employees with approved WFH covering curr
        day_wfh_ids = {
            w.employee_id
            for w in wfhs
            if w.start_date <= curr <= w.end_date and w.employee_id in active_ids
        }

        accounted = day_present_ids.union(day_leave_ids).union(day_wfh_ids)
        day_absent = len(active_ids - accounted)

        trends.append(
            DailyTrendItem(
                date=curr,
                present=day_total_present,
                late=day_late,
                half_day=day_half_day,
                on_leave=len(day_leave_ids),
                wfh=len(day_wfh_ids),
                absent=day_absent,
                total_active=total_active,
            )
        )
        curr += timedelta(days=1)

    return AttendanceTrendsResponse(
        start_date=computed_start,
        end_date=computed_end,
        trends=trends,
    )
