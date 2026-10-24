import os
from datetime import time
from urllib.parse import urlparse
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.core.security import hash_password
import app.database
from app.database import Base, get_db
from app.main import app
from app.models.attendance_policy import AttendancePolicy
from app.models.employee import Employee
from app.models.enums import UserRole
from app.models.user import User


def _verify_and_configure_test_database():
    """
    Enforces strict test database isolation.
    Guarantees tests NEVER run against the development database.
    """
    raw_env = os.environ.get("TEST_DATABASE_URL")
    test_db_url = raw_env if raw_env is not None else settings.TEST_DATABASE_URL
    if not test_db_url or not test_db_url.strip():
        raise pytest.UsageError(
            "SAFETY VIOLATION: TEST_DATABASE_URL is not configured.\n"
            "Automated tests are blocked from running to prevent modifying the development database.\n"
            "Please configure TEST_DATABASE_URL pointing to an isolated test database (e.g. vorldx_test)."
        )

    # 1. Verify URL separation
    dev_db_name = urlparse(settings.DATABASE_URL).path.strip("/").lower()
    test_db_name = urlparse(test_db_url).path.strip("/").lower()

    if not test_db_name:
        raise pytest.UsageError(
            "SAFETY VIOLATION: Invalid TEST_DATABASE_URL. No database name specified."
        )

    if dev_db_name == test_db_name or settings.DATABASE_URL.strip() == test_db_url.strip():
        raise pytest.UsageError(
            f"SAFETY VIOLATION: TEST_DATABASE_URL points to the development database ('{dev_db_name}').\n"
            "Tests are strictly aborted to prevent data corruption or test pollution."
        )

    # 2. Connect and verify connected database name on PostgreSQL
    try:
        test_engine = create_engine(
            test_db_url,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
        with test_engine.connect() as conn:
            actual_connected_db = conn.execute(text("SELECT current_database();")).scalar()
            if not actual_connected_db or actual_connected_db.lower() == dev_db_name:
                raise pytest.UsageError(
                    f"CRITICAL SAFETY ERROR: Active connection for TEST_DATABASE_URL is connected to development database '{actual_connected_db}'! Aborting immediately."
                )
            if actual_connected_db.lower() != test_db_name:
                raise pytest.UsageError(
                    f"CRITICAL SAFETY ERROR: Connected database '{actual_connected_db}' does not match expected test database '{test_db_name}'. Aborting."
                )
    except Exception as exc:
        if isinstance(exc, pytest.UsageError):
            raise
        raise pytest.UsageError(
            f"SAFETY VIOLATION: Failed to connect to TEST_DATABASE_URL ('{test_db_name}'): {exc}"
        ) from exc

    # 3. Re-bind global engine and SessionLocal in app.database
    import app.database as app_db

    app_db.engine = test_engine
    test_sessionmaker = sessionmaker(
        bind=test_engine,
        autoflush=False,
        expire_on_commit=False,
    )
    app_db.SessionLocal = test_sessionmaker

    # 4. Dependency override for FastAPI routes
    def override_get_db():
        db = test_sessionmaker()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    # 5. Schema creation in test database
    Base.metadata.create_all(bind=test_engine)

    # 6. Seed required reference data in test database if not present
    with test_sessionmaker() as db:
        # Seed default admin (required by authentication and admin test suites)
        admin = db.scalar(select(User).where(User.admin_id == "ADM-001"))
        if not admin:
            admin = User(
                admin_id="ADM-001",
                email="admin@vorldx.com",
                password_hash=hash_password("Admin@VorldX2026"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin)

        # Seed sample employee (required by employee retrieval suites)
        sample_emp = db.scalar(select(Employee).where(Employee.employee_code == "VX-0101"))
        if not sample_emp:
            sample_emp = Employee(
                employee_code="VX-0101",
                first_name="Alex",
                last_name="Vance",
                department="Engineering",
                designation="Lead Systems Architect",
                phone="+1-555-0101",
            )
            db.add(sample_emp)
            db.flush()
            emp_user = User(
                email="alex.vance@vorldx.com",
                password_hash=hash_password("Employee@VorldX2026"),
                role=UserRole.EMPLOYEE,
                is_active=True,
            )
            db.add(emp_user)
            db.flush()
            sample_emp.user_id = emp_user.id

        # Seed standard policy (required by policy evaluation suites)
        policy = db.scalar(select(AttendancePolicy).where(AttendancePolicy.is_active.is_(True)))
        if not policy:
            policy = AttendancePolicy(
                policy_name="Standard Organization Policy",
                work_start_time=time(9, 0),
                work_end_time=time(17, 0),
                late_grace_minutes=15,
                early_departure_grace_minutes=15,
                half_day_hours_threshold=4.0,
                full_day_hours_threshold=8.0,
                auto_detect_late_arrival=False,
                auto_detect_early_departure=False,
                is_active=True,
            )
            db.add(policy)

        # Seed historical late attendance fixtures (required by test_day11_reporting_validation)
        from datetime import date as d_date, datetime as d_datetime, timezone as d_timezone
        from app.models.attendance import AttendanceRecord
        from app.models.enums import AttendanceStatus

        aug_count = len(
            db.scalars(
                select(AttendanceRecord).where(
                    AttendanceRecord.attendance_date == d_date(2026, 8, 10),
                    AttendanceRecord.status == AttendanceStatus.LATE,
                )
            ).all()
        )
        if aug_count < 6:
            for i in range(aug_count, 6):
                hist_code = f"VX-HIST-LATE-{i+1:02d}"
                h_emp = db.scalar(select(Employee).where(Employee.employee_code == hist_code))
                if not h_emp:
                    h_emp = Employee(
                        employee_code=hist_code,
                        first_name="Historical",
                        last_name=f"Late{i+1}",
                        department="Operations",
                        designation="Staff",
                        phone=f"+1-555-80{i+1:02d}",
                    )
                    db.add(h_emp)
                    db.flush()
                r = AttendanceRecord(
                    employee_id=h_emp.id,
                    attendance_date=d_date(2026, 8, 10),
                    check_in=d_datetime(2026, 8, 10, 4, 15, tzinfo=d_timezone.utc),  # 09:45 AM IST (30 mins late)
                    check_out=d_datetime(2026, 8, 10, 12, 0, tzinfo=d_timezone.utc),
                    status=AttendanceStatus.LATE,
                )
                db.add(r)

        db.commit()

    return test_engine, test_sessionmaker


# Run verification on session start
def pytest_sessionstart(session):
    _verify_and_configure_test_database()


@pytest.fixture(scope="session")
def client():
    # Double check database binding before yielding client
    _verify_and_configure_test_database()
    with TestClient(app) as test_client:
        yield test_client
