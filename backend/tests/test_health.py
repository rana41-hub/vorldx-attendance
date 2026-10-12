from app.config import settings


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "VorldX Attendance API" in data["message"]


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "vorldx-attendance-api"
    assert data["environment"] == settings.ENVIRONMENT


def test_database_health_endpoint(client):
    response = client.get("/health/database")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"


def test_settings_security_masking():
    assert "******" in settings.masked_database_url
    assert isinstance(settings.allowed_origins, list)
    assert len(settings.allowed_origins) > 0
