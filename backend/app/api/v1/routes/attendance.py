from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dependencies.auth import get_optional_current_user, require_self_or_admin
from app.dependencies.database import get_db
from app.models.attendance import AttendanceRecord
from app.models.employee import Employee
from app.models.enums import AttendanceStatus, UserRole
from app.models.user import User
from app.schemas.attendance import (
    AttendanceCheckInRequest,
    AttendanceCheckOutRequest,
    AttendanceRecordResponse,
)

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("", response_model=list[AttendanceRecordResponse])
def list_attendance(
    attendance_date: Optional[date] = Query(None, description="Filter by date"),
    employee_id: Optional[int] = Query(None, description="Filter by employee ID"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    # Enforce employee data isolation if authenticated as EMPLOYEE
    if current_user and current_user.role == UserRole.EMPLOYEE:
        caller_emp = current_user.employee
        if not caller_emp:
            return []
        employee_id = caller_emp.id

    query = select(AttendanceRecord)
    if attendance_date:
        query = query.where(AttendanceRecord.attendance_date == attendance_date)
    if employee_id:
        query = query.where(AttendanceRecord.employee_id == employee_id)
    query = (
        query.order_by(
            AttendanceRecord.attendance_date.desc(),
            AttendanceRecord.check_in.desc(),
        )
        .offset(offset)
        .limit(limit)
    )
    return db.scalars(query).all()


@router.post(
    "/check-in",
    response_model=AttendanceRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
def record_check_in(
    payload: AttendanceCheckInRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    if current_user:
        require_self_or_admin(payload.employee_id, current_user)

    employee = db.get(Employee, payload.employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )

    now = datetime.now(timezone.utc)
    today = now.date()

    existing = db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.employee_id == payload.employee_id,
            AttendanceRecord.attendance_date == today,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attendance record already exists for this employee today.",
        )

    record = AttendanceRecord(
        employee_id=payload.employee_id,
        attendance_date=today,
        check_in=now,
        status=AttendanceStatus.PRESENT,
        source=payload.source or "OFFICE_QR",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.post("/check-out", response_model=AttendanceRecordResponse)
def record_check_out(
    payload: AttendanceCheckOutRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    if current_user:
        require_self_or_admin(payload.employee_id, current_user)

    now = datetime.now(timezone.utc)
    today = now.date()

    record = db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.employee_id == payload.employee_id,
            AttendanceRecord.attendance_date == today,
        )
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No check-in record found for today to check out from.",
        )

    if record.check_out is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee has already checked out for today.",
        )

    record.check_out = now
    db.commit()
    db.refresh(record)
    return record
