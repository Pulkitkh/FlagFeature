"""Migrations must describe the same schema the models do.

The app can create its tables directly (AUTO_CREATE_TABLES), which makes it
easy to add a column to a model and forget the migration — everything keeps
working locally and breaks on the next real deployment. This test runs the
migrations into an empty database and diffs the result against the models.
"""

from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.command import upgrade
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine

from app.database import Base

BACKEND_ROOT = Path(__file__).resolve().parents[1]

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
