from datetime import datetime, time, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.attendance_policy import AttendancePolicy
from app.models.enums import AttendanceStatus


def get_active_policy(db: Session) -> AttendancePolicy:
    """
    Retrieve the current active attendance policy.
    If none exists, create and seed the standard default organization policy.
    """
    policy = db.scalar(
        select(AttendancePolicy)
        .where(AttendancePolicy.is_active.is_(True))
        .order_by(AttendancePolicy.id.asc())
        .limit(1)
    )
    if not policy:
        policy = AttendancePolicy(
            policy_name="Standard Organization Policy",
            work_start_time=time(9, 30),
            work_end_time=time(18, 30),
            late_grace_minutes=15,
            early_departure_grace_minutes=15,
            half_day_hours_threshold=4.0,
            full_day_hours_threshold=8.0,
            auto_detect_late_arrival=False,
            auto_detect_early_departure=False,
            is_active=True,
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)
    return policy


def calculate_check_in_status(
    check_in_dt: datetime,
    policy: AttendancePolicy,
) -> Tuple[AttendanceStatus, bool]:
    """
    Calculate attendance status upon check-in based on the active policy.
    Returns (status, is_late).
    """
    if not policy.auto_detect_late_arrival:
        return AttendanceStatus.PRESENT, False

    check_in_minutes = check_in_dt.hour * 60 + check_in_dt.minute
    start_minutes = policy.work_start_time.hour * 60 + policy.work_start_time.minute
    grace_cutoff = start_minutes + policy.late_grace_minutes
    half_day_cutoff = start_minutes + int(policy.half_day_hours_threshold * 60)

    if check_in_minutes > half_day_cutoff:
        return AttendanceStatus.HALF_DAY, True
    elif check_in_minutes > grace_cutoff:
        return AttendanceStatus.LATE, True
    else:
        return AttendanceStatus.PRESENT, False


def calculate_check_out_status(
    check_in_dt: datetime,
    check_out_dt: datetime,
    current_status: AttendanceStatus,
    policy: AttendancePolicy,
) -> Tuple[AttendanceStatus, float, bool]:
    """
    Calculate attendance status upon check-out based on hours worked and departure time.
    Returns (updated_status, hours_worked, is_early_departure).
    """
    duration_seconds = max(0.0, (check_out_dt - check_in_dt).total_seconds())
    hours_worked = round(duration_seconds / 3600.0, 2)

    check_out_minutes = check_out_dt.hour * 60 + check_out_dt.minute
    end_minutes = policy.work_end_time.hour * 60 + policy.work_end_time.minute
    early_cutoff = end_minutes - policy.early_departure_grace_minutes
    is_early = check_out_minutes < early_cutoff

    if not policy.auto_detect_early_departure:
        return current_status, hours_worked, is_early

    # If worked less than half-day threshold, record as HALF_DAY
    if hours_worked < policy.half_day_hours_threshold:
        return AttendanceStatus.HALF_DAY, hours_worked, is_early

    # Preserve prior status (e.g., LATE) if set
    if current_status in (AttendanceStatus.LATE, AttendanceStatus.HALF_DAY):
        return current_status, hours_worked, is_early

    return AttendanceStatus.PRESENT, hours_worked, is_early
