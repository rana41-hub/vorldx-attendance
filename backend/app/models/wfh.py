from datetime import date, datetime
from typing import Optional
from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import WFHStatus


class WFHRequest(Base):
    __tablename__ = "wfh_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[WFHStatus] = mapped_column(
        Enum(WFHStatus, name="wfh_status_enum", native_enum=False),
        nullable=False,
        default=WFHStatus.PENDING,
        index=True,
    )
    reviewed_by: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    employee: Mapped["Employee"] = relationship(
        "Employee",
        back_populates="wfh_requests",
    )
    reviewer: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="reviewed_wfh_requests",
        foreign_keys=[reviewed_by],
    )
