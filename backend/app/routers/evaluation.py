from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import analytics, schemas
from app.database import get_db
from app.evaluation import EnvironmentNotFoundError, FlagNotFoundError, evaluate_flag

router = APIRouter(tags=["evaluation"])


@router.post("/evaluate", response_model=schemas.EvaluationResult)
def evaluate(payload: schemas.EvaluationRequest, db: Session = Depends(get_db)):
    """Resolve a flag for one user. This is the endpoint consuming apps call."""
    try:
        result = evaluate_flag(
            db, payload.flag_key, payload.environment_key, payload.user_context
        )
    except FlagNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except EnvironmentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # Counted after a successful resolve, so a 404 doesn't inflate a flag's usage.
    analytics.record_evaluation(payload.flag_key, payload.environment_key)
    return result
