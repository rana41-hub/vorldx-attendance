import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_v1_router
from app.config import settings
from app.database import engine

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("vorldx.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up %s in %s mode", settings.APP_NAME, settings.ENVIRONMENT)
    logger.info("Configured database: %s", settings.masked_database_url)
    yield
    logger.info("Shutting down %s", settings.APP_NAME)
    engine.dispose()


app = FastAPI(
    title="VorldX Employee Attendance System",
    description="Backend API for employee attendance management, QR check-in, and leave management.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
cors_config = {
    "allow_origins": settings.allowed_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

# In local development mode, permit private LAN origins (192.168.x.x, 10.x.x.x, 172.16-31.x.x, localhost)
if settings.ENVIRONMENT == "development":
    cors_config["allow_origin_regex"] = (
        r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$"
    )

app.add_middleware(CORSMiddleware, **cors_config)

# Include API v1 routes
app.include_router(api_v1_router)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "VorldX Attendance API is running",
        "status": "success",
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "vorldx-attendance-api",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health/database", tags=["Health"])
def database_health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
        }
    except Exception as exc:
        logger.error("Database health check error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        )