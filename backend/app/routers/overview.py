from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db
from app.deps import get_current_user

router = APIRouter(tags=["overview"], dependencies=[Depends(get_current_user)])


@router.get("/overview", response_model=schemas.OverviewOut)
def get_overview(
    environment_key: str | None = Query(
        default=None,
        description="Scopes the rule-mix breakdown. Defaults to the first environment.",
    ),
    days: int = Query(default=14, ge=1, le=90),
    db: Session = Depends(get_db),
):
    """Workspace-wide aggregates powering the dashboard's stat tiles and charts."""
    return crud.build_overview(db, environment_key=environment_key, days=days)
