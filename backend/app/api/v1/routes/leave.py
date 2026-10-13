from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies.auth import (
    get_optional_current_user,
    require_admin_user,
    require_self_or_admin,
)
from app.dependencies.database import get_db
from app.models.employee import Employee
from app.models.enums import LeaveStatus, UserRole
from app.models.leave import LeaveRequest
from app.models.user import User
from app.schemas.leave import (
    LeaveRequestCreate,
    LeaveRequestResponse,
    LeaveReviewAction,
    LeaveReviewRequest,
)

router = APIRouter(prefix="/leave", tags=["Leave Requests"])


@router.get("", response_model=list[LeaveRequestResponse])
def list_leave_requests(
    status_filter: Optional[LeaveStatus] = Query(None, alias="status"),
    employee_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    # Enforce data isolation if authenticated as EMPLOYEE
    if current_user and current_user.role == UserRole.EMPLOYEE:
        caller_emp = current_user.employee
        if not caller_emp:
            return []
        employee_id = caller_emp.id

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
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    if current_user:
        require_self_or_admin(payload.employee_id, current_user)

    if payload.end_date < payload.start_date:
        err_status = (
            status.HTTP_422_UNPROCESSABLE_CONTENT
            if hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT")
            else 422
        )
        raise HTTPException(
            status_code=err_status,
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


@router.patch("/{leave_id}/review", response_model=LeaveRequestResponse)
def review_leave_request(
    leave_id: int,
    payload: LeaveReviewRequest,
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    leave_request = db.get(LeaveRequest, leave_id)
    if not leave_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found.",
        )

    if leave_request.status != LeaveStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot review leave request #{leave_id}. "
                f"Current status is '{leave_request.status.value}', only PENDING requests can be reviewed."
            ),
        )

    if payload.action in (LeaveReviewAction.APPROVE, LeaveReviewAction.APPROVED):
        target_status = LeaveStatus.APPROVED
    elif payload.action in (LeaveReviewAction.REJECT, LeaveReviewAction.REJECTED):
        target_status = LeaveStatus.REJECTED
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid review action '{payload.action}'. Only APPROVE or REJECT are permitted.",
        )

    leave_request.status = target_status
    leave_request.reviewed_by = current_admin.id
    leave_request.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(leave_request)
    return leave_request
