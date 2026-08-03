from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.database import Base, engine
from app.redis_client import ping_redis
from app.routers import environments, evaluation, flags

settings = get_settings()

app = FastAPI(
    title="FlagForge API",
    description="Feature flag management platform - Milestone 1",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # Milestone 1 uses create_all for simplicity. A real Milestone 2+
    # would switch to Alembic migrations for schema changes.
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health_check():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "unavailable"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "redis": "connected" if ping_redis() else "unavailable",
    }


app.include_router(environments.router)
app.include_router(flags.router)
app.include_router(evaluation.router)
