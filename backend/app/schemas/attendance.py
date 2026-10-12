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


class AttendanceCheckOutRequest(BaseModel):
    employee_id: int


class AttendanceRecordResponse(AttendanceRecordBase):
    id: int
    check_in: datetime
    check_out: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
