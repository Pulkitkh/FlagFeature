import hashlib
import json

from sqlalchemy.orm import Session

from app import crud

EVALUATION_RULESET_VERSION = "v2_whitelist_groups"


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

    Priority order:
        1. User targeting
        2. Group targeting
        3. Percentage rollout
        4. Environment override
        5. Default value
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

    if user_id and user_id in targeting_rules["user_ids"]:
        result = {
            "flag_key": flag_key,
            "environment_key": environment_key,
            "value": True,
            "reason": "user_targeting",
            "cached": False,
        }
        _cache_result(flag_key, environment_key, user_context, result, cache_scope)
        return result

    if membership_group_keys and set(targeting_rules["group_keys"]) & membership_group_keys:
        result = {
            "flag_key": flag_key,
            "environment_key": environment_key,
            "value": True,
            "reason": "group_targeting",
            "cached": False,
        }
        _cache_result(flag_key, environment_key, user_context, result, cache_scope)
        return result

    result = {
        "flag_key": flag_key,
        "environment_key": environment_key,
        "value": False,
        "reason": "not_whitelisted_or_grouped",
        "cached": False,
    }
    _cache_result(flag_key, environment_key, user_context, result, cache_scope)
    return result


def _deterministic_bucket(user_id: str, flag_key: str) -> float:
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
