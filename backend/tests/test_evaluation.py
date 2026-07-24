import pytest

from app import crud, models, schemas
from app.evaluation import EnvironmentNotFoundError, FlagNotFoundError, evaluate_flag


def _make_flag_and_env(db_session, default_value=True, flag_enabled=True):
    flag = crud.create_flag(
        db_session,
        schemas.FlagCreate(
            key="new-checkout-flow",
            type=models.FlagType.boolean,
            default_value=default_value,
            enabled=flag_enabled,
            description="Test flag",
            owner_team="growth",
        ),
    )
    env = crud.create_environment(
        db_session, schemas.EnvironmentCreate(key="staging", name="Staging")
    )
    return flag, env


def test_default_value_returned_when_no_rule_matches(db_session):
    """Case 1: no user whitelist or group match -> false is returned."""
    flag, env = _make_flag_and_env(db_session, default_value=True)

    result = evaluate_flag(db_session, flag.key, env.key, user_context={})

    assert result["value"] is False
    assert result["reason"] == "not_whitelisted_or_grouped"


def test_environment_override_works_correctly(db_session):
    """Case 2: a whitelisted user should resolve to true."""
    flag, env = _make_flag_and_env(db_session, default_value=True)

    crud.set_targeting_rules(
        db_session,
        flag,
        env,
        schemas.TargetingRulesUpdate(user_ids=["alice@example.com"]),
    )

    result = evaluate_flag(db_session, flag.key, env.key, user_context={"user_id": "alice@example.com"})
    assert result["value"] is True
    assert result["reason"] == "user_targeting"

    # A second user with no whitelist membership should still be false.
    other_env = crud.create_environment(
        db_session, schemas.EnvironmentCreate(key="production", name="Production")
    )
    other_result = evaluate_flag(
        db_session, flag.key, other_env.key, user_context={"user_id": "bob@example.com"}
    )
    assert other_result["value"] is False
    assert other_result["reason"] == "not_whitelisted_or_grouped"


def test_group_membership_can_enable_flag(db_session):
    """Case 3: a user in an added group resolves to true."""
    flag, env = _make_flag_and_env(db_session, default_value=True)

    crud.set_targeting_rules(
        db_session,
        flag,
        env,
        schemas.TargetingRulesUpdate(group_keys=["beta_users"]),
    )
    db_session.add(
        models.UserGroupMembership(user_id="carol@example.com", group_key="beta_users", environment_id=env.id)
    )
    db_session.commit()

    result = evaluate_flag(db_session, flag.key, env.key, user_context={"user_id": "carol@example.com"})

    assert result["value"] is True
    assert result["reason"] == "group_targeting"


def test_evaluation_works_with_empty_or_missing_user_context(db_session):
    """Case 4: evaluation must not crash with empty dict or None user_context."""
    flag, env = _make_flag_and_env(db_session, default_value=True)

    result_empty = evaluate_flag(db_session, flag.key, env.key, user_context={})
    result_none = evaluate_flag(db_session, flag.key, env.key, user_context=None)

    assert result_empty["value"] is False
    assert result_none["value"] is False


def test_unknown_flag_raises_not_found(db_session):
    with pytest.raises(FlagNotFoundError):
        evaluate_flag(db_session, "does-not-exist", "staging", user_context={})


def test_unknown_environment_raises_not_found(db_session):
    flag, _ = _make_flag_and_env(db_session)
    with pytest.raises(EnvironmentNotFoundError):
        evaluate_flag(db_session, flag.key, "does-not-exist", user_context={})
