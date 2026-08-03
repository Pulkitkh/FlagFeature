import fnmatch
import os

# The app builds its engine at import time, so the test database has to be
# chosen before anything under `app.` is imported.
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app import models, redis_client  # noqa: E402,F401  (models registers tables on Base)
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


class FakeRedis:
    """In-memory stand-in for Redis.

    Caching behaviour is part of what these tests verify, so it needs to be
    exercised rather than swallowed by the "Redis unavailable" fallback — but
    without requiring a live server in CI.
    """

    def __init__(self):
        self.store: dict[str, str] = {}

    def ping(self):
        return True

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, ex=None):
        self.store[key] = value

    def incr(self, key, amount=1):
        self.store[key] = str(int(self.store.get(key, 0)) + amount)
        return int(self.store[key])

    def expire(self, key, seconds):
        # TTLs are irrelevant within a test; accepted so callers behave normally.
        return True

    def delete(self, key):
        self.store.pop(key, None)

    def scan_iter(self, match="*"):
        return [key for key in list(self.store) if fnmatch.fnmatch(key, match)]


@pytest.fixture(autouse=True)
def fake_redis(monkeypatch):
    """Give every test its own empty cache so results never leak between tests."""
    fake = FakeRedis()
    monkeypatch.setattr(redis_client, "redis_client", fake)
    return fake


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def client(db_session):
    """TestClient wired to the same in-memory database as `db_session`."""
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
