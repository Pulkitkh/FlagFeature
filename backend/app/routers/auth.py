from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import crud, models, schemas, security
from app.database import get_db
from app.deps import get_current_user, require_admin

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.LoginResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Exchange email + password for a bearer token."""
    user = crud.authenticate(db, payload.email, payload.password)
    if user is None:
        # One message for every failure mode. Saying "no such user" would let
        # anyone discover which email addresses have accounts.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    crud.record_login(db, user)

    return {
        "access_token": security.create_access_token(user.email, user.role.value),
        "token_type": "bearer",
        "expires_in": security.token_expires_in_seconds(),
        "user": user,
    }


@router.get("/me", response_model=schemas.UserOut)
def read_me(user: models.User = Depends(get_current_user)):
    """Who the current token belongs to. The dashboard calls this on load to
    decide whether a stored token is still good."""
    return user


@router.post("/me/password", response_model=schemas.UserOut)
def change_own_password(
    payload: schemas.PasswordChange,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Change your own password. Requires the current one, so a borrowed
    session can't lock the real owner out."""
    if not security.verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    return crud.update_user(db, user, password=payload.new_password, actor=user.email)


# ---------- user administration ----------


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    return crud.list_users(db)


@router.post("/users", response_model=schemas.UserOut, status_code=201)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    if crud.get_user_by_email(db, payload.email) is not None:
        raise HTTPException(status_code=409, detail=f"'{payload.email}' already has an account")

    try:
        return crud.create_user(
            db,
            email=payload.email,
            password=payload.password,
            name=payload.name or "",
            role=payload.role,
            actor=admin.email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"'{payload.email}' already has an account")


@router.put("/users/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Guard rails against an admin locking everyone out of the console.
    demoting = payload.role is not None and payload.role != models.UserRole.admin
    deactivating = payload.is_active is False

    if user.id == admin.id and deactivating:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    if user.is_admin and (demoting or deactivating) and _active_admin_count(db) <= 1:
        raise HTTPException(
            status_code=400,
            detail="This is the last active admin — promote someone else first",
        )

    try:
        return crud.update_user(
            db,
            user,
            name=payload.name,
            role=payload.role,
            is_active=payload.is_active,
            password=payload.password,
            actor=admin.email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


def _active_admin_count(db: Session) -> int:
    return (
        db.query(models.User)
        .filter(models.User.role == models.UserRole.admin, models.User.is_active.is_(True))
        .count()
    )
