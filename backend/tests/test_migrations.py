"""Migrations must describe the same schema the models do.

The app can create its tables directly (AUTO_CREATE_TABLES), which makes it
easy to add a column to a model and forget the migration — everything keeps
working locally and breaks on the next real deployment. This test runs the
migrations into an empty database and diffs the result against the models.
"""

import sys
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.command import upgrade
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text

from app import models
from app.database import Base

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from scripts.migrate import detect_existing_revision  # noqa: E402

# Differences that are noise rather than drift: SQLite reports server defaults
# and some type details differently from the model definitions.
IGNORED_DIFF_TYPES = {"modify_default", "modify_nullable", "modify_type"}


def _alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def test_migrations_produce_the_model_schema(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'migrated.db'}"

    upgrade(_alembic_config(database_url), "head")

    engine = create_engine(database_url)
    try:
        with engine.connect() as connection:
            context = MigrationContext.configure(connection)
            differences = [
                difference
                for difference in compare_metadata(context, Base.metadata)
                if _significant(difference)
            ]
    finally:
        engine.dispose()

    assert differences == [], (
        "models and migrations have drifted — add a migration for these:\n"
        + "\n".join(str(difference) for difference in differences)
    )


def _significant(difference) -> bool:
    # compare_metadata yields tuples like ("add_column", schema, table, column)
    # or lists of them for modifications.
    kind = difference[0] if isinstance(difference, tuple) else difference[0][0]
    return kind not in IGNORED_DIFF_TYPES


def test_migrations_are_reversible(tmp_path):
    """Every migration can be rolled back, so a bad deploy isn't a one-way door."""
    database_url = f"sqlite:///{tmp_path / 'reversible.db'}"
    config = _alembic_config(database_url)

    upgrade(config, "head")

    from alembic.command import downgrade

    try:
        downgrade(config, "base")
    except Exception as exc:  # pragma: no cover - failure detail is the point
        pytest.fail(f"downgrade to base failed: {exc}")

    engine = create_engine(database_url)
    try:
        with engine.connect() as connection:
            remaining = MigrationContext.configure(connection).get_current_revision()
    finally:
        engine.dispose()

    assert remaining is None


# ---------- adopting a database that predates Alembic ----------
#
# Before migrations existed the app built its schema with
# `Base.metadata.create_all`. That call creates missing *tables* but never
# alters an existing one, so upgrading such a database to Milestone 3 left
# audit_log without its new columns and every query touching entity_key
# returned a 500. These tests cover both shapes that can produce.


def _seed_row(engine):
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO flags (key, type, default_value, enabled, description, owner_team)"
                " VALUES ('legacy-flag', 'boolean', 'false', 1, 'kept', 'platform')"
            )
        )


def _legacy_database(tmp_path, name: str):
    """A pre-Milestone-3 database with data and no Alembic history."""
    url = f"sqlite:///{tmp_path / name}"
    command.upgrade(_alembic_config(url), "0001")

    engine = create_engine(url)
    _seed_row(engine)
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE alembic_version"))
    return url, engine


def _run_migrate(url):
    """What scripts/migrate.py does, without the process wrapper."""
    engine = create_engine(url)
    try:
        existing = detect_existing_revision(engine)
    finally:
        engine.dispose()

    config = _alembic_config(url)
    if existing is not None:
        command.stamp(config, existing)
    command.upgrade(config, "head")
    return existing


def test_adopts_a_legacy_create_all_database(tmp_path):
    url, engine = _legacy_database(tmp_path, "legacy.db")

    assert "entity_key" not in {c["name"] for c in inspect(engine).get_columns("audit_log")}
    engine.dispose()

    assert _run_migrate(url) == "0001"

    engine = create_engine(url)
    try:
        inspector = inspect(engine)
        assert "entity_key" in {c["name"] for c in inspector.get_columns("audit_log")}
        assert "flag_evaluation_stats" in inspector.get_table_names()
        assert "flag_cleanup_reviews" in inspector.get_table_names()

        with engine.connect() as connection:
            kept = connection.execute(text("SELECT key FROM flags")).scalars().all()
        assert kept == ["legacy-flag"], "existing data must survive the upgrade"
    finally:
        engine.dispose()


def test_adopts_a_hybrid_database(tmp_path):
    """The realistic broken case: create_all added the new tables but couldn't
    add the new columns, so the schema is half-upgraded."""
    url, engine = _legacy_database(tmp_path, "hybrid.db")

    # Exactly what create_all does on a database already holding audit_log.
    Base.metadata.create_all(
        bind=engine,
        tables=[
            models.FlagEvaluationStat.__table__,
            models.FlagCleanupReview.__table__,
        ],
    )
    inspector = inspect(engine)
    assert "flag_evaluation_stats" in inspector.get_table_names()
    assert "entity_key" not in {c["name"] for c in inspector.get_columns("audit_log")}
    engine.dispose()

    # Must not blow up with "relation already exists".
    assert _run_migrate(url) == "0001"

    engine = create_engine(url)
    try:
        assert "entity_key" in {c["name"] for c in inspect(engine).get_columns("audit_log")}
        with engine.connect() as connection:
            assert connection.execute(text("SELECT key FROM flags")).scalars().all() == [
                "legacy-flag"
            ]
    finally:
        engine.dispose()


def test_current_create_all_database_is_stamped_not_migrated(tmp_path):
    """A database create_all built from today's models is already at head."""
    url = f"sqlite:///{tmp_path / 'current.db'}"
    engine = create_engine(url)
    Base.metadata.create_all(bind=engine)

    try:
        assert detect_existing_revision(engine) == "head"
    finally:
        engine.dispose()

    _run_migrate(url)  # must be a no-op rather than an error

    engine = create_engine(url)
    try:
        with engine.connect() as connection:
            revision = MigrationContext.configure(connection).get_current_revision()
        assert revision == "0002"
    finally:
        engine.dispose()


def test_migration_is_idempotent(tmp_path):
    """Running the migrate step twice is safe — containers restart."""
    url, engine = _legacy_database(tmp_path, "twice.db")
    engine.dispose()

    _run_migrate(url)
    assert _run_migrate(url) is None, "an Alembic-managed database needs no stamping"

    engine = create_engine(url)
    try:
        assert "entity_key" in {c["name"] for c in inspect(engine).get_columns("audit_log")}
    finally:
        engine.dispose()


def test_fresh_database_needs_no_stamping(tmp_path):
    url = f"sqlite:///{tmp_path / 'fresh.db'}"
    engine = create_engine(url)
    try:
        assert detect_existing_revision(engine) is None
    finally:
        engine.dispose()

    _run_migrate(url)

    engine = create_engine(url)
    try:
        assert "flag_cleanup_reviews" in inspect(engine).get_table_names()
    finally:
        engine.dispose()
