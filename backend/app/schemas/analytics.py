from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.models.enums import AttendanceStatus, WFHStatus


class DashboardMetricsResponse(BaseModel):
    date: date
    total_active_employees: int = Field(
        description="Total active employees eligible for attendance"
    )
    present_today: int = Field(
        description="Active employees with attendance record (PRESENT, LATE, or HALF_DAY)"
    )
    absent_today: int = Field(
        description="Active employees not checked in, not on approved leave, and not on approved WFH"
    )
    on_leave_today: int = Field(
        description="Active employees with approved leave covering this date"
    )
    wfh_today: int = Field(
        description="Active employees with approved WFH covering this date"
    )
    half_day_today: int = Field(
        description="Active employees whose attendance status is HALF_DAY"
    )
    late_today: int = Field(
        description="Active employees whose attendance status is LATE"
    )
    incomplete_today: int = Field(
        default=0,
        description="Active employees whose attendance shift is missing checkout or un-concluded"
    )
    attendance_percentage: float = Field(
        default=0.0,
        description="Percentage of eligible active employees who attended on this date"
    )
    pending_leave_requests: int = Field(
        description="Total pending leave requests organization-wide"
    )
    pending_wfh_requests: int = Field(
        description="Total pending WFH requests organization-wide"
    )


class DailyAttendanceReportResponse(BaseModel):
    report_date: date
    total_active_employees: int = Field(description="Total active organization employees")
    eligible_employees: int = Field(description="Active employees excluding approved leaves")
    present_count: int = Field(description="Employees checked in on-time (PRESENT)")
    late_count: int = Field(description="Employees checked in late (LATE)")
    half_day_count: int = Field(description="Employees with HALF_DAY records")
    total_attended: int = Field(description="Total unique employees attended (PRESENT, LATE, HALF_DAY)")
    incomplete_count: int = Field(description="Employees with missing checkout or unclosed session")
    on_leave_count: int = Field(description="Employees on approved leave covering report date")
    wfh_count: int = Field(description="Employees on approved WFH covering report date")
    absent_count: int = Field(description="Active employees without attendance, leave, or WFH")
    attended_eligible_count: int = Field(default=0, description="Active attended employees who are eligible (attended minus approved leave)")
    wfh_remote_count: int = Field(default=0, description="Active employees on approved WFH who did not attend office")
    attended_wfh_count: int = Field(default=0, description="Active employees on approved WFH who also attended office")
    attendance_percentage: float = Field(description="Attendance compliance rate percentage")
    definitions: dict[str, str] = Field(default_factory=dict, description="Documented formula and metric definitions")


class LateAttendanceItem(BaseModel):
    record_id: int
    employee_id: int
    employee_code: str
    employee_name: str
    department: str
    attendance_date: date
    check_in: datetime
    check_out: Optional[datetime] = None
    minutes_late: Optional[int] = Field(None, description="Minutes elapsed past late grace-period cutoff (shift start + grace minutes)")
    status: AttendanceStatus
    is_corrected: bool = False
    source: Optional[str] = None


class LateAttendanceReportResponse(BaseModel):
    start_date: date
    end_date: date
    total_late_records: int
    total_attendance_records: int
    late_percentage: float = Field(description="Percentage of attended records that were late")
    shift_start_time: str
    late_grace_minutes: int
    records: list[LateAttendanceItem] = Field(default_factory=list)


class WFHReportItem(BaseModel):
    id: int
    employee_id: int
    employee_code: str
    employee_name: str
    department: str
    start_date: date
    end_date: date
    days_count: int
    reason: str
    status: WFHStatus
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None


class WFHReportResponse(BaseModel):
    start_date: date
    end_date: date
    filter_by: str = Field(description="'target_date' or 'submission_date'")
    total_requests: int
    pending_requests: int
    approved_requests: int
    rejected_requests: int
    cancelled_requests: int
    total_approved_wfh_days: int
    requests: list[WFHReportItem] = Field(default_factory=list)


class AttendanceSummaryResponse(BaseModel):
    start_date: date
    end_date: date
    total_days: int
    total_active_employees: int
    total_attendance_records: int
    present_count: int
    late_count: int
    half_day_count: int
    approved_leave_days: int
    approved_wfh_days: int
    average_daily_attendance: float
    attendance_rate_percentage: float


class DailyTrendItem(BaseModel):
    date: date
    present: int
    late: int
    half_day: int
    on_leave: int
    wfh: int
    absent: int
    total_active: int


class AttendanceTrendsResponse(BaseModel):
    start_date: date
    end_date: date
    trends: list[DailyTrendItem]
