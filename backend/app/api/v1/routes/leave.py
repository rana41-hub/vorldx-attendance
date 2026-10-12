from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies.database import get_db
from app.models.employee import Employee
from app.models.enums import LeaveStatus
from app.models.leave import LeaveRequest
from app.schemas.leave import LeaveRequestCreate, LeaveRequestResponse

router = APIRouter(prefix="/leave", tags=["Leave Requests"])


@router.get("", response_model=list[LeaveRequestResponse])
def list_leave_requests(
    status_filter: Optional[LeaveStatus] = Query(None, alias="status"),
    employee_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = select(LeaveRequest)
    if status_filter:
        query = query.where(LeaveRequest.status == status_filter)
    if employee_id:
        query = query.where(LeaveRequest.employee_id == employee_id)
    query = query.order_by(LeaveRequest.created_at.desc()).offset(offset).limit(limit)
    return db.scalars(query).all()


@router.post("", response_model=LeaveRequestResponse, status_code=status.HTTP_201_CREATED)
def submit_leave_request(
    payload: LeaveRequestCreate,
    db: Session = Depends(get_db),
):
    if payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=getattr(
                status,
                "HTTP_422_UNPROCESSABLE_CONTENT",
                status.HTTP_422_UNPROCESSABLE_ENTITY,
            ),
            detail="End date cannot be earlier than start date.",
        )

    employee = db.get(Employee, payload.employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )

    leave_request = LeaveRequest(
        employee_id=payload.employee_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
        status=LeaveStatus.PENDING,
    )
    db.add(leave_request)
    db.commit()
    db.refresh(leave_request)
    return leave_request
