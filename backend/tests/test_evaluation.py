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
    """Case 1: no targeting, no override -> the flag's own default_value wins."""
    flag, env = _make_flag_and_env(db_session, default_value=True)

    result = evaluate_flag(db_session, flag.key, env.key, user_context={})

    assert result["value"] is True
    assert result["reason"] == "default_value"

    # A flag whose default is False should resolve to False, not a hardcoded value.
    other_flag = crud.create_flag(
        db_session,
        schemas.FlagCreate(key="dark-mode", type=models.FlagType.boolean, default_value=False),
    )
    other_result = evaluate_flag(db_session, other_flag.key, env.key, user_context={})
    assert other_result["value"] is False
    assert other_result["reason"] == "default_value"


def test_user_targeting_resolves_true_for_whitelisted_user(db_session):
    """A whitelisted user resolves to true; a non-whitelisted user falls through."""
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

    # A second user with no whitelist membership falls through to the default value.
    other_env = crud.create_environment(
        db_session, schemas.EnvironmentCreate(key="production", name="Production")
    )
    other_result = evaluate_flag(
        db_session, flag.key, other_env.key, user_context={"user_id": "bob@example.com"}
    )
    assert other_result["value"] is True
    assert other_result["reason"] == "default_value"


def test_environment_override_works_correctly(db_session):
    """An environment override is applied when no user/group/percentage rule matches."""
    flag, env = _make_flag_and_env(db_session, default_value=False)

    # Turn the flag ON for this environment only, without changing the global default.
    crud.set_environment_override(
        db_session, flag, env, schemas.EnvironmentOverrideSet(enabled=True)
    )

    result = evaluate_flag(db_session, flag.key, env.key, user_context={})
    assert result["value"] is True
    assert result["reason"] == "environment_override_enabled"

    # Flip it off for the environment -> resolves to False even though nothing else changed.
    crud.set_environment_override(
        db_session, flag, env, schemas.EnvironmentOverrideSet(enabled=False)
    )
    off_result = evaluate_flag(db_session, flag.key, env.key, user_context={})
    assert off_result["value"] is False
    assert off_result["reason"] == "environment_override_disabled"

    # A pinned value takes precedence over the default boolean coercion.
    crud.set_environment_override(
        db_session, flag, env, schemas.EnvironmentOverrideSet(enabled=True, value="canary")
    )
    pinned_result = evaluate_flag(db_session, flag.key, env.key, user_context={})
    assert pinned_result["value"] == "canary"
    assert pinned_result["reason"] == "environment_override_enabled"


def test_percentage_rollout_is_deterministic_and_consistent(db_session):
    """The same user always lands in the same bucket for a given flag."""
    flag, env = _make_flag_and_env(db_session, default_value=False)

    crud.set_targeting_rules(
        db_session, flag, env, schemas.TargetingRulesUpdate(percentage=100)
    )
    everyone_in_result = evaluate_flag(
        db_session, flag.key, env.key, user_context={"user_id": "zoe@example.com"}
    )
    assert everyone_in_result["value"] is True
    assert everyone_in_result["reason"] == "percentage_rollout"

    crud.set_targeting_rules(
        db_session, flag, env, schemas.TargetingRulesUpdate(percentage=0)
    )
    everyone_out_result = evaluate_flag(
        db_session, flag.key, env.key, user_context={"user_id": "zoe@example.com"}
    )
    assert everyone_out_result["value"] is False
    assert everyone_out_result["reason"] == "default_value"

    # Re-running the same user/flag/percentage combination is stable.
    crud.set_targeting_rules(
        db_session, flag, env, schemas.TargetingRulesUpdate(percentage=100)
    )
    repeat_result = evaluate_flag(
        db_session, flag.key, env.key, user_context={"user_id": "zoe@example.com"}
    )
    assert repeat_result["value"] is True
    assert repeat_result["reason"] == "percentage_rollout"


def test_priority_order_user_beats_group_beats_percentage_beats_override(db_session):
    """User targeting outranks group targeting, which outranks percentage rollout,
    which outranks the environment override."""
    flag, env = _make_flag_and_env(db_session, default_value=False)

    crud.set_environment_override(
        db_session, flag, env, schemas.EnvironmentOverrideSet(enabled=False)
    )
    crud.set_targeting_rules(
        db_session,
        flag,
        env,
        schemas.TargetingRulesUpdate(
            user_ids=["alice@example.com"], group_keys=["beta_users"], percentage=100
        ),
    )
    db_session.add(
        models.UserGroupMembership(user_id="carol@example.com", group_key="beta_users", environment_id=env.id)
    )
    db_session.commit()

    # alice matches user targeting -> wins over everything else.
    alice_result = evaluate_flag(db_session, flag.key, env.key, user_context={"user_id": "alice@example.com"})
    assert alice_result["reason"] == "user_targeting"

    # carol isn't user-targeted but is in the group -> group targeting wins over percentage/override.
    carol_result = evaluate_flag(db_session, flag.key, env.key, user_context={"user_id": "carol@example.com"})
    assert carol_result["reason"] == "group_targeting"

    # dave matches neither user nor group, but the 100% rollout still catches him.
    dave_result = evaluate_flag(db_session, flag.key, env.key, user_context={"user_id": "dave@example.com"})
    assert dave_result["reason"] == "percentage_rollout"

    # with no user_id at all, percentage rollout can't bucket anyone -> falls to the override.
    no_user_result = evaluate_flag(db_session, flag.key, env.key, user_context={})
    assert no_user_result["reason"] == "environment_override_disabled"
    assert no_user_result["value"] is False


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
    """Case 4: evaluation must not crash with empty dict or None user_context,
    and should still resolve to the flag's default_value."""
    flag, env = _make_flag_and_env(db_session, default_value=True)

    result_empty = evaluate_flag(db_session, flag.key, env.key, user_context={})
    result_none = evaluate_flag(db_session, flag.key, env.key, user_context=None)

    assert result_empty["value"] is True
    assert result_empty["reason"] == "default_value"
    assert result_none["value"] is True
    assert result_none["reason"] == "default_value"


def test_unknown_flag_raises_not_found(db_session):
    with pytest.raises(FlagNotFoundError):
        evaluate_flag(db_session, "does-not-exist", "staging", user_context={})


def test_unknown_environment_raises_not_found(db_session):
    flag, _ = _make_flag_and_env(db_session)
    with pytest.raises(EnvironmentNotFoundError):
        evaluate_flag(db_session, flag.key, "does-not-exist", user_context={})
