from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db
from app.evaluation import EnvironmentNotFoundError, FlagNotFoundError, evaluate_flag

router = APIRouter(tags=["evaluation"])


@router.post("/evaluate", response_model=schemas.EvaluationResult)
def evaluate(payload: schemas.EvaluationRequest, db: Session = Depends(get_db)):
    try:
        result = evaluate_flag(
            db, payload.flag_key, payload.environment_key, payload.user_context
        )
    except FlagNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except EnvironmentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return result


@router.get("/audit-log", response_model=list[schemas.AuditLogOut])
def get_audit_log(limit: int = 100, db: Session = Depends(get_db)):
    return crud.list_audit_log(db, limit=limit)
