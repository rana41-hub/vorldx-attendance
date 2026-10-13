from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from enum import Enum

from app.models.enums import LeaveStatus


class LeaveReviewAction(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class LeaveReviewRequest(BaseModel):
    action: LeaveReviewAction
    review_notes: Optional[str] = Field(default=None, max_length=500)


class LeaveRequestBase(BaseModel):
    employee_id: int
    start_date: date
    end_date: date
    reason: str = Field(min_length=3, max_length=1000)


class LeaveRequestCreate(LeaveRequestBase):
    pass


class LeaveRequestResponse(LeaveRequestBase):
    id: int
    status: LeaveStatus
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
