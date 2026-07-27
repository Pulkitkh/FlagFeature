import hashlib

from sqlalchemy.orm import Session

from app import crud, models

EVALUATION_RULESET_VERSION = "v4_typed_targeting"


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
        1. User targeting       - user_id is explicitly whitelisted
        2. Group targeting      - user_id belongs to a targeted group
        3. Percentage rollout   - user_id's deterministic bucket falls in range
        4. Environment override - an explicit on/off (or pinned value) for this environment
        5. Default value        - the flag's global default_value

    A globally disabled flag short-circuits the whole chain (kill switch).
    """
    user_context = user_context or {}

    flag = crud.get_flag_by_key(db, flag_key)
    if flag is None:
        raise FlagNotFoundError(f"Flag '{flag_key}' not found")

    # The environment is validated before anything is resolved, so an unknown
    # environment is a 404 even when the flag happens to be globally disabled.
    environment = crud.get_environment_by_key(db, environment_key)
    if environment is None:
        raise EnvironmentNotFoundError(f"Environment '{environment_key}' not found")

    cache_scope = (
        f"{EVALUATION_RULESET_VERSION}"
        f":{flag.updated_at.isoformat()}"
        f":{environment.created_at.isoformat()}"
    )

    cached_result = _read_cache(flag_key, environment_key, user_context, cache_scope)
    if cached_result is not None:
        cached_result["cached"] = True
        return cached_result

    if not flag.enabled:
        result = _result(flag_key, environment_key, flag.off_value(), "flag_disabled")
        _write_cache(flag_key, environment_key, user_context, result, cache_scope)
        return result

    user_id = _extract_user_id(user_context)
    group_keys = _resolve_group_keys(db, environment, user_id, user_context)
    targeting_rules = crud.get_targeting_rules(db, flag, environment)
    targeted_value = flag.on_value(targeting_rules.get("value"))

    value = None
    reason = None

    # 1. User targeting
    if user_id and user_id in targeting_rules["user_ids"]:
        value, reason = targeted_value, "user_targeting"

    # 2. Group targeting
    elif group_keys and set(targeting_rules["group_keys"]) & group_keys:
        value, reason = targeted_value, "group_targeting"

    # 3. Percentage rollout (needs a user_id to bucket deterministically)
    elif targeting_rules["percentage"] is not None and user_id:
        if deterministic_bucket(user_id, flag_key) < targeting_rules["percentage"]:
            value, reason = targeted_value, "percentage_rollout"

    # 4. Environment override
    if value is None:
        override = crud.get_environment_override(db, flag.id, environment.id)
        if override is not None:
            override_enabled = (override.conditions or {}).get("enabled")
            if override_enabled is False:
                value = override.value if override.value is not None else flag.off_value()
                reason = "environment_override_disabled"
            elif override_enabled is True:
                value = override.value if override.value is not None else flag.on_value()
                reason = "environment_override_enabled"

    # 5. Default value
    if value is None:
        value, reason = flag.default_value, "default_value"

    result = _result(flag_key, environment_key, value, reason)
    _write_cache(flag_key, environment_key, user_context, result, cache_scope)
    return result


def deterministic_bucket(user_id: str, flag_key: str) -> float:
    """Map a user into a stable [0, 100) bucket for a given flag.

    Same user_id + flag_key always hashes to the same bucket, so a user's
    rollout status never flips back and forth as the percentage is nudged
    around them.
    """
    digest = hashlib.sha256(f"{user_id}:{flag_key}".encode("utf-8")).hexdigest()
    return (int(digest[:8], 16) % 10000) / 100.0


def _extract_user_id(user_context: dict) -> str:
    return str(user_context.get("user_id") or user_context.get("userId") or "").strip()


def _resolve_group_keys(
    db: Session,
    environment: models.Environment,
    user_id: str,
    user_context: dict,
) -> set[str]:
    """Groups this user belongs to: stored memberships plus any the caller passes in.

    Stored memberships are the source of truth for real traffic; the inline
    groups let the dashboard's test panel (and SDK callers that already know a
    user's segments) try out a rule without seeding the membership table first.
    """
    group_keys: set[str] = set()

    if user_id:
        rows = (
            db.query(models.UserGroupMembership.group_key)
            .filter(
                models.UserGroupMembership.environment_id == environment.id,
                models.UserGroupMembership.user_id == user_id,
            )
            .all()
        )
        group_keys.update(row[0] for row in rows)

    inline = user_context.get("groups")
    if inline is None:
        inline = user_context.get("group_keys")
    if isinstance(inline, str):
        inline = inline.split(",")
    if isinstance(inline, (list, tuple, set)):
        group_keys.update(str(group).strip() for group in inline if str(group).strip())

    return group_keys


def _result(flag_key: str, environment_key: str, value, reason: str) -> dict:
    return {
        "flag_key": flag_key,
        "environment_key": environment_key,
        "value": value,
        "reason": reason,
        "cached": False,
    }


def _read_cache(
    flag_key: str, environment_key: str, user_context: dict, cache_scope: str
) -> dict | None:
    try:
        from app.redis_client import get_cached_evaluation

        return get_cached_evaluation(flag_key, environment_key, user_context, cache_scope)
    except Exception:
        return None


def _write_cache(
    flag_key: str,
    environment_key: str,
    user_context: dict,
    result: dict,
    cache_scope: str,
) -> None:
    try:
        from app.redis_client import set_cached_evaluation

        set_cached_evaluation(flag_key, environment_key, user_context, result, cache_scope)
    except Exception:
        return
