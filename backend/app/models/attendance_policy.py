from datetime import datetime, time
from typing import Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Time,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AttendancePolicy(Base):
    __tablename__ = "attendance_policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    policy_name: Mapped[str] = mapped_column(
        String(100), nullable=False, default="Standard Organization Policy"
    )
    work_start_time: Mapped[time] = mapped_column(
        Time, nullable=False, default=time(9, 30)
    )
    work_end_time: Mapped[time] = mapped_column(
        Time, nullable=False, default=time(18, 30)
    )
    late_grace_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=15
    )
    early_departure_grace_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=15
    )
    half_day_hours_threshold: Mapped[float] = mapped_column(
        Float, nullable=False, default=4.0
    )
    full_day_hours_threshold: Mapped[float] = mapped_column(
        Float, nullable=False, default=8.0
    )
    auto_detect_late_arrival: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    auto_detect_early_departure: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    updated_by: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    updater: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="updated_policies",
        foreign_keys=[updated_by],
    )
