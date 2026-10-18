from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies.auth import (
    get_current_user,
    require_admin_user,
    require_self_or_admin,
)
from app.dependencies.database import get_db
from app.models.employee import Employee
from app.models.enums import UserRole, WFHStatus
from app.models.user import User
from app.models.wfh import WFHRequest
from app.schemas.wfh import (
    WFHRequestCreate,
    WFHRequestResponse,
    WFHReviewAction,
    WFHReviewRequest,
)

router = APIRouter(prefix="/wfh", tags=["Work From Home"])


@router.get("", response_model=list[WFHRequestResponse])
def list_wfh_requests(
    status_filter: Optional[WFHStatus] = Query(None, alias="status"),
    employee_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List Work-from-Home requests.
    - Authenticated employees can view only their own requests.
    - Administrators can view requests organization-wide.
    """
    if current_user.role == UserRole.EMPLOYEE:
        caller_emp = current_user.employee
        if not caller_emp:
            return []
        employee_id = caller_emp.id

    query = select(WFHRequest)
    if status_filter:
        query = query.where(WFHRequest.status == status_filter)
    if employee_id:
        query = query.where(WFHRequest.employee_id == employee_id)
    query = query.order_by(WFHRequest.created_at.desc()).offset(offset).limit(limit)
    return db.scalars(query).all()


@router.post("", response_model=WFHRequestResponse, status_code=status.HTTP_201_CREATED)
def submit_wfh_request(
    payload: WFHRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit a Work-from-Home request.
    - Employees can submit requests only for their own server-derived account.
    - Date range validation prevents end date earlier than start date.
    - Inactive employees cannot submit WFH requests.
    - Status initializes to PENDING.
    """
    if current_user.role == UserRole.EMPLOYEE:
        caller_emp = current_user.employee
        if not caller_emp:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No active employee profile associated with authenticated user.",
            )
        require_self_or_admin(payload.employee_id, current_user)
        effective_employee_id = caller_emp.id
        employee = caller_emp
    else:
        # Admin submitting on behalf of an employee
        effective_employee_id = payload.employee_id
        employee = db.get(Employee, effective_employee_id)
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found.",
            )

    if employee.user and not employee.user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive employees are not eligible for Work-from-Home requests.",
        )

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

    wfh_request = WFHRequest(
        employee_id=effective_employee_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
        status=WFHStatus.PENDING,
    )
    db.add(wfh_request)
    db.commit()
    db.refresh(wfh_request)
    return wfh_request


@router.patch("/{wfh_id}/review", response_model=WFHRequestResponse)
def review_wfh_request(
    wfh_id: int,
    payload: WFHReviewRequest,
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """
    Review (approve or reject) a Work-from-Home request.
    - Restricted strictly to Administrators.
    - Administrators cannot approve or reject their own WFH requests.
    - Authenticated administrator is recorded as reviewer.
    - Approved WFH requests do NOT automatically record attendance.
    """
    wfh_request = db.get(WFHRequest, wfh_id)
    if not wfh_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work-from-home request not found.",
        )

    # Prevent employee self-approval even if the employee is also an administrator
    if current_admin.employee and wfh_request.employee_id == current_admin.employee.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators cannot approve or reject their own WFH requests.",
        )

    if wfh_request.status != WFHStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot review WFH request #{wfh_id}. "
                f"Current status is '{wfh_request.status.value}', only PENDING requests can be reviewed."
            ),
        )

    if payload.action in (WFHReviewAction.APPROVE, WFHReviewAction.APPROVED):
        target_status = WFHStatus.APPROVED
    elif payload.action in (WFHReviewAction.REJECT, WFHReviewAction.REJECTED):
        target_status = WFHStatus.REJECTED
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid review action '{payload.action}'. Only APPROVE or REJECT are permitted.",
        )

    wfh_request.status = target_status
    wfh_request.reviewed_by = current_admin.id
    wfh_request.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(wfh_request)
    return wfh_request
