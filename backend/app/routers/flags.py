from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/flags", tags=["flags"])


def _get_flag_or_404(db: Session, key: str):
    flag = crud.get_flag_by_key(db, key)
    if flag is None:
        raise HTTPException(status_code=404, detail=f"Flag '{key}' not found")
    return flag


@router.post("", response_model=schemas.FlagOut, status_code=201)
def create_flag(payload: schemas.FlagCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_flag(db, payload)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Flag '{payload.key}' already exists")


@router.get("", response_model=list[schemas.FlagOut])
def list_flags(db: Session = Depends(get_db)):
    return crud.list_flags(db)


@router.get("/{key}", response_model=schemas.FlagOut)
def get_flag(key: str, db: Session = Depends(get_db)):
    return _get_flag_or_404(db, key)


@router.put("/{key}", response_model=schemas.FlagOut)
def update_flag(key: str, payload: schemas.FlagUpdate, db: Session = Depends(get_db)):
    flag = _get_flag_or_404(db, key)
    return crud.update_flag(db, flag, payload)


@router.delete("/{key}", status_code=204)
def delete_flag(key: str, db: Session = Depends(get_db)):
    flag = _get_flag_or_404(db, key)
    crud.delete_flag(db, flag)


@router.get("/{key}/versions", response_model=list[schemas.FlagVersionOut])
def get_flag_versions(key: str, db: Session = Depends(get_db)):
    flag = _get_flag_or_404(db, key)
    return crud.list_flag_versions(db, flag.id)


@router.put("/{key}/environments/{env_key}", response_model=schemas.EnvironmentOverrideOut)
def set_environment_override(
    key: str,
    env_key: str,
    payload: schemas.EnvironmentOverrideSet,
    db: Session = Depends(get_db),
):
    """Turn a flag on/off (or pin a value) for a single environment."""
    flag = _get_flag_or_404(db, key)
    environment = crud.get_environment_by_key(db, env_key)
    if environment is None:
        raise HTTPException(status_code=404, detail=f"Environment '{env_key}' not found")
    return crud.set_environment_override(db, flag, environment, payload)


@router.get("/{key}/targeting/{env_key}", response_model=schemas.TargetingRulesOut)
def get_targeting_rules(key: str, env_key: str, db: Session = Depends(get_db)):
    flag = _get_flag_or_404(db, key)
    environment = crud.get_environment_by_key(db, env_key)
    if environment is None:
        raise HTTPException(status_code=404, detail=f"Environment '{env_key}' not found")
    return crud.get_targeting_rules(db, flag, environment)


@router.put("/{key}/targeting/{env_key}", response_model=schemas.TargetingRulesOut)
def set_targeting_rules(
    key: str,
    env_key: str,
    payload: schemas.TargetingRulesUpdate,
    db: Session = Depends(get_db),
):
    flag = _get_flag_or_404(db, key)
    environment = crud.get_environment_by_key(db, env_key)
    if environment is None:
        raise HTTPException(status_code=404, detail=f"Environment '{env_key}' not found")
    return crud.set_targeting_rules(db, flag, environment, payload)
