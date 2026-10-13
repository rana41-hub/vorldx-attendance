from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


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
    pending_leave_requests: int = Field(
        description="Total pending leave requests organization-wide"
    )
    pending_wfh_requests: int = Field(
        description="Total pending WFH requests organization-wide"
    )


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
