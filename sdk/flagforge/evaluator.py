"""Local evaluation, mirroring the server's rule priority.

Deliberately dependency-free and operating on the plain snapshot payload, so a
consuming application can install this without pulling in SQLAlchemy or any of
the server's internals.

The priority order here must match `backend/app/evaluation.py`. The contract
test `backend/tests/test_middleware.py` evaluates the same scenarios through
both paths and asserts they agree, so the two can't drift silently.
"""

import hashlib
from typing import Any


class Decision:
    """A resolved flag value plus why it resolved that way."""

    __slots__ = ("value", "reason", "flag_key")

    def __init__(self, flag_key: str, value: Any, reason: str):
        self.flag_key = flag_key
        self.value = value
        self.reason = reason

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"Decision(flag_key={self.flag_key!r}, value={self.value!r}, reason={self.reason!r})"

    def __eq__(self, other) -> bool:
        if not isinstance(other, Decision):
            return NotImplemented
        return (self.flag_key, self.value, self.reason) == (
            other.flag_key,
            other.value,
            other.reason,
        )


def deterministic_bucket(user_id: str, flag_key: str) -> float:
    """Same hash the server uses, so local and remote rollouts agree exactly."""
    digest = hashlib.sha256(f"{user_id}:{flag_key}".encode("utf-8")).hexdigest()
    return (int(digest[:8], 16) % 10000) / 100.0


def _on_value(flag: dict, configured: Any = None) -> Any:
    if configured is not None:
        return configured
    if flag.get("type") == "boolean":
        return True
    return flag.get("default_value")


def _off_value(flag: dict) -> Any:
    if flag.get("type") == "boolean":
        return False
    return flag.get("default_value")


def evaluate(
    flag: dict,
    user_context: dict | None = None,
    group_members: dict[str, list[str]] | None = None,
) -> Decision:
    """Resolve one flag from its snapshot entry.

    Priority: user targeting -> group targeting -> percentage rollout ->
    environment override -> default value. A globally disabled flag
    short-circuits the lot.
    """
    user_context = user_context or {}
    group_members = group_members or {}
    flag_key = flag["key"]

    if not flag.get("enabled", True):
        return Decision(flag_key, _off_value(flag), "flag_disabled")

    user_id = str(user_context.get("user_id") or user_context.get("userId") or "").strip()
    groups = _resolve_groups(user_id, user_context, group_members)
    targeted_value = _on_value(flag, flag.get("targeted_value"))

    # 1. User targeting
    if user_id and user_id in (flag.get("user_ids") or []):
        return Decision(flag_key, targeted_value, "user_targeting")

    # 2. Group targeting
    if groups and set(flag.get("group_keys") or []) & groups:
        return Decision(flag_key, targeted_value, "group_targeting")

    # 3. Percentage rollout
    percentage = flag.get("percentage")
    if percentage is not None and user_id:
        if deterministic_bucket(user_id, flag_key) < percentage:
            return Decision(flag_key, targeted_value, "percentage_rollout")

    # 4. Environment override
    override_enabled = flag.get("override_enabled")
    override_value = flag.get("override_value")
    if override_enabled is False:
        value = override_value if override_value is not None else _off_value(flag)
        return Decision(flag_key, value, "environment_override_disabled")
    if override_enabled is True:
        value = override_value if override_value is not None else _on_value(flag)
        return Decision(flag_key, value, "environment_override_enabled")

    # 5. Default
    return Decision(flag_key, flag.get("default_value"), "default_value")


def _resolve_groups(
    user_id: str, user_context: dict, group_members: dict[str, list[str]]
) -> set[str]:
    """Groups from the snapshot's membership map, plus any passed in by the caller."""
    groups: set[str] = set()

    if user_id:
        for group_key, members in group_members.items():
            if user_id in members:
                groups.add(group_key)

    inline = user_context.get("groups")
    if inline is None:
        inline = user_context.get("group_keys")
    if isinstance(inline, str):
        inline = inline.split(",")
    if isinstance(inline, (list, tuple, set)):
        groups.update(str(group).strip() for group in inline if str(group).strip())

    return groups
