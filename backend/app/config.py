import os
from functools import lru_cache


class Settings:
    """Application settings, read from environment variables.

    Works locally (docker-compose sets these) and on hosted platforms
    like Render/Railway, which inject DATABASE_URL / REDIS_URL directly.
    """

    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://flagforge:flagforge@localhost:5432/flagforge",
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    cors_origins: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")
    environment: str = os.getenv("APP_ENV", "development")
    # True: create tables on startup (handy locally). False: rely on
    # `alembic upgrade head`, which is what a real deployment should do.
    auto_create_tables: bool = os.getenv("AUTO_CREATE_TABLES", "true").lower() not in {
        "false",
        "0",
        "no",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
