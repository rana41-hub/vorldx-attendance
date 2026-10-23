import csv
from datetime import date, datetime, timedelta, timezone
import io
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.dependencies.auth import require_admin_user
from app.dependencies.database import get_db
from app.models.attendance import AttendanceRecord
from app.models.attendance_policy import AttendancePolicy
from app.models.audit_log import AuditLog
from app.models.employee import Employee
from app.models.enums import AttendanceStatus, LeaveStatus, WFHStatus
from app.models.leave import LeaveRequest
from app.models.user import User
from app.models.wfh import WFHRequest
from app.schemas.analytics import (
    AttendanceSummaryResponse,
    AttendanceTrendsResponse,
    DailyAttendanceReportResponse,
    DailyTrendItem,
    DashboardMetricsResponse,
    LateAttendanceItem,
    LateAttendanceReportResponse,
    WFHReportItem,
    WFHReportResponse,
)
from app.services.attendance_completion_service import to_shift_organization_time
from app.services.policy_service import get_active_policy, to_organization_time

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


def sanitize_csv_cell(value: object) -> str:
    """
    Sanitize value for CSV to prevent spreadsheet formula injection.
    Cells starting with =, +, -, @, \\t, or \\r are escaped with a leading single quote.
    """
    if value is None:
        return ""
    text_val = str(value)
    if text_val and text_val[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{text_val}"
    return text_val


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
    incomplete records, attendance percentage, and pending approval requests.
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
            incomplete_today=0,
            attendance_percentage=0.0,
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
    incomplete_count = sum(1 for r in att_records if r.check_out is None)

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

    # 5. Eligible employees & Attendance percentage calculation
    eligible_count = max(0, total_active - len(on_leave_ids))
    attendance_pct = (
        round(min(100.0, max(0.0, (len(present_ids) / eligible_count) * 100)), 1)
        if eligible_count > 0
        else 0.0
    )

    # 6. Organization-wide pending requests
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
        incomplete_today=incomplete_count,
        attendance_percentage=attendance_pct,
        pending_leave_requests=pending_leaves,
        pending_wfh_requests=pending_wfh,
    )


@router.get("/daily", response_model=DailyAttendanceReportResponse)
def get_daily_attendance_report(
    report_date: Optional[date] = Query(
        None, description="Report date; defaults to current date."
    ),
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """
    Detailed daily attendance summary report for a selected date.
    Calculates eligible employees, present, late, half-day, incomplete, on-leave,
    wfh, absent, and attendance percentage.
    """
    eval_date = report_date or datetime.now(timezone.utc).date()
    active_ids = get_active_employee_ids(db)
    total_active = len(active_ids)

    # Approved leave records covering evaluated date
    leave_emp_ids = set(
        db.scalars(
            select(LeaveRequest.employee_id).where(
                LeaveRequest.status == LeaveStatus.APPROVED,
                LeaveRequest.start_date <= eval_date,
                LeaveRequest.end_date >= eval_date,
                LeaveRequest.employee_id.in_(active_ids) if active_ids else True,
            )
        ).all()
    ) if active_ids else set()

    eligible_ids = active_ids - leave_emp_ids
    eligible_employees = len(eligible_ids)

    att_records = (
        db.scalars(
            select(AttendanceRecord).where(
                AttendanceRecord.attendance_date == eval_date,
                AttendanceRecord.employee_id.in_(active_ids),
            )
        ).all()
        if active_ids
        else []
    )

    attended_ids = {r.employee_id for r in att_records}
    attended_eligible_ids = attended_ids & eligible_ids
    present_count = sum(1 for r in att_records if r.status == AttendanceStatus.PRESENT)
    late_count = sum(1 for r in att_records if r.status == AttendanceStatus.LATE)
    half_day_count = sum(1 for r in att_records if r.status == AttendanceStatus.HALF_DAY)
    incomplete_count = sum(1 for r in att_records if r.check_out is None)

    # Approved WFH records covering evaluated date
    wfh_emp_ids = set(
        db.scalars(
            select(WFHRequest.employee_id).where(
                WFHRequest.status == WFHStatus.APPROVED,
                WFHRequest.start_date <= eval_date,
                WFHRequest.end_date >= eval_date,
                WFHRequest.employee_id.in_(active_ids) if active_ids else True,
            )
        ).all()
    ) if active_ids else set()

    wfh_remote_ids = wfh_emp_ids - attended_ids
    attended_wfh_ids = wfh_emp_ids & attended_ids

    accounted_ids = attended_ids.union(leave_emp_ids).union(wfh_emp_ids)
    absent_count = len(active_ids - accounted_ids)

    attendance_percentage = (
        round(min(100.0, max(0.0, (len(attended_eligible_ids) / eligible_employees) * 100)), 1)
        if eligible_employees > 0
        else 0.0
    )

    definitions = {
        "total_active_employees": "Total registered employees with an active user account or unlinked user.",
        "eligible_employees": "Active employees expected to be at work (total active minus employees on approved leave).",
        "present_count": "Employees checked in on-time conforming to shift hours and grace period.",
        "late_count": "Employees whose check-in arrived after the shift start time plus late grace period.",
        "half_day_count": "Employees who completed half-day hours or checked in past half-day cutoff.",
        "incomplete_count": "Attendance sessions currently lacking a recorded check-out time (open in-progress sessions).",
        "total_attended": "Distinct active employees who attended office (PRESENT, LATE, or HALF_DAY).",
        "on_leave_count": "Active employees with an approved leave request covering the reporting date.",
        "wfh_count": "Active employees with an approved work-from-home request covering the reporting date.",
        "wfh_remote_count": "Active employees on approved work-from-home who worked remotely (did not check in at office).",
        "attended_wfh_count": "Active employees on approved work-from-home who also checked in at office.",
        "absent_count": "Active employees without attendance, approved leave, or approved WFH.",
        "attendance_percentage": "(Eligible attended active employees / Eligible active employees) * 100. Formula avoids division by zero and excludes approved leaves.",
        "reconciliation": "Total Active = Total Attended + Approved Leave + Remote WFH + Absent.",
    }

    return DailyAttendanceReportResponse(
        report_date=eval_date,
        total_active_employees=total_active,
        eligible_employees=eligible_employees,
        present_count=present_count,
        late_count=late_count,
        half_day_count=half_day_count,
        total_attended=len(attended_ids),
        incomplete_count=incomplete_count,
        on_leave_count=len(leave_emp_ids),
        wfh_count=len(wfh_emp_ids),
        absent_count=absent_count,
        attended_eligible_count=len(attended_eligible_ids),
        wfh_remote_count=len(wfh_remote_ids),
        attended_wfh_count=len(attended_wfh_ids),
        attendance_percentage=attendance_percentage,
        definitions=definitions,
    )


@router.get("/late-report", response_model=LateAttendanceReportResponse)
def get_late_attendance_report(
    start_date: Optional[date] = Query(None, description="Start date; defaults to today."),
    end_date: Optional[date] = Query(None, description="End date; defaults to today."),
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """
    Late attendance summary and employee-level detail records for a date range.
    Integrates shift start time, grace period, and calculated minutes late.
    """
    today = datetime.now(timezone.utc).date()
    computed_start = start_date or today
    computed_end = end_date or today

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

    if (computed_end - computed_start).days > 366:
        err_status = (
            status.HTTP_422_UNPROCESSABLE_CONTENT
            if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT")
            else 422
        )
        raise HTTPException(
            status_code=err_status,
            detail="Date range cannot exceed 366 days.",
        )

    policy = get_active_policy(db)
    active_ids = get_active_employee_ids(db)

    # Total attendance records in date range
    total_attendance = (
        db.scalar(
            select(func.count(AttendanceRecord.id)).where(
                AttendanceRecord.attendance_date >= computed_start,
                AttendanceRecord.attendance_date <= computed_end,
                AttendanceRecord.employee_id.in_(active_ids) if active_ids else True,
            )
        )
        or 0
        if active_ids
        else 0
    )

    # Late attendance records joined with Employee
    query = (
        select(AttendanceRecord, Employee)
        .join(Employee, AttendanceRecord.employee_id == Employee.id)
        .where(
            AttendanceRecord.attendance_date >= computed_start,
            AttendanceRecord.attendance_date <= computed_end,
            AttendanceRecord.status == AttendanceStatus.LATE,
            AttendanceRecord.employee_id.in_(active_ids) if active_ids else True,
        )
        .order_by(
            AttendanceRecord.attendance_date.desc(),
            AttendanceRecord.check_in.desc(),
        )
    )

    results = db.execute(query).all() if active_ids else []
    total_late = len(results)

    late_pct = (
        round((total_late / total_attendance) * 100, 1)
        if total_attendance > 0
        else 0.0
    )

    shift_start_str = policy.work_start_time.strftime("%H:%M")
    start_min = policy.work_start_time.hour * 60 + policy.work_start_time.minute
    grace_cutoff_min = start_min + policy.late_grace_minutes

    records: list[LateAttendanceItem] = []
    for rec, emp in results:
        local_in = to_shift_organization_time(rec.check_in)
        check_in_min = local_in.hour * 60 + local_in.minute
        # Minutes late is defined as the time elapsed beyond the grace-period cutoff (shift start + grace)
        minutes_late = max(0, check_in_min - grace_cutoff_min)

        records.append(
            LateAttendanceItem(
                record_id=rec.id,
                employee_id=emp.id,
                employee_code=emp.employee_code,
                employee_name=f"{emp.first_name} {emp.last_name}",
                department=emp.department or "",
                attendance_date=rec.attendance_date,
                check_in=rec.check_in,
                check_out=rec.check_out,
                minutes_late=minutes_late,
                status=rec.status,
                is_corrected=bool(getattr(rec, "is_corrected", False)),
                source=getattr(rec, "source", None),
            )
        )

    return LateAttendanceReportResponse(
        start_date=computed_start,
        end_date=computed_end,
        total_late_records=total_late,
        total_attendance_records=total_attendance,
        late_percentage=late_pct,
        shift_start_time=shift_start_str,
        late_grace_minutes=policy.late_grace_minutes,
        records=records,
    )


@router.get("/wfh-report", response_model=WFHReportResponse)
def get_wfh_report(
    start_date: Optional[date] = Query(None, description="Start date; defaults to 30 days ago."),
    end_date: Optional[date] = Query(None, description="End date; defaults to today."),
    filter_by: str = Query("target_date", description="'target_date' or 'submission_date'"),
    status_filter: Optional[WFHStatus] = Query(None, alias="status", description="Optional status filter"),
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """
    Work-From-Home statistics and request details report.
    Supports filtering by target WFH date or request submission date.
    """
    today = datetime.now(timezone.utc).date()
    computed_end = end_date or today
    computed_start = start_date or (computed_end - timedelta(days=30))

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

    if (computed_end - computed_start).days > 366:
        err_status = (
            status.HTTP_422_UNPROCESSABLE_CONTENT
            if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT")
            else 422
        )
        raise HTTPException(
            status_code=err_status,
            detail="Date range cannot exceed 366 days.",
        )

    active_ids = get_active_employee_ids(db)

    query = (
        select(WFHRequest, Employee, User)
        .join(Employee, WFHRequest.employee_id == Employee.id)
        .outerjoin(User, WFHRequest.reviewed_by == User.id)
    )

    if active_ids:
        query = query.where(WFHRequest.employee_id.in_(active_ids))

    if filter_by == "submission_date":
        query = query.where(
            func.date(WFHRequest.created_at) >= computed_start,
            func.date(WFHRequest.created_at) <= computed_end,
        )
    else:
        query = query.where(
            WFHRequest.start_date <= computed_end,
            WFHRequest.end_date >= computed_start,
        )

    all_filtered_wfh = db.execute(query).all() if active_ids else []

    total_requests = len(all_filtered_wfh)
    pending_requests = sum(1 for w, _, _ in all_filtered_wfh if w.status == WFHStatus.PENDING)
    approved_requests = sum(1 for w, _, _ in all_filtered_wfh if w.status == WFHStatus.APPROVED)
    rejected_requests = sum(1 for w, _, _ in all_filtered_wfh if w.status == WFHStatus.REJECTED)
    cancelled_requests = sum(1 for w, _, _ in all_filtered_wfh if w.status == WFHStatus.CANCELLED)

    total_approved_days = 0
    for w, _, _ in all_filtered_wfh:
        if w.status == WFHStatus.APPROVED:
            overlap_start = max(w.start_date, computed_start)
            overlap_end = min(w.end_date, computed_end)
            if overlap_end >= overlap_start:
                total_approved_days += (overlap_end - overlap_start).days + 1

    items_source = all_filtered_wfh
    if status_filter is not None:
        items_source = [item for item in items_source if item[0].status == status_filter]

    items_source.sort(key=lambda item: item[0].created_at, reverse=True)

    items: list[WFHReportItem] = []
    for w, emp, reviewer in items_source:
        days_count = max(1, (w.end_date - w.start_date).days + 1)
        rev_name = (reviewer.admin_id or reviewer.email) if reviewer else None

        items.append(
            WFHReportItem(
                id=w.id,
                employee_id=emp.id,
                employee_code=emp.employee_code,
                employee_name=f"{emp.first_name} {emp.last_name}",
                department=emp.department or "",
                start_date=w.start_date,
                end_date=w.end_date,
                days_count=days_count,
                reason=w.reason,
                status=w.status,
                submitted_at=w.created_at,
                reviewed_at=w.reviewed_at,
                reviewer_id=w.reviewed_by,
                reviewer_name=rev_name,
            )
        )

    return WFHReportResponse(
        start_date=computed_start,
        end_date=computed_end,
        filter_by=filter_by,
        total_requests=total_requests,
        pending_requests=pending_requests,
        approved_requests=approved_requests,
        rejected_requests=rejected_requests,
        cancelled_requests=cancelled_requests,
        total_approved_wfh_days=total_approved_days,
        requests=items,
    )


@router.get("/export/attendance.csv")
def export_attendance_csv(
    start_date: date = Query(..., description="Start date of export window (inclusive)"),
    end_date: date = Query(..., description="End date of export window (inclusive)"),
    department: Optional[str] = Query(None, description="Optional department filter"),
    status_filter: Optional[AttendanceStatus] = Query(None, alias="status", description="Optional attendance status filter"),
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """
    Export attendance records as a secure CSV file.
    Includes formula injection prevention, UTF-8 encoding, and admin authorization.
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

    if (end_date - start_date).days > 366:
        err_status = (
            status.HTTP_422_UNPROCESSABLE_CONTENT
            if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT")
            else 422
        )
        raise HTTPException(
            status_code=err_status,
            detail="Export range cannot exceed 366 days.",
        )

    active_ids = get_active_employee_ids(db)
    headers = [
        "Employee ID",
        "Employee Code",
        "Employee Name",
        "Department",
        "Attendance Date",
        "Check In",
        "Check Out",
        "Duration (Hours)",
        "Status",
        "Is Corrected",
        "Correction Reason",
    ]

    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerow([sanitize_csv_cell(h) for h in headers])

    if not active_ids:
        content = output.getvalue().encode("utf-8")
        filename = f"attendance_report_{start_date}_to_{end_date}.csv"
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    query = (
        select(AttendanceRecord, Employee)
        .join(Employee, AttendanceRecord.employee_id == Employee.id)
        .where(
            AttendanceRecord.attendance_date >= start_date,
            AttendanceRecord.attendance_date <= end_date,
            AttendanceRecord.employee_id.in_(active_ids),
        )
    )

    if department:
        query = query.where(Employee.department == department)
    if status_filter:
        query = query.where(AttendanceRecord.status == status_filter)

    query = query.order_by(
        AttendanceRecord.attendance_date.desc(),
        Employee.employee_code.asc(),
    )
    rows = db.execute(query).all()

    # Pre-fetch correction reasons from AuditLog for corrected records
    corrected_record_ids = [rec.id for rec, _ in rows if getattr(rec, "is_corrected", False)]
    reasons_by_record_id: dict[int, str] = {}
    if corrected_record_ids:
        audit_logs = db.scalars(
            select(AuditLog).where(
                AuditLog.attendance_record_id.in_(corrected_record_ids),
                AuditLog.action_type.in_(["CORRECTION", "ATTENDANCE_CORRECTION", "CORRECTION_UPDATE"]),
            ).order_by(AuditLog.id.desc())
        ).all()
        for log in audit_logs:
            if log.attendance_record_id and log.attendance_record_id not in reasons_by_record_id:
                reasons_by_record_id[log.attendance_record_id] = log.reason

    def generate_csv_stream():
        buffer = io.StringIO()
        writer = csv.writer(buffer, lineterminator="\r\n")

        # Stream header
        writer.writerow([sanitize_csv_cell(h) for h in headers])
        yield buffer.getvalue().encode("utf-8")
        buffer.seek(0)
        buffer.truncate(0)

        # Stream rows
        for rec, emp in rows:
            check_in_str = rec.check_in.strftime("%Y-%m-%d %H:%M:%S") if rec.check_in else ""
            check_out_str = rec.check_out.strftime("%Y-%m-%d %H:%M:%S") if rec.check_out else ""
            duration_hours = ""
            if rec.check_in and rec.check_out:
                diff = (rec.check_out - rec.check_in).total_seconds()
                duration_hours = f"{round(max(0.0, diff) / 3600.0, 2):.2f}"

            is_corr = "Yes" if getattr(rec, "is_corrected", False) else "No"
            reason = reasons_by_record_id.get(rec.id, "")

            row_data = [
                emp.id,
                emp.employee_code,
                f"{emp.first_name} {emp.last_name}",
                emp.department or "",
                rec.attendance_date.strftime("%Y-%m-%d"),
                check_in_str,
                check_out_str,
                duration_hours,
                rec.status.value if hasattr(rec.status, "value") else str(rec.status),
                is_corr,
                reason,
            ]
            writer.writerow([sanitize_csv_cell(val) for val in row_data])
            yield buffer.getvalue().encode("utf-8")
            buffer.seek(0)
            buffer.truncate(0)

    filename = f"attendance_report_{start_date}_to_{end_date}.csv"
    return StreamingResponse(
        generate_csv_stream(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/attendance.xlsx")
def export_attendance_xlsx(
    start_date: date = Query(..., description="Start date of export window (inclusive)"),
    end_date: date = Query(..., description="End date of export window (inclusive)"),
    department: Optional[str] = Query(None, description="Optional department filter"),
    status_filter: Optional[AttendanceStatus] = Query(None, alias="status", description="Optional attendance status filter"),
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """
    Export attendance records as a native Microsoft Excel (.xlsx) file.
    Includes custom column widths, bold formatted headers, frozen top pane,
    auto-filtering, and native date/time cell formatting (permanently preventing '########' display in Excel).
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

    if (end_date - start_date).days > 366:
        err_status = (
            status.HTTP_422_UNPROCESSABLE_CONTENT
            if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT")
            else 422
        )
        raise HTTPException(
            status_code=err_status,
            detail="Export range cannot exceed 366 days.",
        )

    active_ids = get_active_employee_ids(db)
    headers = [
        "Employee ID",
        "Employee Code",
        "Employee Name",
        "Department",
        "Attendance Date",
        "Check In",
        "Check Out",
        "Duration (Hours)",
        "Status",
        "Is Corrected",
        "Correction Reason",
    ]

    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Attendance Records"

    # Write and style header row
    ws.append(headers)
    header_font = Font(name="Calibri", size=11, bold=True, color="0F172A")
    header_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    bottom_border = Border(bottom=Side(style="medium", color="CBD5E1"))

    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(vertical="center", horizontal="left")
        cell.border = bottom_border

    # Configure optimal column widths to permanently prevent '########' in Excel
    col_widths = {
        "A": 14,  # Employee ID
        "B": 16,  # Employee Code
        "C": 24,  # Employee Name
        "D": 20,  # Department
        "E": 18,  # Attendance Date
        "F": 22,  # Check In
        "G": 22,  # Check Out
        "H": 18,  # Duration (Hours)
        "I": 14,  # Status
        "J": 14,  # Is Corrected
        "K": 32,  # Correction Reason
    }
    for col_letter, width in col_widths.items():
        ws.column_dimensions[col_letter].width = width

    ws.freeze_panes = "A2"

    if active_ids:
        query = (
            select(AttendanceRecord, Employee)
            .join(Employee, AttendanceRecord.employee_id == Employee.id)
            .where(
                AttendanceRecord.attendance_date >= start_date,
                AttendanceRecord.attendance_date <= end_date,
                AttendanceRecord.employee_id.in_(active_ids),
            )
        )

        if department:
            query = query.where(Employee.department == department)
        if status_filter:
            query = query.where(AttendanceRecord.status == status_filter)

        query = query.order_by(
            AttendanceRecord.attendance_date.desc(),
            Employee.employee_code.asc(),
        )
        rows = db.execute(query).all()

        corrected_record_ids = [rec.id for rec, _ in rows if getattr(rec, "is_corrected", False)]
        reasons_by_record_id: dict[int, str] = {}
        if corrected_record_ids:
            audit_logs = db.scalars(
                select(AuditLog).where(
                    AuditLog.attendance_record_id.in_(corrected_record_ids),
                    AuditLog.action_type.in_(["CORRECTION", "ATTENDANCE_CORRECTION", "CORRECTION_UPDATE"]),
                ).order_by(AuditLog.id.desc())
            ).all()
            for log in audit_logs:
                if log.attendance_record_id and log.attendance_record_id not in reasons_by_record_id:
                    reasons_by_record_id[log.attendance_record_id] = log.reason

        row_idx = 2
        for rec, emp in rows:
            check_in_dt = (
                to_shift_organization_time(rec.check_in).replace(tzinfo=None)
                if rec.check_in
                else None
            )
            check_out_dt = (
                to_shift_organization_time(rec.check_out).replace(tzinfo=None)
                if rec.check_out
                else None
            )
            duration_val: Optional[float] = None
            if rec.check_in and rec.check_out:
                diff = (rec.check_out - rec.check_in).total_seconds()
                duration_val = round(max(0.0, diff) / 3600.0, 2)

            is_corr = "Yes" if getattr(rec, "is_corrected", False) else "No"
            reason = reasons_by_record_id.get(rec.id, "")

            ws.append([
                emp.id,
                sanitize_csv_cell(emp.employee_code),
                sanitize_csv_cell(f"{emp.first_name} {emp.last_name}"),
                sanitize_csv_cell(emp.department or ""),
                rec.attendance_date,
                check_in_dt,
                check_out_dt,
                duration_val,
                rec.status.value if hasattr(rec.status, "value") else str(rec.status),
                is_corr,
                sanitize_csv_cell(reason),
            ])

            # Apply date/time and numeric formatting
            ws.cell(row=row_idx, column=5).number_format = "yyyy-mm-dd"
            if check_in_dt:
                ws.cell(row=row_idx, column=6).number_format = "yyyy-mm-dd hh:mm:ss"
            if check_out_dt:
                ws.cell(row=row_idx, column=7).number_format = "yyyy-mm-dd hh:mm:ss"
            if duration_val is not None:
                ws.cell(row=row_idx, column=8).number_format = "0.00"

            row_idx += 1

        total_rows = len(rows)
    else:
        total_rows = 0

    ws.auto_filter.ref = f"A1:K{max(1, total_rows + 1)}"

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"attendance_report_{start_date}_to_{end_date}.xlsx"
    return StreamingResponse(
        io.BytesIO(output.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
        day_total_present = len(day_present_ids)

        day_leave_ids = {
            l.employee_id
            for l in leaves
            if l.start_date <= curr <= l.end_date and l.employee_id in active_ids
        }

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

