#!/usr/bin/env python
"""Move Redis evaluation counters into Postgres.

Intended to run once a day (cron, a Kubernetes CronJob, Render's scheduled
jobs — anything). Redis absorbs the per-evaluation writes; this makes them
durable.

    cd backend
    python -m scripts.flush_analytics

Safe to run more often than daily: counters are cleared as they're flushed, and
counts are added to any existing row for the same hour, so nothing is
double-counted or lost.
"""

import argparse
import logging
import sys
from pathlib import Path

# Allows `python scripts/flush_analytics.py` as well as `python -m scripts...`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import analytics  # noqa: E402
from app.database import SessionLocal  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("flush_analytics")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--keep-counters",
        action="store_true",
        help="Write the rows but leave the Redis counters in place (for a dry run).",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        pending = analytics.read_live_counters()
        if not pending:
            logger.info("No counters to flush.")
            return 0

        written = analytics.flush_to_database(db, delete_after=not args.keep_counters)
        total = sum(pending.values())
        logger.info(
            "Flushed %s evaluation(s) across %s flag/environment/hour bucket(s).", total, written
        )
        return 0
    except Exception:
        logger.exception("Flush failed; counters were left in Redis for the next run.")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
