import hashlib
import json
from typing import Any

import redis

from app.config import get_settings

settings = get_settings()

# decode_responses=True so we get str back instead of bytes
redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)


def ping_redis() -> bool:
    try:
        return redis_client.ping()
    except redis.exceptions.RedisError:
        return False


def _normalize_user_context(user_context: dict | None) -> dict[str, Any]:
    context = user_context or {}
    group_keys = context.get("group_keys") or context.get("groups") or []
    if isinstance(group_keys, str):
        group_keys = [part.strip() for part in group_keys.split(",")]

    normalized_groups = sorted({str(group).strip() for group in group_keys if str(group).strip()})
    user_id = str(context.get("user_id") or context.get("userId") or "").strip()

    return {"user_id": user_id, "group_keys": normalized_groups}


def build_evaluation_cache_key(
    flag_key: str,
    environment_key: str,
    user_context: dict | None,
    cache_scope: str = "",
) -> str:
    normalized_context = _normalize_user_context(user_context)
    context_hash = hashlib.sha256(
        json.dumps(normalized_context, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return f"flagforge:evaluate:{flag_key}:{environment_key}:{cache_scope}:{context_hash}"


def get_cached_evaluation(
    flag_key: str,
    environment_key: str,
    user_context: dict | None,
    cache_scope: str = "",
) -> dict | None:
    try:
        cached = redis_client.get(
            build_evaluation_cache_key(flag_key, environment_key, user_context, cache_scope)
        )
    except redis.exceptions.RedisError:
        return None

    if not cached:
        return None

    try:
        return json.loads(cached)
    except json.JSONDecodeError:
        return None


def set_cached_evaluation(
    flag_key: str,
    environment_key: str,
    user_context: dict | None,
    result: dict,
    cache_scope: str = "",
    ttl_seconds: int = 60,
) -> None:
    try:
        redis_client.set(
            build_evaluation_cache_key(flag_key, environment_key, user_context, cache_scope),
            json.dumps(result),
            ex=ttl_seconds,
        )
    except redis.exceptions.RedisError:
        return


def invalidate_evaluation_cache(flag_key: str, environment_key: str | None = None) -> None:
    pattern = f"flagforge:evaluate:{flag_key}:{environment_key or '*'}:*"
    try:
        for cache_key in redis_client.scan_iter(match=pattern):
            redis_client.delete(cache_key)
    except redis.exceptions.RedisError:
        return


def invalidate_evaluation_cache_for_environment(environment_key: str) -> None:
    pattern = f"flagforge:evaluate:*:{environment_key}:*"
    try:
        for cache_key in redis_client.scan_iter(match=pattern):
            redis_client.delete(cache_key)
    except redis.exceptions.RedisError:
        return
