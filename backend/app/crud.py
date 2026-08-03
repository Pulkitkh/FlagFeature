from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import audit, models, schemas
from app.redis_client import (
    invalidate_evaluation_cache,
    invalidate_evaluation_cache_for_environment,
)

# How many recent audit rows the activity chart scans before bucketing by day.
_ACTIVITY_SCAN_LIMIT = 5000


# ---------- Environments ----------


def create_environment(
    db: Session, payload: schemas.EnvironmentCreate, actor: str = "system"
) -> models.Environment:
    env = models.Environment(key=payload.key, name=payload.name)
    db.add(env)
    db.commit()
    db.refresh(env)

    _write_audit(
        db,
        actor=actor,
        action="created",
        entity_type="environment",
        entity_id=str(env.id),
        entity_key=env.key,
        environment_id=env.id,
        after=audit.environment_state(env),
    )
    return env


def update_environment(
    db: Session,
    environment: models.Environment,
    payload: schemas.EnvironmentUpdate,
    actor: str = "system",
) -> models.Environment:
    before = audit.environment_state(environment)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(environment, field, value)

    db.add(environment)
    db.commit()
    db.refresh(environment)

    _write_audit(
        db,
        actor=actor,
        action="updated",
        entity_type="environment",
        entity_id=str(environment.id),
        entity_key=environment.key,
        environment_id=environment.id,
        before=before,
        after=audit.environment_state(environment),
    )
    return environment


def list_environments(db: Session) -> list[models.Environment]:
    return db.query(models.Environment).order_by(models.Environment.id.asc()).all()


def get_environment_by_key(db: Session, key: str) -> models.Environment | None:
    return db.query(models.Environment).filter(models.Environment.key == key).first()


def list_environment_group_keys(db: Session, environment_id: int) -> list[str]:
    rows = (
        db.query(models.UserGroupMembership.group_key)
        .filter(models.UserGroupMembership.environment_id == environment_id)
        .distinct()
        .order_by(models.UserGroupMembership.group_key.asc())
        .all()
    )
    return [row[0] for row in rows]


def list_user_groups(db: Session, environment: models.Environment) -> list[dict]:
    memberships = (
        db.query(models.UserGroupMembership)
        .filter(models.UserGroupMembership.environment_id == environment.id)
        .order_by(models.UserGroupMembership.group_key.asc(), models.UserGroupMembership.user_id.asc())
        .all()
    )

    grouped: dict[str, list[str]] = {}
    for membership in memberships:
        grouped.setdefault(membership.group_key, []).append(membership.user_id)

    return [
        {"group_key": group_key, "user_ids": sorted(set(user_ids))}
        for group_key, user_ids in grouped.items()
    ]


def upsert_user_group_members(
    db: Session,
    environment: models.Environment,
    payload: schemas.UserGroupMembersUpsert,
    actor: str = "system",
) -> dict:
    group_key = payload.group_key.strip()
    user_ids = _normalize_string_list(payload.user_ids)
    existing_user_ids = {
        row[0]
        for row in (
            db.query(models.UserGroupMembership.user_id)
            .filter(
                models.UserGroupMembership.environment_id == environment.id,
                models.UserGroupMembership.group_key == group_key,
            )
            .all()
        )
    }

    for user_id in user_ids:
        if user_id in existing_user_ids:
            continue
        db.add(
            models.UserGroupMembership(
                environment_id=environment.id,
                group_key=group_key,
                user_id=user_id,
            )
        )

    db.commit()
    invalidate_evaluation_cache_for_environment(environment.key)
    _write_audit(
        db,
        actor=actor,
        action="updated",
        entity_type="user_group_membership",
        entity_id=group_key,
        entity_key=group_key,
        environment_id=environment.id,
        before={"members": sorted(existing_user_ids)},
        after={"members": sorted(existing_user_ids | set(user_ids))},
    )
    return {"group_key": group_key, "user_ids": user_ids}


def remove_user_group_member(
    db: Session,
    environment: models.Environment,
    group_key: str,
    user_id: str,
    actor: str = "system",
) -> None:
    membership = (
        db.query(models.UserGroupMembership)
        .filter(
            models.UserGroupMembership.environment_id == environment.id,
            models.UserGroupMembership.group_key == group_key,
            models.UserGroupMembership.user_id == user_id,
        )
        .first()
    )
    if membership is None:
        return

    db.delete(membership)
    db.commit()
    invalidate_evaluation_cache_for_environment(environment.key)
    _write_audit(
        db,
        actor=actor,
        action="deleted",
        entity_type="user_group_membership",
        entity_id=f"{group_key}:{user_id}",
        entity_key=group_key,
        environment_id=environment.id,
        before={"member": user_id},
    )


# ---------- Flags ----------


def create_flag(
    db: Session, payload: schemas.FlagCreate, actor: str = "system"
) -> models.Flag:
    flag = models.Flag(
        key=payload.key,
        type=payload.type,
        default_value=payload.default_value,
        enabled=payload.enabled,
        description=payload.description,
        owner_team=payload.owner_team,
    )
    db.add(flag)
    db.commit()
    db.refresh(flag)

    _write_version(db, flag, created_by=actor, change_note="Flag created")
    _write_audit(
        db,
        actor=actor,
        action="created",
        entity_type="flag",
        entity_id=str(flag.id),
        entity_key=flag.key,
        after=audit.flag_state(flag),
    )
    return flag


def list_flags(db: Session) -> list[models.Flag]:
    return db.query(models.Flag).order_by(models.Flag.id.asc()).all()


def get_flag_by_key(db: Session, key: str) -> models.Flag | None:
    return db.query(models.Flag).filter(models.Flag.key == key).first()


def update_flag(
    db: Session, flag: models.Flag, payload: schemas.FlagUpdate, actor: str = "system"
) -> models.Flag:
    before = audit.flag_state(flag)
    update_data = payload.model_dump(exclude_unset=True, exclude={"change_note"})
    for field, value in update_data.items():
        setattr(flag, field, value)

    db.add(flag)
    db.commit()
    db.refresh(flag)

    after = audit.flag_state(flag)
    _write_version(
        db, flag, created_by=actor, change_note=payload.change_note or "Flag updated"
    )
    _write_audit(
        db,
        actor=actor,
        # "enabled"/"disabled" reads better in the log than a generic "updated"
        # when the only thing that moved was the kill switch.
        action=_flag_action(before, after),
        entity_type="flag",
        entity_id=str(flag.id),
        entity_key=flag.key,
        before=before,
        after=after,
        details={"change_note": payload.change_note} if payload.change_note else None,
    )
    invalidate_evaluation_cache(flag.key)
    return flag


def _flag_action(before: dict, after: dict) -> str:
    if before.get("enabled") != after.get("enabled"):
        changed_only_enabled = {
            field for field in set(before) | set(after) if before.get(field) != after.get(field)
        } == {"enabled"}
        if changed_only_enabled:
            return "enabled" if after.get("enabled") else "disabled"
    return "updated"


def delete_flag(db: Session, flag: models.Flag, actor: str = "system") -> None:
    flag_id = flag.id
    flag_key = flag.key
    before = audit.flag_state(flag)
    db.delete(flag)
    db.commit()
    _write_audit(
        db,
        actor=actor,
        action="deleted",
        entity_type="flag",
        entity_id=str(flag_id),
        entity_key=flag_key,
        before=before,
    )
    invalidate_evaluation_cache(flag_key)


def list_flag_versions(db: Session, flag_id: int) -> list[models.FlagVersion]:
    return (
        db.query(models.FlagVersion)
        .filter(models.FlagVersion.flag_id == flag_id)
        .order_by(models.FlagVersion.version_number.desc())
        .all()
    )


def _write_version(db: Session, flag: models.Flag, created_by: str, change_note: str) -> None:
    last = (
        db.query(models.FlagVersion)
        .filter(models.FlagVersion.flag_id == flag.id)
        .order_by(models.FlagVersion.version_number.desc())
        .first()
    )
    next_version = (last.version_number + 1) if last else 1
    snapshot = {
        "key": flag.key,
        "type": flag.type.value if hasattr(flag.type, "value") else flag.type,
        "default_value": flag.default_value,
        "enabled": flag.enabled,
        "description": flag.description,
        "owner_team": flag.owner_team,
    }
    version = models.FlagVersion(
        flag_id=flag.id,
        version_number=next_version,
        snapshot=snapshot,
        created_by=created_by,
        change_note=change_note,
    )
    db.add(version)
    db.commit()


# ---------- Environment overrides (targeting_rules) ----------


def get_environment_override(
    db: Session, flag_id: int, environment_id: int
) -> models.TargetingRule | None:
    return (
        db.query(models.TargetingRule)
        .filter(
            models.TargetingRule.flag_id == flag_id,
            models.TargetingRule.environment_id == environment_id,
            models.TargetingRule.rule_type == "environment_override",
        )
        .first()
    )


def set_environment_override(
    db: Session,
    flag: models.Flag,
    environment: models.Environment,
    payload: schemas.EnvironmentOverrideSet,
    actor: str = "system",
) -> models.TargetingRule:
    override = get_environment_override(db, flag.id, environment.id)
    before = audit.override_state(override)
    if override is None:
        override = models.TargetingRule(
            flag_id=flag.id,
            environment_id=environment.id,
            rule_type="environment_override",
            priority=0,
        )

    override.conditions = {"enabled": payload.enabled}
    override.value = payload.value

    db.add(override)
    db.commit()
    db.refresh(override)

    _write_audit(
        db,
        actor=actor,
        action="toggled",
        entity_type="environment_override",
        entity_id=str(override.id),
        entity_key=flag.key,
        environment_id=environment.id,
        before=before,
        after=audit.override_state(override),
    )
    invalidate_evaluation_cache(flag.key, environment.key)
    return override


def _get_targeting_rule(
    db: Session, flag_id: int, environment_id: int, rule_type: str
) -> models.TargetingRule | None:
    return (
        db.query(models.TargetingRule)
        .filter(
            models.TargetingRule.flag_id == flag_id,
            models.TargetingRule.environment_id == environment_id,
            models.TargetingRule.rule_type == rule_type,
        )
        .first()
    )


def _normalize_string_list(values: list[str]) -> list[str]:
    return sorted({value.strip() for value in values if value and value.strip()})


def get_targeting_rules(
    db: Session, flag: models.Flag, environment: models.Environment
) -> dict:
    user_rule = _get_targeting_rule(db, flag.id, environment.id, "user_targeting")
    group_rule = _get_targeting_rule(db, flag.id, environment.id, "group_targeting")
    rollout_rule = _get_targeting_rule(db, flag.id, environment.id, "percentage_rollout")

    # All three rules share the same served value, so the first one that exists
    # answers for the set.
    served_value = next(
        (rule.value for rule in (user_rule, group_rule, rollout_rule) if rule is not None),
        None,
    )

    return {
        "flag_key": flag.key,
        "environment_key": environment.key,
        "user_ids": _normalize_string_list((user_rule.conditions or {}).get("user_ids", []))
        if user_rule
        else [],
        "group_keys": _normalize_string_list((group_rule.conditions or {}).get("group_keys", []))
        if group_rule
        else [],
        "percentage": rollout_rule.rollout_percentage if rollout_rule else None,
        "value": served_value,
    }


def set_targeting_rules(
    db: Session,
    flag: models.Flag,
    environment: models.Environment,
    payload: schemas.TargetingRulesUpdate,
    actor: str = "system",
) -> dict:
    before = audit.targeting_state(get_targeting_rules(db, flag, environment))
    user_ids = _normalize_string_list(payload.user_ids)
    group_keys = _normalize_string_list(payload.group_keys)
    served_value = flag.on_value(payload.value)

    user_rule = _get_targeting_rule(db, flag.id, environment.id, "user_targeting")
    group_rule = _get_targeting_rule(db, flag.id, environment.id, "group_targeting")
    rollout_rule = _get_targeting_rule(db, flag.id, environment.id, "percentage_rollout")

    if user_ids:
        if user_rule is None:
            user_rule = models.TargetingRule(
                flag_id=flag.id,
                environment_id=environment.id,
                rule_type="user_targeting",
                priority=10,
            )
        user_rule.conditions = {"user_ids": user_ids}
        user_rule.value = served_value
        db.add(user_rule)
    elif user_rule is not None:
        db.delete(user_rule)

    if group_keys:
        if group_rule is None:
            group_rule = models.TargetingRule(
                flag_id=flag.id,
                environment_id=environment.id,
                rule_type="group_targeting",
                priority=20,
            )
        group_rule.conditions = {"group_keys": group_keys}
        group_rule.value = served_value
        db.add(group_rule)
    elif group_rule is not None:
        db.delete(group_rule)

    if payload.percentage is not None:
        if rollout_rule is None:
            rollout_rule = models.TargetingRule(
                flag_id=flag.id,
                environment_id=environment.id,
                rule_type="percentage_rollout",
                priority=30,
            )
        rollout_rule.conditions = {"percentage": payload.percentage}
        rollout_rule.rollout_percentage = payload.percentage
        rollout_rule.value = served_value
        db.add(rollout_rule)
    elif rollout_rule is not None:
        db.delete(rollout_rule)

    db.commit()
    invalidate_evaluation_cache(flag.key, environment.key)

    updated = get_targeting_rules(db, flag, environment)
    _write_audit(
        db,
        actor=actor,
        action="updated",
        entity_type="targeting_rule",
        entity_id=str(flag.id),
        entity_key=flag.key,
        environment_id=environment.id,
        before=before,
        after=audit.targeting_state(updated),
    )
    return updated


# ---------- Audit log ----------


def _write_audit(
    db: Session,
    actor: str,
    action: str,
    entity_type: str,
    entity_id: str,
    entity_key: str | None = None,
    environment_id: int | None = None,
    before: dict | None = None,
    after: dict | None = None,
    details: dict | None = None,
) -> None:
    """Record one change, with the state either side of it and the diff between."""
    entry = models.AuditLog(
        actor=actor or "system",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_key=entity_key,
        environment_id=environment_id,
        before_state=before,
        after_state=after,
        diff=audit.diff_states(before, after),
        details=details or {},
    )
    db.add(entry)
    db.commit()


def list_audit_log(
    db: Session,
    limit: int = 100,
    actor: str | None = None,
    entity_key: str | None = None,
    entity_type: str | None = None,
    action: str | None = None,
    environment_key: str | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[models.AuditLog]:
    """Newest-first audit entries, narrowed by any combination of filters."""
    query = db.query(models.AuditLog)

    if actor:
        query = query.filter(models.AuditLog.actor.ilike(f"%{actor}%"))
    if entity_key:
        query = query.filter(models.AuditLog.entity_key.ilike(f"%{entity_key}%"))
    if entity_type:
        query = query.filter(models.AuditLog.entity_type == entity_type)
    if action:
        query = query.filter(models.AuditLog.action == action)
    if environment_key:
        environment = get_environment_by_key(db, environment_key)
        # An unknown environment key matches nothing rather than everything.
        query = query.filter(
            models.AuditLog.environment_id == (environment.id if environment else -1)
        )
    if start is not None:
        query = query.filter(models.AuditLog.timestamp >= _timestamp_bound(db, start))
    if end is not None:
        query = query.filter(models.AuditLog.timestamp <= _timestamp_bound(db, end))

    return query.order_by(models.AuditLog.timestamp.desc()).limit(limit).all()


def list_audit_actors(db: Session) -> list[str]:
    """Distinct actors, for populating the audit log's filter dropdown."""
    rows = db.query(models.AuditLog.actor).distinct().order_by(models.AuditLog.actor.asc()).all()
    return [row[0] for row in rows if row[0]]


def _timestamp_bound(db: Session, value: datetime) -> datetime:
    """Shape a datetime filter to match how the backing database stores timestamps.

    Postgres keeps the offset on a timestamptz column, so the bound stays
    timezone-aware. SQLite drops tzinfo when writing, so an aware bound would
    never line up with the stored text — it gets normalised to naive UTC.
    """
    aware = value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    dialect = getattr(getattr(db, "bind", None), "dialect", None)
    if dialect is not None and dialect.name == "sqlite":
        return aware.astimezone(timezone.utc).replace(tzinfo=None)
    return aware.astimezone(timezone.utc)


# ---------- Overview aggregates (dashboard) ----------


def build_overview(db: Session, environment_key: str | None = None, days: int = 14) -> dict:
    """Roll the whole workspace up into the numbers the dashboard charts."""
    flags = list_flags(db)
    environments = list_environments(db)
    selected = (
        get_environment_by_key(db, environment_key) if environment_key else None
    ) or (environments[0] if environments else None)

    enabled = sum(1 for flag in flags if flag.enabled)

    by_type: dict[str, int] = {flag_type.value: 0 for flag_type in models.FlagType}
    for flag in flags:
        key = flag.type.value if hasattr(flag.type, "value") else str(flag.type)
        by_type[key] = by_type.get(key, 0) + 1

    rule_mix = {
        "user_targeting": 0,
        "group_targeting": 0,
        "percentage_rollout": 0,
        "environment_override": 0,
    }
    if selected is not None:
        rows = (
            db.query(models.TargetingRule.rule_type, func.count(models.TargetingRule.id))
            .filter(models.TargetingRule.environment_id == selected.id)
            .group_by(models.TargetingRule.rule_type)
            .all()
        )
        for rule_type, count in rows:
            if rule_type in rule_mix:
                rule_mix[rule_type] = count

    coverage = []
    for environment in environments:
        rules = (
            db.query(models.TargetingRule)
            .filter(models.TargetingRule.environment_id == environment.id)
            .all()
        )
        targeted_flag_ids = {
            rule.flag_id for rule in rules if rule.rule_type != "environment_override"
        }
        overridden_flag_ids = {
            rule.flag_id for rule in rules if rule.rule_type == "environment_override"
        }
        rollouts = [
            rule.rollout_percentage
            for rule in rules
            if rule.rule_type == "percentage_rollout" and rule.rollout_percentage is not None
        ]
        coverage.append(
            {
                "key": environment.key,
                "name": environment.name,
                "targeted_flags": len(targeted_flag_ids),
                "overridden_flags": len(overridden_flag_ids),
                "total_flags": len(flags),
                "avg_rollout": round(sum(rollouts) / len(rollouts), 1) if rollouts else None,
            }
        )

    activity = _activity_by_day(db, days=days)

    group_rows = db.query(models.UserGroupMembership.group_key).distinct().all()
    member_rows = db.query(models.UserGroupMembership.user_id).distinct().all()

    return {
        "totals": {
            "flags": len(flags),
            "enabled": enabled,
            "disabled": len(flags) - enabled,
            "environments": len(environments),
            "groups": len(group_rows),
            "members": len(member_rows),
        },
        "by_type": by_type,
        "rule_mix": rule_mix,
        "environment_coverage": coverage,
        "activity": activity,
        "recent_activity": list_audit_log(db, limit=6),
    }


def _activity_by_day(db: Session, days: int) -> list[dict]:
    """Audit-log entry counts per day, oldest first, with empty days filled in.

    Bucketing happens in Python rather than SQL: Postgres stores these
    timestamps with a timezone and SQLite (used by the test suite) does not, so
    a date filter that behaves identically on both is not worth the complexity
    for a log this size.
    """
    window_start = datetime.now(timezone.utc).date() - timedelta(days=days - 1)

    entries = (
        db.query(models.AuditLog.timestamp)
        .order_by(models.AuditLog.timestamp.desc())
        .limit(_ACTIVITY_SCAN_LIMIT)
        .all()
    )

    counts: dict[str, int] = {}
    for (timestamp,) in entries:
        if timestamp is None:
            continue
        day = timestamp.date()
        if day < window_start:
            continue
        counts[day.isoformat()] = counts.get(day.isoformat(), 0) + 1

    return [
        {
            "date": (window_start + timedelta(days=offset)).isoformat(),
            "changes": counts.get((window_start + timedelta(days=offset)).isoformat(), 0),
        }
        for offset in range(days)
    ]
