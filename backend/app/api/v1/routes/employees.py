from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.dependencies.auth import require_admin_user
from app.dependencies.database import get_db
from app.models.attendance import AttendanceRecord
from app.models.employee import Employee
from app.models.enums import UserRole
from app.models.leave import LeaveRequest
from app.models.user import User
from app.models.wfh import WFHRequest
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeDeleteResponse,
    EmployeeResponse,
    EmployeeUpdate,
)
from app.schemas.user import (
    AccountStatusUpdateRequest,
    EmployeeAccountCreateRequest,
)

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("", response_model=list[EmployeeResponse])
def list_employees(
    department: Optional[str] = Query(None, description="Filter by department"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = select(Employee)
    if department:
        query = query.where(Employee.department == department)
    query = query.order_by(Employee.id.desc()).offset(offset).limit(limit)
    return db.scalars(query).all()


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
):
    existing = db.scalar(
        select(Employee).where(Employee.employee_code == payload.employee_code)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Employee code '{payload.employee_code}' already exists.",
        )

    employee = Employee(**payload.model_dump())
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )
    return employee


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)

    # Check employee_code uniqueness if updated
    if "employee_code" in update_data and update_data["employee_code"] is not None:
        new_code = update_data["employee_code"]
        if new_code != employee.employee_code:
            existing = db.scalar(
                select(Employee).where(
                    Employee.employee_code == new_code,
                    Employee.id != employee_id,
                )
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Employee code '{new_code}' already exists.",
                )

    # Check user_id if provided
    if "user_id" in update_data and update_data["user_id"] is not None:
        new_user_id = update_data["user_id"]
        if new_user_id != employee.user_id:
            user = db.get(User, new_user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User with ID {new_user_id} not found.",
                )
            existing_user_emp = db.scalar(
                select(Employee).where(
                    Employee.user_id == new_user_id,
                    Employee.id != employee_id,
                )
            )
            if existing_user_emp:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"User ID {new_user_id} is already linked to another employee.",
                )

    for field, value in update_data.items():
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)
    return employee


@router.delete("/{employee_id}", response_model=EmployeeDeleteResponse)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )

    # Check for related attendance records
    attendance_count = db.scalar(
        select(func.count(AttendanceRecord.id)).where(
            AttendanceRecord.employee_id == employee_id
        )
    ) or 0

    # Check for related leave requests
    leave_count = db.scalar(
        select(func.count(LeaveRequest.id)).where(
            LeaveRequest.employee_id == employee_id
        )
    ) or 0

    # Check for related WFH requests
    wfh_count = db.scalar(
        select(func.count(WFHRequest.id)).where(
            WFHRequest.employee_id == employee_id
        )
    ) or 0

    if attendance_count > 0 or leave_count > 0 or wfh_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot delete employee '{employee.employee_code}' with existing "
                f"historical records ({attendance_count} attendance records, "
                f"{leave_count} leave requests, {wfh_count} WFH requests). "
                f"Historical records must be preserved."
            ),
        )

    emp_code = employee.employee_code
    db.delete(employee)
    db.commit()
    return EmployeeDeleteResponse(
        status="success",
        message=f"Employee '{emp_code}' deleted successfully.",
        id=employee_id,
    )


@router.post("/{employee_id}/account", status_code=status.HTTP_201_CREATED)
def create_employee_account(
    employee_id: int,
    payload: EmployeeAccountCreateRequest,
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """Admin-controlled endpoint to provision or reset login credentials for an employee."""
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )

    # Check if email is already taken by another user
    existing_user_by_email = db.scalar(
        select(User).where(User.email == payload.email)
    )
    if existing_user_by_email and existing_user_by_email.id != employee.user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{payload.email}' is already in use.",
        )

    if employee.user:
        # Update existing credentials
        user = employee.user
        user.email = payload.email
        user.password_hash = hash_password(payload.password)
        user.is_active = True
    else:
        # Create new user and link
        user = User(
            email=payload.email,
            password_hash=hash_password(payload.password),
            role=UserRole.EMPLOYEE,
            is_active=True,
        )
        db.add(user)
        db.flush()
        employee.user_id = user.id

    db.commit()
    db.refresh(employee)
    return {
        "status": "success",
        "message": f"Login credentials for employee '{employee.employee_code}' provisioned successfully.",
        "employee_id": employee.id,
        "employee_code": employee.employee_code,
        "user_id": user.id,
    }


@router.patch("/{employee_id}/status")
def update_employee_account_status(
    employee_id: int,
    payload: AccountStatusUpdateRequest,
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    """Admin-controlled endpoint to activate or deactivate an employee account."""
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found.",
        )

    if not employee.user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee does not have an activated user account.",
        )

    employee.user.is_active = payload.is_active
    db.commit()
    db.refresh(employee.user)
    status_str = "activated" if payload.is_active else "deactivated"
    return {
        "status": "success",
        "message": f"Account for employee '{employee.employee_code}' has been {status_str}.",
        "employee_id": employee.id,
        "is_active": employee.user.is_active,
    }
