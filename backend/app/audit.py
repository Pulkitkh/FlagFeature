"""Snapshotting and diffing for the audit log.

Kept separate from crud so the "what changed" logic can be tested on plain
dicts, without a database.
"""

import json

from app import models


def flag_state(flag: models.Flag) -> dict:
    """The parts of a flag worth recording in an audit entry."""
    return {
        "key": flag.key,
        "type": flag.type.value if hasattr(flag.type, "value") else flag.type,
        "default_value": flag.default_value,
        "enabled": flag.enabled,
        "description": flag.description,
        "owner_team": flag.owner_team,
    }


def environment_state(environment: models.Environment) -> dict:
    return {"key": environment.key, "name": environment.name}


def override_state(override: models.TargetingRule | None) -> dict:
    if override is None:
        return {"enabled": None, "value": None}
    return {
        "enabled": (override.conditions or {}).get("enabled"),
        "value": override.value,
    }


def targeting_state(rules: dict) -> dict:
    """Normalise a targeting-rules dict down to the fields a reviewer cares about."""
    return {
        "user_ids": sorted(rules.get("user_ids") or []),
        "group_keys": sorted(rules.get("group_keys") or []),
        "percentage": rules.get("percentage"),
        "value": rules.get("value"),
    }


def diff_states(before: dict | None, after: dict | None) -> dict:
    """Fields that actually moved, as {field: {"before": x, "after": y}}.

    A create has no `before` and a delete has no `after`; in both cases every
    field of the surviving side is reported, so the entry is still readable on
    its own.
    """
    before = before or {}
    after = after or {}

    changes: dict[str, dict] = {}
    for field in sorted(set(before) | set(after)):
        old = before.get(field)
        new = after.get(field)
        if old != new:
            changes[field] = {"before": old, "after": new}
    return changes


def summarize_diff(diff: dict) -> str:
    """One-line description of a diff, for list views that have no room for JSON."""
    if not diff:
        return "no field changes"
    return ", ".join(
        f"{field}: {_short(change['before'])} → {_short(change['after'])}"
        for field, change in list(diff.items())[:4]
    )


def _short(value, limit: int = 28) -> str:
    if value is None:
        return "—"
    # json.dumps rather than str(): the dashboard is JavaScript, and "True"
    # from Python's repr reads as a different value than the `true` it stores.
    try:
        text = json.dumps(value)
    except (TypeError, ValueError):
        text = str(value)
    return text if len(text) <= limit else text[: limit - 1] + "…"
