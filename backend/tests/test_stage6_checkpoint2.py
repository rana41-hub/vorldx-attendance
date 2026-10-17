"""Targeted automated tests for Stage 6 Checkpoint 2 remediation:
- Timezone naive & aware compatibility
- Organization timezone conversion
- Mixed naive/aware duration calculation
- Dynamic private LAN CORS resolution in development mode
"""
from datetime import date, datetime, time, timezone
from app.config import settings
from app.models.attendance_policy import AttendancePolicy
from app.models.enums import AttendanceStatus
from app.services.policy_service import (
    calculate_check_out_status,
    ensure_timezone_aware,
    to_organization_time,
)


def test_timezone_naive_and_aware_handling():
    # Naive datetime is safely normalized to UTC aware
    naive = datetime(2026, 10, 16, 9, 30, 0)
    aware = ensure_timezone_aware(naive)
    assert aware.tzinfo is not None
    assert aware.tzinfo == timezone.utc

    # Timezone-aware remains unchanged
    already_aware = datetime(2026, 10, 16, 9, 30, 0, tzinfo=timezone.utc)
    normalized = ensure_timezone_aware(already_aware)
    assert normalized == already_aware

    # Conversion to organization timezone produces a valid aware timestamp
    org_dt = to_organization_time(naive)
    assert org_dt.tzinfo is not None


def test_calculate_checkout_status_with_mixed_naive_and_aware():
    # Mixed naive check-in and aware check-out must not raise TypeError
    policy = AttendancePolicy(
        auto_detect_early_departure=True,
        work_end_time=time(18, 30),
        early_departure_grace_minutes=15,
        half_day_hours_threshold=4.0,
    )
    naive_in = datetime(2026, 10, 16, 9, 30, 0)
    aware_out = datetime(2026, 10, 16, 18, 30, 0, tzinfo=timezone.utc)

    status, hours, is_early = calculate_check_out_status(
        naive_in, aware_out, AttendanceStatus.PRESENT, policy
    )
    assert status == AttendanceStatus.PRESENT
    assert hours == 9.0
    assert is_early is False


def test_cors_dev_lan_origin_allowed(client):
    # In development mode, private LAN origins are accepted via allow_origin_regex
    if settings.ENVIRONMENT == "development":
        test_origins = [
            "http://172.20.10.2:5173",
            "http://192.168.1.100:5173",
            "http://localhost:5173",
        ]
        for origin in test_origins:
            res = client.options(
                "/api/v1/auth/status",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                },
            )
            assert res.status_code == 200
            assert res.headers.get("access-control-allow-origin") == origin
