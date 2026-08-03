"""Flag cleanup tooling.

A flag that has been at 100% everywhere for months is no longer a flag — it's
a branch nobody removed. Same for one that has been off everywhere. This module
finds both, works out how long they've been in that state, and leaves the
decision to a human via the review endpoint.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app import analytics, models

DEFAULT_STALE_DAYS = 30


def _aware(value: datetime | None) -> datetime | None:
    """SQLite hands back naive datetimes; treat them as UTC so maths works."""
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _flag_state_in_environment(flag: models.Flag, rules: list[models.TargetingRule]) -> str:
    """How this flag behaves in one environment: 'on', 'off' or 'partial'.

    'partial' means the flag is still doing real work — some users get it and
    some don't — which disqualifies it from cleanup.
    """
    by_type = {rule.rule_type: rule for rule in rules}

    user_rule = by_type.get("user_targeting")
    group_rule = by_type.get("group_targeting")
    rollout = by_type.get("percentage_rollout")
    override = by_type.get("environment_override")

    has_partial_targeting = bool(
        (user_rule and (user_rule.conditions or {}).get("user_ids"))
        or (group_rule and (group_rule.conditions or {}).get("group_keys"))
    )
    rollout_percentage = rollout.rollout_percentage if rollout else None

    # Anything selective is still in flight.
    if has_partial_targeting:
        return "partial"
    if rollout_percentage is not None and 0 < rollout_percentage < 100:
        return "partial"

    if rollout_percentage == 100:
        return "on"

    if override is not None:
        override_enabled = (override.conditions or {}).get("enabled")
        if override_enabled is True:
            return "on"
        if override_enabled is False:
            return "off"

    # No rules at all: the flag's own default decides.
    if rollout_percentage == 0 or rollout_percentage is None:
        return "on" if flag.default_value is True else "off"

    return "partial"


def _stale_since(db: Session, flag: models.Flag) -> datetime:
    """When the flag last changed in any way — the clock for "how long stale".

    Uses the audit log where possible, since it also captures targeting and
    override changes that don't touch the flag row itself.
    """
    last_audit = (
        db.query(models.AuditLog.timestamp)
        .filter(models.AuditLog.entity_key == flag.key)
        .order_by(models.AuditLog.timestamp.desc())
        .first()
    )

    candidates = [_aware(flag.updated_at) or _aware(flag.created_at)]
    if last_audit and last_audit[0]:
        candidates.append(_aware(last_audit[0]))

    return max(candidate for candidate in candidates if candidate is not None)


def find_stale_flags(
    db: Session, stale_days: int = DEFAULT_STALE_DAYS, include_reviewed: bool = False
) -> list[dict]:
    """Flags that are fully rolled out or fully off everywhere, and have been for a while."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=stale_days)

    environments = db.query(models.Environment).all()
    if not environments:
        return []

    flags = db.query(models.Flag).all()
    rules_by_flag: dict[int, dict[int, list[models.TargetingRule]]] = {}
    for rule in db.query(models.TargetingRule).all():
        rules_by_flag.setdefault(rule.flag_id, {}).setdefault(rule.environment_id, []).append(rule)

    reviewed_flag_ids = {
        review.flag_id: review for review in db.query(models.FlagCleanupReview).all()
    }
    evaluation_totals = analytics.totals_by_flag(db)

    suggestions = []
    for flag in flags:
        review = reviewed_flag_ids.get(flag.id)
        if review is not None and not include_reviewed:
            continue

        if not flag.enabled:
            # A globally disabled flag is off everywhere by definition.
            state, reason = "off", "Globally disabled — off in every environment"
        else:
            per_environment = {
                environment.key: _flag_state_in_environment(
                    flag, rules_by_flag.get(flag.id, {}).get(environment.id, [])
                )
                for environment in environments
            }
            states = set(per_environment.values())
            if states == {"on"}:
                state = "on"
                reason = "Fully rolled out (100%) in every environment"
            elif states == {"off"}:
                state = "off"
                reason = "Switched off in every environment"
            else:
                continue

        stale_since = _stale_since(db, flag)
        if stale_since > cutoff:
            continue

        suggestions.append(
            {
                "flag_key": flag.key,
                "flag_id": flag.id,
                "state": state,
                "reason": reason,
                "owner_team": flag.owner_team,
                "stale_since": stale_since,
                "stale_days": (now - stale_since).days,
                "evaluations": evaluation_totals.get(flag.key, 0),
                "reviewed": review is not None,
                "reviewed_by": review.reviewed_by if review else None,
                "reviewed_at": _aware(review.reviewed_at) if review else None,
            }
        )

    # Stalest first — those are the safest and most overdue to remove.
    suggestions.sort(key=lambda item: item["stale_days"], reverse=True)
    return suggestions


def mark_reviewed(
    db: Session, flag: models.Flag, reviewed_by: str = "system", note: str = ""
) -> models.FlagCleanupReview:
    """Sign off a suggestion so it stops appearing in the list."""
    review = (
        db.query(models.FlagCleanupReview)
        .filter(models.FlagCleanupReview.flag_id == flag.id)
        .first()
    )

    if review is None:
        review = models.FlagCleanupReview(flag_id=flag.id)
        db.add(review)

    review.reviewed_by = reviewed_by
    review.reviewed_at = datetime.now(timezone.utc)
    review.note = note

    db.commit()
    db.refresh(review)
    return review


def clear_review(db: Session, flag: models.Flag) -> None:
    """Put a flag back in the suggestion list."""
    db.query(models.FlagCleanupReview).filter(
        models.FlagCleanupReview.flag_id == flag.id
    ).delete()
    db.commit()
