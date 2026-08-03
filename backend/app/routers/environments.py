from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/environments", tags=["environments"])


@router.get("", response_model=list[schemas.EnvironmentOut])
def list_environments(db: Session = Depends(get_db)):
    return crud.list_environments(db)


@router.post("", response_model=schemas.EnvironmentOut, status_code=201)
def create_environment(payload: schemas.EnvironmentCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_environment(db, payload)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Environment '{payload.key}' already exists")


@router.put("/{key}", response_model=schemas.EnvironmentOut)
def update_environment(key: str, payload: schemas.EnvironmentUpdate, db: Session = Depends(get_db)):
    environment = crud.get_environment_by_key(db, key)
    if environment is None:
        raise HTTPException(status_code=404, detail=f"Environment '{key}' not found")
    return crud.update_environment(db, environment, payload)


@router.get("/{key}/groups", response_model=list[str])
def get_environment_groups(key: str, db: Session = Depends(get_db)):
    environment = crud.get_environment_by_key(db, key)
    if environment is None:
        raise HTTPException(status_code=404, detail=f"Environment '{key}' not found")
    return crud.list_environment_group_keys(db, environment.id)


@router.get("/{key}/user-groups", response_model=list[schemas.UserGroupMembersOut])
def list_user_groups(key: str, db: Session = Depends(get_db)):
    environment = crud.get_environment_by_key(db, key)
    if environment is None:
        raise HTTPException(status_code=404, detail=f"Environment '{key}' not found")
    return crud.list_user_groups(db, environment)


@router.put("/{key}/user-groups", response_model=schemas.UserGroupMembersOut)
def upsert_user_groups(
    key: str,
    payload: schemas.UserGroupMembersUpsert,
    db: Session = Depends(get_db),
):
    environment = crud.get_environment_by_key(db, key)
    if environment is None:
        raise HTTPException(status_code=404, detail=f"Environment '{key}' not found")
    return crud.upsert_user_group_members(db, environment, payload)


@router.delete("/{key}/user-groups/{group_key}/{user_id}", status_code=204)
def delete_user_group_member(key: str, group_key: str, user_id: str, db: Session = Depends(get_db)):
    environment = crud.get_environment_by_key(db, key)
    if environment is None:
        raise HTTPException(status_code=404, detail=f"Environment '{key}' not found")
    crud.remove_user_group_member(db, environment, group_key, user_id)
