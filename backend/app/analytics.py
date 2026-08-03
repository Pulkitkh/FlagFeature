"""Evaluation analytics.

Every evaluation bumps a Redis counter keyed by flag + environment + hour.
Redis absorbs the write volume (one INCR, no database round-trip on the hot
path); `scripts/flush_analytics.py` moves those counters into
`flag_evaluation_stats` for durable history.

Reads merge both sources, so the chart includes the current hour that hasn't
been flushed yet.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app import models, redis_client as redis_module

COUNTER_PREFIX = "flagforge:evalcount"
# Counters outlive a daily flush by a wide margin, so a missed run doesn't lose data.
COUNTER_TTL_SECONDS = 60 * 60 * 24 * 8


def hour_bucket(moment: datetime | None = None) -> datetime:
    moment = moment or datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)


def counter_key(flag_key: str, environment_key: str, bucket: datetime) -> str:
    return f"{COUNTER_PREFIX}:{flag_key}:{environment_key}:{bucket.strftime('%Y-%m-%dT%H')}"


def record_evaluation(
    flag_key: str, environment_key: str, moment: datetime | None = None
) -> None:
    """Count one evaluation. Never raises — analytics must not break evaluation."""
    key = counter_key(flag_key, environment_key, hour_bucket(moment))
    try:
        # INCR returns the new value, so the TTL only needs setting the first
        # time a bucket is touched. Every later evaluation in that hour costs a
        # single round trip instead of two.
        if redis_module.redis_client.incr(key) == 1:
            redis_module.redis_client.expire(key, COUNTER_TTL_SECONDS)
    except Exception:
        return


def read_live_counters() -> dict[tuple[str, str, datetime], int]:
    """Every un-flushed Redis counter, keyed by (flag, environment, hour)."""
    counters: dict[tuple[str, str, datetime], int] = {}
    try:
        keys = list(redis_module.redis_client.scan_iter(match=f"{COUNTER_PREFIX}:*"))
    except Exception:
        return counters

    for key in keys:
        parsed = _parse_counter_key(key)
        if parsed is None:
            continue
        try:
            raw = redis_module.redis_client.get(key)
        except Exception:
            continue
        if raw is None:
            continue
        try:
            counters[parsed] = int(raw)
        except (TypeError, ValueError):
            continue

    return counters


def _parse_counter_key(key: str) -> tuple[str, str, datetime] | None:
    # flagforge:evalcount:<flag>:<env>:<YYYY-MM-DDTHH>
    parts = key.split(":")
    if len(parts) < 5:
        return None
    bucket_text = parts[-1]
    environment_key = parts[-2]
    flag_key = ":".join(parts[2:-2])
    try:
        bucket = datetime.strptime(bucket_text, "%Y-%m-%dT%H").replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    return flag_key, environment_key, bucket


def flush_to_database(db: Session, delete_after: bool = True) -> int:
    """Move Redis counters into flag_evaluation_stats. Returns rows written.

    Counts are added to any existing row for the same hour, so re-running the
    flush mid-hour tops up rather than overwriting — and clearing the counter
    afterwards keeps that from double-counting.
    """
    counters = read_live_counters()
    written = 0

    for (flag_key, environment_key, bucket), count in counters.items():
        if count <= 0:
            continue

        stat = (
            db.query(models.FlagEvaluationStat)
            .filter(
                models.FlagEvaluationStat.flag_key == flag_key,
                models.FlagEvaluationStat.environment_key == environment_key,
                models.FlagEvaluationStat.bucket_hour == _storage_bucket(db, bucket),
            )
            .first()
        )

        if stat is None:
            stat = models.FlagEvaluationStat(
                flag_key=flag_key,
                environment_key=environment_key,
                bucket_hour=_storage_bucket(db, bucket),
                count=count,
            )
            db.add(stat)
        else:
            stat.count += count

        written += 1

        if delete_after:
            try:
                redis_module.redis_client.delete(counter_key(flag_key, environment_key, bucket))
            except Exception:
                pass

    db.commit()
    return written


def daily_series(
    db: Session,
    flag_key: str,
    days: int = 7,
    environment_key: str | None = None,
) -> list[dict]:
    """Evaluations per day for a flag, oldest first, with empty days filled in.

    Merges flushed rows with the live Redis counters so today's bar isn't
    stuck at zero until the nightly flush runs.
    """
    today = datetime.now(timezone.utc).date()
    window_start = today - timedelta(days=days - 1)

    totals: dict[str, int] = {
        (window_start + timedelta(days=offset)).isoformat(): 0 for offset in range(days)
    }

    query = db.query(models.FlagEvaluationStat).filter(
        models.FlagEvaluationStat.flag_key == flag_key
    )
    if environment_key:
        query = query.filter(models.FlagEvaluationStat.environment_key == environment_key)

    for stat in query.all():
        day = stat.bucket_hour.date().isoformat()
        if day in totals:
            totals[day] += stat.count

    for (counter_flag, counter_env, bucket), count in read_live_counters().items():
        if counter_flag != flag_key:
            continue
        if environment_key and counter_env != environment_key:
            continue
        day = bucket.date().isoformat()
        if day in totals:
            totals[day] += count

    return [{"date": day, "evaluations": totals[day]} for day in sorted(totals)]


def totals_by_flag(db: Session, environment_key: str | None = None) -> dict[str, int]:
    """Lifetime evaluation count per flag — used to spot flags nobody evaluates."""
    totals: dict[str, int] = {}

    query = db.query(models.FlagEvaluationStat)
    if environment_key:
        query = query.filter(models.FlagEvaluationStat.environment_key == environment_key)
    for stat in query.all():
        totals[stat.flag_key] = totals.get(stat.flag_key, 0) + stat.count

    for (flag_key, counter_env, _bucket), count in read_live_counters().items():
        if environment_key and counter_env != environment_key:
            continue
        totals[flag_key] = totals.get(flag_key, 0) + count

    return totals


def _storage_bucket(db: Session, bucket: datetime) -> datetime:
    """SQLite drops tzinfo on write; match that so lookups find existing rows."""
    dialect = getattr(getattr(db, "bind", None), "dialect", None)
    if dialect is not None and dialect.name == "sqlite":
        return bucket.astimezone(timezone.utc).replace(tzinfo=None)
    return bucket
