from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.database import get_db
from app.evaluation import EVALUATION_RULESET_VERSION

router = APIRouter(tags=["snapshot"])


@router.get("/snapshot/{environment_key}", response_model=schemas.SnapshotOut)
def get_snapshot(environment_key: str, db: Session = Depends(get_db)):
    """Everything needed to evaluate any flag in this environment, in one call.

    The middleware polls this and evaluates locally, so a consuming app pays a
    dictionary lookup per flag check instead of an HTTP round trip.
    """
    environment = crud.get_environment_by_key(db, environment_key)
    if environment is None:
        raise HTTPException(status_code=404, detail=f"Environment '{environment_key}' not found")

    rules_by_flag: dict[int, dict[str, models.TargetingRule]] = {}
    for rule in (
        db.query(models.TargetingRule)
        .filter(models.TargetingRule.environment_id == environment.id)
        .all()
    ):
        rules_by_flag.setdefault(rule.flag_id, {})[rule.rule_type] = rule

    flags = []
    for flag in crud.list_flags(db):
        rules = rules_by_flag.get(flag.id, {})
        user_rule = rules.get("user_targeting")
        group_rule = rules.get("group_targeting")
        rollout_rule = rules.get("percentage_rollout")
        override = rules.get("environment_override")

        targeted_value = next(
            (rule.value for rule in (user_rule, group_rule, rollout_rule) if rule is not None),
            None,
        )

        flags.append(
            {
                "key": flag.key,
                "type": flag.type,
                "default_value": flag.default_value,
                "enabled": flag.enabled,
                "user_ids": sorted((user_rule.conditions or {}).get("user_ids", []))
                if user_rule
                else [],
                "group_keys": sorted((group_rule.conditions or {}).get("group_keys", []))
                if group_rule
                else [],
                "percentage": rollout_rule.rollout_percentage if rollout_rule else None,
                "targeted_value": targeted_value,
                "override_enabled": (override.conditions or {}).get("enabled")
                if override
                else None,
                "override_value": override.value if override else None,
            }
        )

    group_members: dict[str, list[str]] = {}
    for membership in (
        db.query(models.UserGroupMembership)
        .filter(models.UserGroupMembership.environment_id == environment.id)
        .all()
    ):
        group_members.setdefault(membership.group_key, []).append(membership.user_id)

    return {
        "environment_key": environment.key,
        "generated_at": datetime.now(timezone.utc),
        # Bumping the ruleset version tells an older client its local evaluator
        # may not match the server any more.
        "version": EVALUATION_RULESET_VERSION,
        "flags": flags,
        "group_members": {key: sorted(set(members)) for key, members in group_members.items()},
    }
