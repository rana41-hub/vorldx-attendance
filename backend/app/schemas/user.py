from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class UserBase(BaseModel):
    email: EmailStr
    admin_id: Optional[str] = None
    role: UserRole = UserRole.EMPLOYEE
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    login_id: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Assigned unique Admin ID or Employee ID",
    )
    password: str = Field(..., min_length=1, max_length=128)


class UserAuthProfile(BaseModel):
    id: int
    role: UserRole
    admin_id: Optional[str] = None
    employee_id: Optional[int] = None
    employee_code: Optional[str] = None
    full_name: Optional[str] = None
    email: str
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserAuthProfile


class EmployeeActivationRequest(BaseModel):
    employee_code: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Assigned unique Employee ID",
    )
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class EmployeeAccountCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class AccountStatusUpdateRequest(BaseModel):
    is_active: bool
