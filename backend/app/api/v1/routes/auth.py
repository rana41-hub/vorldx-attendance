from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.employee import Employee
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import (
    EmployeeActivationRequest,
    LoginRequest,
    TokenResponse,
    UserAuthProfile,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class AuthStatusResponse(BaseModel):
    status: str
    message: str
    version: str


@router.get("/status", response_model=AuthStatusResponse)
def auth_status():
    """Service readiness probe for authentication subsystem."""
    return {
        "status": "ready",
        "message": "Authentication subsystem initialized. JWT and PBKDF2 password hashing enabled.",
        "version": "v1",
    }


def _build_auth_profile(user: User, employee: Employee | None = None) -> UserAuthProfile:
    emp = employee or user.employee
    full_name = emp.full_name if emp else ("HR Administrator" if user.role == UserRole.ADMIN else None)
    return UserAuthProfile(
        id=user.id,
        role=user.role,
        admin_id=user.admin_id,
        employee_id=emp.id if emp else None,
        employee_code=emp.employee_code if emp else None,
        full_name=full_name,
        email=user.email,
        is_active=user.is_active,
    )


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Authenticate using either:
    1. Assigned unique Admin ID and password (for Administrators).
    2. Assigned unique Employee ID and password (for Employees).
    Email is strictly rejected as a login identifier.
    """
    login_id = payload.login_id.strip()

    # 1. Check if login_id matches an Administrator by unique Admin ID
    admin_user = db.scalar(
        select(User).where(
            User.admin_id == login_id,
            User.role == UserRole.ADMIN,
        )
    )
    if admin_user:
        if not admin_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin account has been deactivated.",
            )
        if not verify_password(payload.password, admin_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = create_access_token(
            {
                "sub": str(admin_user.id),
                "role": admin_user.role.value,
                "admin_id": admin_user.admin_id,
            }
        )
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=_build_auth_profile(admin_user),
        )

    # 2. Check if login_id matches an Employee by unique Employee ID (employee_code)
    employee = db.scalar(
        select(Employee).where(Employee.employee_code == login_id)
    )
    if employee:
        user = employee.user
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee account is not activated. Please complete account activation first.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employee account has been deactivated.",
            )
        if not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = create_access_token(
            {
                "sub": str(user.id),
                "role": user.role.value,
                "employee_id": employee.id,
                "employee_code": employee.employee_code,
            }
        )
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=_build_auth_profile(user, employee),
        )

    # Neither valid Admin ID nor Employee ID
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.get("/me", response_model=UserAuthProfile)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """Retrieve profile and identity of the currently authenticated caller."""
    return _build_auth_profile(current_user)


@router.post("/activate", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def activate_employee_account(
    payload: EmployeeActivationRequest,
    db: Session = Depends(get_db),
):
    """
    Employee self-activation endpoint.
    Requires an existing HR-created Employee record matching the Employee ID.
    Initializes employee login credentials and links the User account.
    """
    code = payload.employee_code.strip()
    employee = db.scalar(
        select(Employee).where(Employee.employee_code == code)
    )
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No employee record found for Employee ID '{code}'. Please contact HR to be registered.",
        )

    if employee.user_id is not None and employee.user is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Account for Employee ID '{code}' is already activated. Please log in.",
        )

    existing_email = db.scalar(
        select(User).where(User.email == payload.email)
    )
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{payload.email}' is already associated with another account.",
        )

    new_user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.EMPLOYEE,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    employee.user_id = new_user.id
    db.commit()
    db.refresh(employee)
    db.refresh(new_user)

    token = create_access_token(
        {
            "sub": str(new_user.id),
            "role": new_user.role.value,
            "employee_id": employee.id,
            "employee_code": employee.employee_code,
        }
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=_build_auth_profile(new_user, employee),
    )
