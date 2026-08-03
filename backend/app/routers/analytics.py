from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import analytics, crud, schemas
from app.database import get_db

router = APIRouter(tags=["analytics"])


@router.get("/flags/{key}/analytics", response_model=schemas.FlagAnalyticsOut)
def get_flag_analytics(
    key: str,
    days: int = Query(default=7, ge=1, le=90, description="Window size, e.g. 7 or 30"),
    environment_key: str | None = Query(
        default=None, description="Scope to one environment; omit for all"
    ),
    db: Session = Depends(get_db),
):
    """How many times this flag was evaluated per day.

    Combines the counts already flushed to Postgres with the Redis counters for
    the current, un-flushed hour.
    """
    flag = crud.get_flag_by_key(db, key)
    if flag is None:
        raise HTTPException(status_code=404, detail=f"Flag '{key}' not found")

    if environment_key and crud.get_environment_by_key(db, environment_key) is None:
        raise HTTPException(status_code=404, detail=f"Environment '{environment_key}' not found")

    series = analytics.daily_series(db, key, days=days, environment_key=environment_key)

    return {
        "flag_key": key,
        "environment_key": environment_key,
        "days": days,
        "total": sum(point["evaluations"] for point in series),
        "series": series,
    }
