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
import sqlalchemy as sa
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


def _head_revision() -> str:
    from alembic.script import ScriptDirectory

    return ScriptDirectory.from_config(_alembic_config("sqlite://")).get_current_head()


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
        assert revision == _head_revision()
    finally:
        engine.dispose()


def test_milestone_3_database_without_users_still_gets_the_auth_migration(tmp_path):
    """A create_all database from before auth has the Milestone 3 tables but no
    users table. Stamping it at head would skip the auth migration and leave an
    installation nobody can sign in to."""
    url, engine = _legacy_database(tmp_path, "pre-auth.db")

    # Everything Milestone 3 added, but no users table.
    Base.metadata.create_all(
        bind=engine,
        tables=[models.FlagEvaluationStat.__table__, models.FlagCleanupReview.__table__],
    )
    with engine.begin() as connection:
        for column in ("entity_key VARCHAR(100)", "before_state JSON", "after_state JSON", "diff JSON"):
            connection.execute(text(f"ALTER TABLE audit_log ADD COLUMN {column}"))

    inspector = inspect(engine)
    assert "users" not in inspector.get_table_names()
    assert detect_existing_revision(engine) == "0002", "must not be stamped at head"
    engine.dispose()

    _run_migrate(url)

    engine = create_engine(url)
    try:
        assert "users" in inspect(engine).get_table_names(), "auth migration was skipped"
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


def test_postgres_role_column_does_not_recreate_the_enum():
    """The actual fix, guarded directly.

    On Postgres, migration 0003 creates the `userrole` type itself and must then
    hand `create_table` a column with `create_type=False`. Without that flag
    SQLAlchemy emits a second CREATE TYPE with checkfirst=False and the
    migration dies with "type userrole already exists" — which is exactly what
    happened in a real deployment. SQLite has no named types, so only this
    check catches a regression.
    """
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "migration_0003",
        BACKEND_ROOT / "alembic" / "versions" / "0003_users_and_authentication.py",
    )
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    class _FakeDialect:
        name = "postgresql"
        # Attributes SQLAlchemy's ENUM.create() consults on the way through.
        supports_native_enum = True
        identifier_preparer = None

    class _FakeBind:
        """Records the explicit enum creation without touching a database."""

        dialect = _FakeDialect()
        ddl_runs = 0

        def _run_ddl_visitor(self, *args, **kwargs):
            _FakeBind.ddl_runs += 1

    column_type = migration._role_column_type(_FakeBind())

    assert _FakeBind.ddl_runs == 1, "the enum should be created explicitly, once"
    assert column_type.create_type is False, (
        "create_table would emit a second CREATE TYPE and the migration would fail"
    )

    # And the non-Postgres path stays a plain Enum, since SQLite needs no type.
    class _SqliteDialect:
        name = "sqlite"

    class _SqliteBind:
        dialect = _SqliteDialect()

    assert isinstance(migration._role_column_type(_SqliteBind()), sa.Enum)


def test_role_enum_is_created_exactly_once(tmp_path, monkeypatch):
    """Regression: 0003 used to create the Postgres enum, then let create_table
    create it again, failing with 'type userrole already exists'.

    SQLite has no named types so the original bug can't reproduce there. What
    can be checked without Postgres is that the migration never emits two
    CREATE TYPE statements for the same enum — which is what the fix guarantees.
    """
    from alembic.migration import MigrationContext as _MigrationContext

    url = f"sqlite:///{tmp_path / 'enum.db'}"
    statements: list[str] = []

    real_execute = _MigrationContext.execute

    def recording_execute(self, sql, *args, **kwargs):
        statements.append(str(sql))
        return real_execute(self, sql, *args, **kwargs)

    monkeypatch.setattr(_MigrationContext, "execute", recording_execute)
    command.upgrade(_alembic_config(url), "head")

    create_type_statements = [s for s in statements if "CREATE TYPE" in s.upper()]
    assert len(create_type_statements) <= 1, (
        "the role enum must not be created twice:\n" + "\n".join(create_type_statements)
    )

    engine = create_engine(url)
    try:
        assert "users" in inspect(engine).get_table_names()
    finally:
        engine.dispose()
