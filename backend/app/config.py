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

    # --- Authentication ---
    # Tokens are signed with this. It MUST be set to a real secret in
    # production: everything below falls apart if it's guessable, and the
    # startup check in main.py warns loudly when the development default is
    # still in use.
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-only-insecure-change-me")
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = int(os.getenv("ACCESS_TOKEN_MINUTES", "720"))  # 12 hours

    # The first admin, created on startup when no users exist yet. Without
    # this there is no way to log in to a fresh installation.
    bootstrap_admin_email: str = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "admin@flagforge.local")
    bootstrap_admin_password: str = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "admin12345")
    bootstrap_admin_name: str = os.getenv("BOOTSTRAP_ADMIN_NAME", "Admin")

    @property
    def using_default_jwt_secret(self) -> bool:
        return self.jwt_secret == "dev-only-insecure-change-me"

    @property
    def using_default_admin_password(self) -> bool:
        return self.bootstrap_admin_password == "admin12345"


@lru_cache
def get_settings() -> Settings:
    return Settings()
