"""Request-level authentication and authorisation.

Three dependencies, in increasing strictness:

    get_optional_user  — decodes a token if one is present, else None
    get_current_user   — 401 unless signed in (any role)
    require_admin      — 403 unless signed in as an admin

The audit log's actor now comes from the verified token rather than a header,
so "who changed this flag" can't be forged by whoever calls the API.
"""

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.security import TokenError, decode_access_token

SYSTEM_ACTOR = "system"


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        # Tells a browser client this is a token problem, not a permissions one.
        headers={"WWW-Authenticate": "Bearer"},
    )


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def get_optional_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> models.User | None:
    """The signed-in user, or None. Used by endpoints that are public but
    behave slightly differently when someone is signed in."""
    token = _bearer_token(authorization)
    if token is None:
        return None

    try:
        payload = decode_access_token(token)
    except TokenError:
        return None

    user = (
        db.query(models.User)
        .filter(models.User.email == payload.get("sub"))
        .first()
    )
    if user is None or not user.is_active:
        return None
    return user


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> models.User:
    token = _bearer_token(authorization)
    if token is None:
        raise _unauthorized("Not authenticated")

    try:
        payload = decode_access_token(token)
    except TokenError as exc:
        raise _unauthorized(str(exc)) from exc

    email = payload.get("sub")
    if not email:
        raise _unauthorized("Invalid authentication token")

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        # The account was deleted after the token was issued.
        raise _unauthorized("Account no longer exists")
    if not user.is_active:
        # Deactivating someone takes effect on their next request, without
        # needing to track and revoke individual tokens.
        raise _unauthorized("This account has been deactivated")

    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires an admin account",
        )
    return user


def get_actor(user: models.User = Depends(get_current_user)) -> str:
    """Who to record against a change. Verified, not self-declared."""
    return user.email
