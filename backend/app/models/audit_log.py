from datetime import datetime
from typing import Optional
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    admin_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    attendance_record_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("attendance_records.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    policy_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("attendance_policies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    previous_values: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    updated_values: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    admin: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[admin_id],
    )
    employee: Mapped[Optional["Employee"]] = relationship(
        "Employee",
        foreign_keys=[employee_id],
    )
    attendance_record: Mapped[Optional["AttendanceRecord"]] = relationship(
        "AttendanceRecord",
        foreign_keys=[attendance_record_id],
    )
