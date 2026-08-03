#!/usr/bin/env python
"""Bring the database up to date, then get out of the way.

Run before the API starts (the container entrypoint does this). It handles the
awkward case of a database that already has tables but has never seen Alembic —
which is what every database created by the old `create_all` startup path looks
like.

    cd backend
    python -m scripts.migrate

Three situations, all handled:

1. Empty database        -> run every migration.
2. Alembic-managed       -> run whatever is outstanding.
3. Tables but no Alembic -> work out which schema it has, stamp that revision,
                            then upgrade. Existing data is preserved; the
                            alternative is a confusing "table already exists"
                            crash or, worse, a half-migrated schema that 500s
                            on the first query touching a new column.
"""

import logging
import sys
import time
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import create_engine, inspect  # noqa: E402
from sqlalchemy.exc import OperationalError  # noqa: E402

from app.config import get_settings  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s [migrate] %(message)s")
logger = logging.getLogger("migrate")

# Marker -> the revision a database showing that marker has already reached.
# Checked newest first, so a database is stamped at the latest revision it
# genuinely matches and everything after it still gets applied.
#
# Getting this wrong is silent and nasty: stamp too high and the migrations
# that would have created the missing tables are skipped.
LEGACY_REVISION = "0001"


def alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def wait_for_database(engine, attempts: int = 30, delay: float = 2.0) -> None:
    """Postgres in a container accepts TCP before it accepts queries."""
    for attempt in range(1, attempts + 1):
        try:
            with engine.connect():
                return
        except OperationalError as exc:
            if attempt == attempts:
                raise
            logger.info("database not ready (%s/%s): %s", attempt, attempts, exc.orig)
            time.sleep(delay)


def detect_existing_revision(engine) -> str | None:
    """Which migration an un-stamped database already matches, if any.

    Returns None for an empty database (nothing to stamp) or one Alembic
    already manages.
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "alembic_version" in tables:
        return None
    if "flags" not in tables:
        return None

    audit_columns = {column["name"] for column in inspector.get_columns("audit_log")}
    has_milestone_3 = "entity_key" in audit_columns and "flag_evaluation_stats" in tables
    has_auth = "users" in tables

    if has_milestone_3 and has_auth:
        # Nothing left to apply — a create_all database built from today's models.
        return "head"
    if has_milestone_3:
        # Milestone 3 tables but no users table: stamp at 0002 so the auth
        # migration still runs. Stamping "head" here would skip it and leave
        # an installation nobody can sign in to.
        return "0002"
    return LEGACY_REVISION


def main() -> int:
    database_url = get_settings().database_url
    # Never log credentials.
    logger.info("target: %s", database_url.rsplit("@", 1)[-1])

    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        wait_for_database(engine)
        existing = detect_existing_revision(engine)
    finally:
        engine.dispose()

    config = alembic_config(database_url)

    if existing is not None:
        logger.info(
            "database has tables but no Alembic history; stamping %s before upgrading", existing
        )
        command.stamp(config, existing)

    command.upgrade(config, "head")
    logger.info("schema is up to date")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
