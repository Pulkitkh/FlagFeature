from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.database import get_db
from app.deps import get_actor

router = APIRouter(prefix="/flags", tags=["flags"])

# What a hand-written `value` is allowed to be, per flag type.
_VALUE_TYPES = {
    models.FlagType.boolean: (bool,),
    models.FlagType.number: (int, float),
    models.FlagType.string: (str,),
}


def _get_flag_or_404(db: Session, key: str):
    flag = crud.get_flag_by_key(db, key)
    if flag is None:
        raise HTTPException(status_code=404, detail=f"Flag '{key}' not found")
    return flag


def _get_environment_or_404(db: Session, key: str):
    environment = crud.get_environment_by_key(db, key)
    if environment is None:
        raise HTTPException(status_code=404, detail=f"Environment '{key}' not found")
    return environment


def _validate_value(flag: models.Flag, value) -> None:
    """Reject a served value that doesn't match the flag's declared type.

    Without this a boolean flag could be configured to serve "maybe", which
    every consuming SDK would then have to defend against.
    """
    if value is None:
        return
    allowed = _VALUE_TYPES.get(flag.type)
    # bool is a subclass of int, so a number flag must not accept True.
    if allowed and isinstance(value, allowed) and not (
        flag.type == models.FlagType.number and isinstance(value, bool)
    ):
        return
    raise HTTPException(
        status_code=422,
        detail=f"Flag '{flag.key}' is a {flag.type.value} flag, so its value must be a {flag.type.value}",
    )


@router.post("", response_model=schemas.FlagOut, status_code=201)
def create_flag(
    payload: schemas.FlagCreate,
    db: Session = Depends(get_db),
    actor: str = Depends(get_actor),
):
    try:
        return crud.create_flag(db, payload, actor=actor)
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
def update_flag(
    key: str,
    payload: schemas.FlagUpdate,
    db: Session = Depends(get_db),
    actor: str = Depends(get_actor),
):
    flag = _get_flag_or_404(db, key)
    return crud.update_flag(db, flag, payload, actor=actor)


@router.delete("/{key}", status_code=204)
def delete_flag(
    key: str,
    db: Session = Depends(get_db),
    actor: str = Depends(get_actor),
):
    flag = _get_flag_or_404(db, key)
    crud.delete_flag(db, flag, actor=actor)


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
    actor: str = Depends(get_actor),
):
    """Turn a flag on/off (or pin a value) for a single environment."""
    flag = _get_flag_or_404(db, key)
    environment = _get_environment_or_404(db, env_key)
    _validate_value(flag, payload.value)
    return crud.set_environment_override(db, flag, environment, payload, actor=actor)


@router.get("/{key}/targeting/{env_key}", response_model=schemas.TargetingRulesOut)
def get_targeting_rules(key: str, env_key: str, db: Session = Depends(get_db)):
    flag = _get_flag_or_404(db, key)
    environment = _get_environment_or_404(db, env_key)
    return crud.get_targeting_rules(db, flag, environment)


@router.put("/{key}/targeting/{env_key}", response_model=schemas.TargetingRulesOut)
def set_targeting_rules(
    key: str,
    env_key: str,
    payload: schemas.TargetingRulesUpdate,
    db: Session = Depends(get_db),
    actor: str = Depends(get_actor),
):
    flag = _get_flag_or_404(db, key)
    environment = _get_environment_or_404(db, env_key)
    _validate_value(flag, payload.value)
    return crud.set_targeting_rules(db, flag, environment, payload, actor=actor)
