from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

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


class AttendanceCorrectionRequest(BaseModel):
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: Optional[AttendanceStatus] = None
    reason: str = Field(min_length=3, max_length=500, description="Mandatory reason for administrative correction")

    @field_validator("reason")
    @classmethod
    def validate_reason_not_empty(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 3:
            raise ValueError("Correction reason must contain at least 3 non-whitespace characters.")
        return trimmed


class AttendanceRecordResponse(AttendanceRecordBase):
    id: int
    check_in: datetime
    check_out: Optional[datetime] = None
    created_at: datetime
    hours_worked: Optional[float] = None
    session_state: Optional[str] = None
    is_corrected: bool = False
    corrected_at: Optional[datetime] = None
    corrected_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    id: int
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    action_type: str
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    attendance_record_id: Optional[int] = None
    policy_id: Optional[int] = None
    reason: str
    previous_values: Optional[dict] = None
    updated_values: Optional[dict] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("previous_values", "updated_values", mode="before")
    @classmethod
    def parse_json_string(cls, v):
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except Exception:
                return None
        return v


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

