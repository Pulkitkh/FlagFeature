from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.database import Base, engine
from app.redis_client import ping_redis
from app.routers import environments, evaluation, flags, overview

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # create_all keeps local setup to a single command. A production deployment
    # would run Alembic migrations instead.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="FlagForge API",
    description=(
        "Feature flag management platform: flag CRUD, per-environment overrides, "
        "user/group/percentage targeting, and a cached evaluation endpoint."
    ),
    version="1.0.0",
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


app.include_router(environments.router)
app.include_router(flags.router)
app.include_router(evaluation.router)
app.include_router(overview.router)
