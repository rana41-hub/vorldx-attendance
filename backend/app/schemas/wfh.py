from datetime import date, datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import WFHStatus


class WFHReviewAction(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class WFHReviewRequest(BaseModel):
    action: WFHReviewAction
    review_notes: Optional[str] = Field(default=None, max_length=500)


class WFHRequestBase(BaseModel):
    employee_id: int
    start_date: date
    end_date: date
    reason: str = Field(min_length=3, max_length=1000)

    @field_validator("reason")
    @classmethod
    def validate_reason_non_empty(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 3:
            raise ValueError("Reason must contain at least 3 non-whitespace characters.")
        return trimmed


class WFHRequestCreate(WFHRequestBase):
    pass


class WFHRequestResponse(WFHRequestBase):
    id: int
    status: WFHStatus
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
