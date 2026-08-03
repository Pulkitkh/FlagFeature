"""Password hashing and JWT issuing.

Isolated from the request layer so the crypto can be tested on its own and
swapped without touching routers.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings

settings = get_settings()

# bcrypt truncates at 72 bytes and raises on longer input in 4.x, so passwords
# are capped rather than silently accepted and half-checked.
MAX_PASSWORD_BYTES = 72
MIN_PASSWORD_LENGTH = 8


class TokenError(Exception):
    """Raised when a token is missing, malformed, expired or badly signed."""


def hash_password(password: str) -> str:
    _validate_length(password)
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Constant-time check. Returns False rather than raising on bad input."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _validate_length(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")


def create_access_token(subject: str, role: str, expires_minutes: int | None = None) -> str:
    """Sign a token for a user. `subject` is the email — the audit log's actor."""
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=expires_minutes or settings.access_token_minutes)

    payload = {
        "sub": subject,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Session expired — please sign in again") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("Invalid authentication token") from exc


def token_expires_in_seconds() -> int:
    return settings.access_token_minutes * 60
