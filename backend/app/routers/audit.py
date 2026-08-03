from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import audit, crud, models, schemas
from app.database import get_db
from app.deps import get_current_user

router = APIRouter(prefix="/audit-log", tags=["audit"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[schemas.AuditLogOut])
def get_audit_log(
    limit: int = Query(default=100, ge=1, le=1000),
    actor: str | None = Query(default=None, description="Substring match on the actor"),
    entity_key: str | None = Query(
        default=None, description="Substring match on the flag / environment / group key"
    ),
    entity_type: str | None = Query(
        default=None, description="flag, environment, targeting_rule, environment_override, …"
    ),
    action: str | None = Query(default=None, description="created, updated, enabled, …"),
    environment_key: str | None = Query(default=None),
    start: datetime | None = Query(default=None, description="Inclusive lower bound"),
    end: datetime | None = Query(default=None, description="Inclusive upper bound"),
    db: Session = Depends(get_db),
):
    """Audit entries, newest first, narrowed by any combination of filters."""
    entries = crud.list_audit_log(
        db,
        limit=limit,
        actor=actor,
        entity_key=entity_key,
        entity_type=entity_type,
        action=action,
        environment_key=environment_key,
        start=start,
        end=end,
    )
    return _serialize(db, entries)


@router.get("/actors", response_model=list[str])
def get_audit_actors(db: Session = Depends(get_db)):
    """Everyone who has ever changed something — populates the filter dropdown."""
    return crud.list_audit_actors(db)


def _serialize(db: Session, entries: list[models.AuditLog]) -> list[dict]:
    """Add the two derived fields the model doesn't store: env key and a summary."""
    environment_keys = {
        env.id: env.key for env in db.query(models.Environment).all()
    }

    return [
        {
            "id": entry.id,
            "timestamp": entry.timestamp,
            "actor": entry.actor,
            "action": entry.action,
            "entity_type": entry.entity_type,
            "entity_id": entry.entity_id,
            "entity_key": entry.entity_key,
            "environment_id": entry.environment_id,
            "environment_key": environment_keys.get(entry.environment_id),
            "before_state": entry.before_state,
            "after_state": entry.after_state,
            "diff": entry.diff or {},
            "summary": audit.summarize_diff(entry.diff or {}),
            "details": entry.details,
        }
        for entry in entries
    ]
