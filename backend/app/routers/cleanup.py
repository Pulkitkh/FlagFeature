from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import cleanup, crud, schemas
from app.database import get_db
from app.deps import get_actor

router = APIRouter(prefix="/cleanup", tags=["cleanup"])


@router.get("/suggestions", response_model=schemas.CleanupSuggestionsOut)
def get_cleanup_suggestions(
    stale_days: int = Query(
        default=cleanup.DEFAULT_STALE_DAYS,
        ge=0,
        le=3650,
        description="Only suggest flags unchanged for at least this many days",
    ),
    include_reviewed: bool = Query(
        default=False, description="Include suggestions somebody already signed off"
    ),
    db: Session = Depends(get_db),
):
    """Flags that look safe to delete from the codebase.

    A flag qualifies when it resolves the same way for everyone in every
    environment — fully on or fully off — and nothing has changed it for
    `stale_days`.
    """
    suggestions = cleanup.find_stale_flags(
        db, stale_days=stale_days, include_reviewed=include_reviewed
    )
    return {"stale_days": stale_days, "suggestions": suggestions}


@router.post("/{key}/review", response_model=schemas.CleanupReviewOut)
def review_flag(
    key: str,
    payload: schemas.CleanupReviewCreate,
    db: Session = Depends(get_db),
    actor: str = Depends(get_actor),
):
    """Mark a suggestion as reviewed so it drops off the list."""
    flag = crud.get_flag_by_key(db, key)
    if flag is None:
        raise HTTPException(status_code=404, detail=f"Flag '{key}' not found")

    return cleanup.mark_reviewed(db, flag, reviewed_by=actor, note=payload.note or "")


@router.delete("/{key}/review", status_code=204)
def unreview_flag(key: str, db: Session = Depends(get_db)):
    """Undo a review, putting the flag back in the suggestion list."""
    flag = crud.get_flag_by_key(db, key)
    if flag is None:
        raise HTTPException(status_code=404, detail=f"Flag '{key}' not found")

    cleanup.clear_review(db, flag)
