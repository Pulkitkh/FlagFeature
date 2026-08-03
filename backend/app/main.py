import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app import crud
from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.redis_client import ping_redis
from app.routers import (
    analytics,
    audit,
    auth,
    cleanup,
    environments,
    evaluation,
    flags,
    overview,
    snapshot,
)

settings = get_settings()
logger = logging.getLogger("flagforge")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Convenience for local development: one command and the app runs. Set
    # AUTO_CREATE_TABLES=false in production and run `alembic upgrade head`
    # instead, so schema changes are versioned rather than inferred.
    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)

    _bootstrap_first_admin()
    _warn_about_insecure_defaults()
    yield


def _bootstrap_first_admin() -> None:
    """Create the first admin so a fresh installation can be signed into.

    Only runs when the users table is empty. Failures are logged rather than
    raised — a database that isn't ready yet shouldn't stop the app from
    starting and reporting that on /health.
    """
    db = SessionLocal()
    try:
        created = crud.ensure_bootstrap_admin(db)
        if created is not None:
            logger.warning(
                "Created the first admin account: %s. Sign in and change this password.",
                created.email,
            )
    except Exception:
        logger.exception("Could not create the bootstrap admin account")
    finally:
        db.close()


def _warn_about_insecure_defaults() -> None:
    if settings.using_default_jwt_secret:
        logger.warning(
            "JWT_SECRET is the built-in development value. Anyone who knows it can mint "
            "valid tokens — set a real secret before exposing this to anyone."
        )
    if settings.using_default_admin_password:
        logger.warning(
            "BOOTSTRAP_ADMIN_PASSWORD is the documented default. Change the admin "
            "password after signing in, or set the variable before first start."
        )


app = FastAPI(
    title="FlagForge API",
    description=(
        "Feature flag management platform: flag CRUD, per-environment overrides, "
        "user/group/percentage targeting, a cached evaluation endpoint, audit "
        "logging with diffs, evaluation analytics, and cleanup suggestions.\n\n"
        "Admin endpoints require a bearer token from `POST /auth/login`. "
        "`/evaluate` and `/snapshot` are deliberately public so the middleware "
        "SDK and consuming applications work without credentials."
    ),
    version="1.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
def health_check():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "unavailable"

    redis_status = "connected" if ping_redis() else "unavailable"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "redis": redis_status,
    }


app.include_router(auth.router)
app.include_router(environments.router)
app.include_router(flags.router)
app.include_router(evaluation.router)
app.include_router(overview.router)
app.include_router(audit.router)
app.include_router(analytics.router)
app.include_router(cleanup.router)
app.include_router(snapshot.router)
