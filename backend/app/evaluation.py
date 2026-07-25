import hashlib

from sqlalchemy.orm import Session

from app import crud

EVALUATION_RULESET_VERSION = "v3_percentage_env_override"


class FlagNotFoundError(Exception):
    pass


class EnvironmentNotFoundError(Exception):
    pass


def evaluate_flag(
    db: Session,
    flag_key: str,
    environment_key: str,
    user_context: dict | None = None,
) -> dict:
    """Resolve the value of a flag for a given environment and user.

    Priority order (first match wins):
        1. User targeting      - user_id is explicitly whitelisted
        2. Group targeting     - user_id belongs to a targeted group
        3. Percentage rollout  - user_id's deterministic bucket falls in range
        4. Environment override - an explicit on/off (or pinned value) for this environment
        5. Default value       - the flag's global default_value
    """
    user_context = user_context or {}

    flag = crud.get_flag_by_key(db, flag_key)
    if flag is None:
        raise FlagNotFoundError(f"Flag '{flag_key}' not found")

    if not flag.enabled:
        return {
            "flag_key": flag_key,
            "environment_key": environment_key,
            "value": False,
            "reason": "flag_disabled",
            "cached": False,
        }

    environment = crud.get_environment_by_key(db, environment_key)
    if environment is None:
        raise EnvironmentNotFoundError(f"Environment '{environment_key}' not found")

    cache_scope = (
        f"{EVALUATION_RULESET_VERSION}:{flag.updated_at.isoformat()}:{environment.created_at.isoformat()}"
    )

    cached_result = None
    try:
        from app.redis_client import get_cached_evaluation

        cached_result = get_cached_evaluation(flag_key, environment_key, user_context, cache_scope)
    except Exception:
        cached_result = None

    if cached_result is not None:
        cached_result["cached"] = True
        return cached_result

    user_id = str(user_context.get("user_id") or user_context.get("userId") or "").strip()
    membership_group_keys = set()
    if user_id:
        memberships = (
            db.query(crud.models.UserGroupMembership.group_key)
            .filter(
                crud.models.UserGroupMembership.environment_id == environment.id,
                crud.models.UserGroupMembership.user_id == user_id,
            )
            .all()
        )
        membership_group_keys = {row[0] for row in memberships}

    targeting_rules = crud.get_targeting_rules(db, flag, environment)

    value = None
    reason = None

    # 1. User targeting
    if user_id and user_id in targeting_rules["user_ids"]:
        value, reason = True, "user_targeting"

    # 2. Group targeting
    elif membership_group_keys and set(targeting_rules["group_keys"]) & membership_group_keys:
        value, reason = True, "group_targeting"

    # 3. Percentage rollout (needs a user_id to bucket deterministically)
    elif targeting_rules["percentage"] is not None and user_id:
        bucket = _deterministic_bucket(user_id, flag_key)
        if bucket < targeting_rules["percentage"]:
            value, reason = True, "percentage_rollout"

    # 4. Environment override
    if value is None:
        override = crud.get_environment_override(db, flag.id, environment.id)
        if override is not None:
            override_enabled = (override.conditions or {}).get("enabled")
            if override_enabled is False:
                value = override.value if override.value is not None else False
                reason = "environment_override_disabled"
            elif override_enabled is True:
                value = override.value if override.value is not None else True
                reason = "environment_override_enabled"

    # 5. Default value
    if value is None:
        value, reason = flag.default_value, "default_value"

    result = {
        "flag_key": flag_key,
        "environment_key": environment_key,
        "value": value,
        "reason": reason,
        "cached": False,
    }
    _cache_result(flag_key, environment_key, user_context, result, cache_scope)
    return result


def _deterministic_bucket(user_id: str, flag_key: str) -> float:
    """Map a user into a stable [0, 100) bucket for a given flag.

    Same user_id + flag_key always hashes to the same bucket, so a user's
    rollout status never flips back and forth as the percentage is nudged
    around them.
    """
    digest = hashlib.sha256(f"{user_id}:{flag_key}".encode("utf-8")).hexdigest()
    bucket = int(digest[:8], 16) % 10000
    return bucket / 100.0


def _cache_result(
    flag_key: str,
    environment_key: str,
    user_context: dict | None,
    result: dict,
    cache_scope: str,
) -> None:
    try:
        from app.redis_client import set_cached_evaluation

        set_cached_evaluation(flag_key, environment_key, user_context, result, cache_scope)
    except Exception:
        return
