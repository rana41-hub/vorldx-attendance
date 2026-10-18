from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AttendanceStatus


class AttendanceRecordBase(BaseModel):
    employee_id: int
    attendance_date: date
    status: AttendanceStatus = AttendanceStatus.PRESENT
    source: Optional[str] = "OFFICE_QR"


class AttendanceCheckInRequest(BaseModel):
    employee_id: int
    source: Optional[str] = "OFFICE_QR"
    timestamp: Optional[datetime] = None
    qr_token: Optional[str] = None


class AttendanceCheckOutRequest(BaseModel):
    employee_id: int
    timestamp: Optional[datetime] = None


class AttendanceRecordResponse(AttendanceRecordBase):
    id: int
    check_in: datetime
    check_out: Optional[datetime] = None
    created_at: datetime
    hours_worked: Optional[float] = None
    session_state: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EmployeeAttendanceStats(BaseModel):
    present_days: int = Field(description="Total on-time present attendance days")
    late_days: int = Field(description="Total late attendance days")
    half_day_days: int = Field(description="Total half-day attendance days")
    total_attended_days: int = Field(description="Total days attended (present + late + half_day)")
    total_records: int = Field(description="Total recorded attendance rows up to today")
    approved_leave_days: int = Field(description="Total approved leave days")
    approved_wfh_days: int = Field(description="Total approved WFH days")
    eligible_working_days: int = Field(description="Total working days (weekdays excluding approved leaves) in the period")
    attendance_percentage: float = Field(description="Calculated attendance compliance percentage")
    percentage_formula: str = Field(description="Documented formula and denominator explanation")


class EmployeeDashboardResponse(BaseModel):
    employee_id: int
    employee_code: str
    employee_name: str
    today_status: AttendanceStatus
    today_record: Optional[AttendanceRecordResponse] = None
    stats: EmployeeAttendanceStats
    recent_records: list[AttendanceRecordResponse] = Field(
        default_factory=list,
        description="Latest 3 to 5 verified attendance records"
    )
    session_state: Optional[str] = Field(
        default="NOT_STARTED",
        description="Current attendance session state: 'IN_PROGRESS', 'INCOMPLETE', 'COMPLETED', or 'NOT_STARTED'"
    )
    is_session_open: bool = Field(
        default=False,
        description="True if employee is currently checked in without checkout"
    )
    current_shift_credit: float = Field(
        default=0.0,
        description="Attendance credit earned by the current/today session"
    )

