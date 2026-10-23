from datetime import datetime, time
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import AttendanceStatus


class AttendancePolicyBase(BaseModel):
    policy_name: str = Field(default="Standard Organization Policy", max_length=100)
    work_start_time: time = Field(default=time(9, 30))
    work_end_time: time = Field(default=time(18, 30))
    late_grace_minutes: int = Field(default=15, ge=0, le=120)
    early_departure_grace_minutes: int = Field(default=15, ge=0, le=120)
    half_day_hours_threshold: float = Field(default=4.0, ge=1.0, le=12.0)
    full_day_hours_threshold: float = Field(default=8.0, ge=4.0, le=16.0)
    auto_detect_late_arrival: bool = Field(default=False)
    auto_detect_early_departure: bool = Field(default=False)
    is_active: bool = Field(default=True)


class AttendancePolicyUpdate(BaseModel):
    policy_name: Optional[str] = Field(default=None, max_length=100)
    work_start_time: Optional[time] = None
    work_end_time: Optional[time] = None
    late_grace_minutes: Optional[int] = Field(default=None, ge=0, le=120)
    early_departure_grace_minutes: Optional[int] = Field(default=None, ge=0, le=120)
    half_day_hours_threshold: Optional[float] = Field(default=None, ge=1.0, le=12.0)
    full_day_hours_threshold: Optional[float] = Field(default=None, ge=4.0, le=16.0)
    auto_detect_late_arrival: Optional[bool] = None
    auto_detect_early_departure: Optional[bool] = None
    is_active: Optional[bool] = None
    reason: Optional[str] = Field(default=None, max_length=500, description="Reason for policy configuration update")

    @model_validator(mode="after")
    def validate_shift_times(self) -> "AttendancePolicyUpdate":
        if self.work_start_time is not None and self.work_end_time is not None:
            if self.work_start_time == self.work_end_time:
                raise ValueError("Shift start time and end time cannot be identical.")
        return self


class AttendancePolicyResponse(AttendancePolicyBase):
    id: int
    updated_at: datetime
    updated_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class PolicyCalculationRequest(BaseModel):
    check_in: datetime
    check_out: Optional[datetime] = None


class PolicyCalculationResponse(BaseModel):
    status: AttendanceStatus
    hours_worked: Optional[float] = None
    is_late: bool
    is_early_departure: bool
    details: str
