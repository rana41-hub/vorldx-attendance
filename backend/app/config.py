from pathlib import Path
from urllib.parse import urlparse
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    APP_NAME: str = Field(default="VorldX Attendance API")
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=False)

    DATABASE_URL: str

    # CORS configuration
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173"
    )

    # Timezone configuration (default UTC, configurable for organization local timezone)
    ORGANIZATION_TIMEZONE: str = Field(default="UTC")

    # JWT Authentication configuration
    JWT_SECRET_KEY: str = Field(
        default="change-this-in-production-use-a-strong-secret-key"
    )
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)

    @property
    def allowed_origins(self) -> list[str]:
        if not self.CORS_ORIGINS:
            return ["http://localhost:5173", "http://127.0.0.1:5173"]
        return [
            origin.strip()
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]

    @property
    def masked_database_url(self) -> str:
        """Returns the database URL with the password masked for safe logging."""
        try:
            parsed = urlparse(self.DATABASE_URL)
            if parsed.password:
                netloc = parsed.netloc.replace(f":{parsed.password}@", ":******@")
                return parsed._replace(netloc=netloc).geturl()
            return self.DATABASE_URL
        except Exception:
            return "postgresql://***:***@***/***"

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()