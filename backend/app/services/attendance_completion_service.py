"""Centralized Attendance Completion and Credit Policy Service for VorldX.

Authoritative source of truth for:
1. Determining whether an attendance session is open (IN_PROGRESS).
2. Determining whether a shift is complete (COMPLETED vs INCOMPLETE).
3. Authoritative server-side timestamp duration calculations.
4. Applicable attendance status (PRESENT, LATE, HALF_DAY, ABSENT).
5. Attendance credit calculation (1.0 for qualifying 8.0+ hour full day, 0.0 for incomplete or open shifts).
6. Configurable 9 AM - 5 PM development shift defaults with Asia/Kolkata timezone support.
7. Grace-period and late-arrival rules enforcement.
"""
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from typing import Optional, Tuple
from zoneinfo import ZoneInfo

from app.config import settings
from app.models.attendance_policy import AttendancePolicy
from app.models.enums import AttendanceStatus


# Configurable Development Shift Defaults (9 AM - 5 PM, 8 hours, Asia/Kolkata)
DEFAULT_SHIFT_START_TIME = time(9, 0)
DEFAULT_SHIFT_END_TIME = time(17, 0)
DEFAULT_EXPECTED_DURATION_HOURS = 8.0
DEFAULT_ORGANIZATION_TIMEZONE = "Asia/Kolkata"
DEFAULT_LATE_GRACE_MINUTES = 15
DEFAULT_EARLY_DEPARTURE_GRACE_MINUTES = 15
DEFAULT_HALF_DAY_HOURS = 4.0


@dataclass
class SessionEvaluationResult:
    is_open: bool
    is_complete: bool
    hours_worked: float
    is_late: bool
    is_early: bool
    status: AttendanceStatus
    attendance_credit: float
    session_state: str  # "IN_PROGRESS" | "INCOMPLETE" | "COMPLETED"


def ensure_timezone_aware(dt: datetime) -> datetime:
    """Ensure a datetime object is timezone-aware (assumes UTC if naive)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def get_organization_timezone_name(policy: Optional[AttendancePolicy] = None) -> str:
    """
    Resolve the organization timezone.
    Prefers explicit ORGANIZATION_TIMEZONE if set to a non-UTC value,
    otherwise defaults to DEFAULT_ORGANIZATION_TIMEZONE (Asia/Kolkata).
    """
    if settings.ORGANIZATION_TIMEZONE and settings.ORGANIZATION_TIMEZONE != "UTC":
        return settings.ORGANIZATION_TIMEZONE
    return DEFAULT_ORGANIZATION_TIMEZONE


def to_shift_organization_time(dt: datetime, tz_name: Optional[str] = None) -> datetime:
    """Convert any datetime to the organization timezone for shift calculations."""
    aware_dt = ensure_timezone_aware(dt)
    target_tz = tz_name or get_organization_timezone_name()
    try:
        org_tz = ZoneInfo(target_tz)
        return aware_dt.astimezone(org_tz)
    except Exception:
        return aware_dt


def is_session_open(check_in: Optional[datetime], check_out: Optional[datetime]) -> bool:
    """True if employee has checked in but not checked out."""
    return check_in is not None and check_out is None


def calculate_session_duration(
    check_in: datetime,
    check_out: Optional[datetime] = None,
) -> Tuple[float, float]:
    """
    Calculate actual session duration in seconds and hours.
    If check_out is None, calculates elapsed live duration relative to UTC now.
    Returns (duration_seconds, hours_worked).
    """
    aware_in = ensure_timezone_aware(check_in)
    if check_out is not None:
        aware_out = ensure_timezone_aware(check_out)
    else:
        aware_out = datetime.now(timezone.utc)

    duration_seconds = max(0.0, (aware_out - aware_in).total_seconds())
    hours_worked = round(duration_seconds / 3600.0, 2)
    return duration_seconds, hours_worked


def check_is_late(
    check_in_dt: datetime,
    policy: AttendancePolicy,
    tz_name: Optional[str] = None,
) -> bool:
    """Check if check-in time exceeds shift start time plus late grace period."""
    local_in = to_shift_organization_time(check_in_dt, tz_name=tz_name)
    check_in_minutes = local_in.hour * 60 + local_in.minute
    start_minutes = policy.work_start_time.hour * 60 + policy.work_start_time.minute
    grace_cutoff = start_minutes + policy.late_grace_minutes
    return check_in_minutes > grace_cutoff


def check_is_early_departure(
    check_in_dt: datetime,
    check_out_dt: datetime,
    policy: AttendancePolicy,
    tz_name: Optional[str] = None,
) -> bool:
    """Check if check-out time is earlier than shift end time minus departure grace period."""
    local_in = to_shift_organization_time(check_in_dt, tz_name=tz_name)
    local_out = to_shift_organization_time(check_out_dt, tz_name=tz_name)

    # If shift crossed midnight calendar date, not an early departure
    if local_out.date() > local_in.date():
        return False

    check_out_minutes = local_out.hour * 60 + local_out.minute
    end_minutes = policy.work_end_time.hour * 60 + policy.work_end_time.minute
    early_cutoff = end_minutes - policy.early_departure_grace_minutes
    return check_out_minutes < early_cutoff


def evaluate_record_completion(
    check_in: datetime,
    check_out: Optional[datetime],
    policy: AttendancePolicy,
    current_status: Optional[AttendanceStatus] = None,
    tz_name: Optional[str] = None,
) -> SessionEvaluationResult:
    """
    Authoritative centralized evaluation of attendance session completion, status, and credit.

    Rules (Strict Full-Day Policy):
    - Open session (check_out is None):
        Marked IN_PROGRESS. Earns 0.0 attendance credit. Does not count as a completed attendance day.
    - Closed session (check_out is not None):
        * If hours_worked >= full_day_hours_threshold (e.g. 8.0 hrs) and not early departure:
            Marked COMPLETED. Earns 1.0 full attendance credit (max 1.0 even if > 8.0 hrs).
            Status: PRESENT (if on-time) or LATE (if late arrival).
        * If hours_worked < full_day_hours_threshold (e.g. 3 minutes, 4 hours, or 7.9 hours):
            Marked INCOMPLETE. Earns 0.0 attendance credit.
            Status: HALF_DAY (existing DB enum) / INCOMPLETE.
            Does not count as a present day or half day credit.
    """
    _, hours_worked = calculate_session_duration(check_in, check_out)
    is_late = check_is_late(check_in, policy, tz_name=tz_name)

    # 1. Open session (In-progress)
    if check_out is None:
        initial_status = AttendanceStatus.LATE if (is_late and policy.auto_detect_late_arrival) else (
            current_status or AttendanceStatus.PRESENT
        )
        return SessionEvaluationResult(
            is_open=True,
            is_complete=False,
            hours_worked=hours_worked,
            is_late=is_late,
            is_early=False,
            status=initial_status,
            attendance_credit=0.0,
            session_state="IN_PROGRESS",
        )

    # 2. Closed session
    is_early = check_is_early_departure(check_in, check_out, policy, tz_name=tz_name)
    full_day_threshold = policy.full_day_hours_threshold or DEFAULT_EXPECTED_DURATION_HOURS

    # Strict Full-Day Policy: Qualifying full shift completion (>= 8.0 hours)
    if hours_worked >= full_day_threshold and not (policy.auto_detect_early_departure and is_early):
        if is_late and policy.auto_detect_late_arrival:
            final_status = AttendanceStatus.LATE
        elif current_status == AttendanceStatus.LATE:
            final_status = AttendanceStatus.LATE
        else:
            final_status = AttendanceStatus.PRESENT

        return SessionEvaluationResult(
            is_open=False,
            is_complete=True,
            hours_worked=hours_worked,
            is_late=is_late,
            is_early=is_early,
            status=final_status,
            attendance_credit=1.0,  # Max 1.0 even if hours_worked > 8.0
            session_state="COMPLETED",
        )

    # Incomplete shift: any duration < full_day_threshold (e.g. 3 mins, 4 hours, 7.9 hours)
    # Under Strict Full-Day Policy, NO half-day credit is awarded. Earns 0.0 attendance credit.
    return SessionEvaluationResult(
        is_open=False,
        is_complete=False,
        hours_worked=hours_worked,
        is_late=is_late,
        is_early=is_early,
        status=AttendanceStatus.HALF_DAY,
        attendance_credit=0.0,
        session_state="INCOMPLETE",
    )
