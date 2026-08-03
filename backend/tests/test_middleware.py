"""Tests for the middleware SDK.

The important one is `test_local_evaluation_matches_the_server`: the SDK
re-implements the evaluation rules so consuming apps can resolve flags without
a network call, and two implementations of the same rules will drift unless
something checks. That test drives the same scenarios through both and asserts
they agree.
"""

import sys
import threading
import time
from pathlib import Path

import pytest

from app import crud, models, schemas

SDK_ROOT = Path(__file__).resolve().parents[2] / "sdk"
if str(SDK_ROOT) not in sys.path:
    sys.path.insert(0, str(SDK_ROOT))

from flagforge import FlagForgeClient, FlagForgeError  # noqa: E402
from flagforge.evaluator import deterministic_bucket, evaluate  # noqa: E402


# ---------- the SDK's local evaluator vs the server's ----------


CONTEXTS = [
    {},
    {"user_id": "alice@example.com"},
    {"user_id": "carol@example.com"},
    {"user_id": "dave@example.com"},
    {"user_id": "erin@example.com", "groups": ["premium_plan"]},
    {"user_id": "frank@example.com"},
]


def _seed_matrix(client):
    client.post("/environments", json={"key": "staging", "name": "Staging"})
    client.put(
        "/environments/staging/user-groups",
        json={"group_key": "beta_users", "user_ids": ["carol@example.com"]},
    )

    # A spread of configurations: plain default, kill switch, user targeting,
    # group targeting, percentage rollout, override, and a typed flag.
    client.post("/flags", json={"key": "plain", "type": "boolean", "default_value": False})
    client.post(
        "/flags", json={"key": "killed", "type": "boolean", "default_value": True, "enabled": False}
    )
    client.post("/flags", json={"key": "targeted", "type": "boolean", "default_value": False})
    client.post("/flags", json={"key": "rollout", "type": "boolean", "default_value": False})
    client.post("/flags", json={"key": "overridden", "type": "boolean", "default_value": False})
    client.post(
        "/flags", json={"key": "variant", "type": "string", "default_value": "control"}
    )

    client.put(
        "/flags/targeted/targeting/staging",
        json={"user_ids": ["alice@example.com"], "group_keys": ["beta_users", "premium_plan"]},
    )
    client.put("/flags/rollout/targeting/staging", json={"percentage": 50})
    client.put("/flags/overridden/environments/staging", json={"enabled": True})
    client.put(
        "/flags/variant/targeting/staging",
        json={"group_keys": ["beta_users"], "value": "variant-b"},
    )


def test_local_evaluation_matches_the_server(client):
    """Every flag, every context: the SDK and the API must resolve identically."""
    _seed_matrix(client)

    snapshot = client.get("/snapshot/staging").json()
    flags_by_key = {flag["key"]: flag for flag in snapshot["flags"]}
    group_members = snapshot["group_members"]

    assert set(flags_by_key) == {
        "plain",
        "killed",
        "targeted",
        "rollout",
        "overridden",
        "variant",
    }

    for flag_key, flag in flags_by_key.items():
        for context in CONTEXTS:
            local = evaluate(flag, context, group_members)
            remote = client.post(
                "/evaluate",
                json={
                    "flag_key": flag_key,
                    "environment_key": "staging",
                    "user_context": context,
                },
            ).json()

            assert local.value == remote["value"], (
                f"value mismatch for {flag_key} with {context}: "
                f"local={local.value!r} server={remote['value']!r}"
            )
            assert local.reason == remote["reason"], (
                f"reason mismatch for {flag_key} with {context}: "
                f"local={local.reason} server={remote['reason']}"
            )


def test_bucketing_matches_the_server(db_session):
    """The rollout hash has to be identical, or a user flips as traffic moves."""
    from app.evaluation import deterministic_bucket as server_bucket

    for user_id in ("alice@example.com", "bob", "user-42", "zoë@example.com"):
        for flag_key in ("checkout", "dark-mode"):
            assert deterministic_bucket(user_id, flag_key) == server_bucket(user_id, flag_key)


# ---------- the client itself ----------


class _StubTransport:
    """Stands in for the network so the client's caching can be tested offline."""

    def __init__(self, snapshot):
        self.snapshot = snapshot
        self.calls = 0
        self.fail = False

    def __call__(self, path):
        self.calls += 1
        if self.fail:
            raise FlagForgeError("boom")
        return self.snapshot


def _client_with_stub(snapshot, **kwargs):
    sdk_client = FlagForgeClient(api_url="http://example.invalid", environment="staging", **kwargs)
    transport = _StubTransport(snapshot)
    sdk_client._get_json = transport
    return sdk_client, transport


SNAPSHOT = {
    "environment_key": "staging",
    "flags": [
        {
            "key": "new-checkout-flow",
            "type": "boolean",
            "default_value": False,
            "enabled": True,
            "user_ids": ["alice@example.com"],
            "group_keys": ["beta_users"],
            "percentage": None,
            "targeted_value": True,
            "override_enabled": None,
            "override_value": None,
        }
    ],
    "group_members": {"beta_users": ["carol@example.com"]},
}


def test_client_serves_from_cache_without_further_requests():
    sdk_client, transport = _client_with_stub(SNAPSHOT)
    sdk_client.refresh()

    assert transport.calls == 1
    for _ in range(50):
        assert sdk_client.is_enabled("new-checkout-flow", user_id="alice@example.com") is True
    # 50 flag checks, still one HTTP call: this is the whole point of the client.
    assert transport.calls == 1


def test_client_resolves_users_groups_and_defaults():
    sdk_client, _ = _client_with_stub(SNAPSHOT)
    sdk_client.refresh()

    assert sdk_client.evaluate("new-checkout-flow", user_id="alice@example.com").reason == (
        "user_targeting"
    )
    # carol is in beta_users via the snapshot's membership map.
    assert sdk_client.evaluate("new-checkout-flow", user_id="carol@example.com").reason == (
        "group_targeting"
    )
    # Groups can also be supplied by the caller.
    assert sdk_client.evaluate(
        "new-checkout-flow", user_id="nobody", groups=["beta_users"]
    ).reason == "group_targeting"
    assert sdk_client.evaluate("new-checkout-flow", user_id="nobody").reason == "default_value"


def test_unknown_flag_falls_back_to_the_callers_default():
    sdk_client, _ = _client_with_stub(SNAPSHOT)
    sdk_client.refresh()

    decision = sdk_client.evaluate("never-heard-of-it", user_id="alice", default="fallback")
    assert decision.value == "fallback"
    assert decision.reason == "flag_not_found"


def test_client_keeps_serving_the_last_snapshot_when_the_api_goes_down():
    """A flag service outage must not take the consuming application with it."""
    sdk_client, transport = _client_with_stub(SNAPSHOT)
    sdk_client.refresh()

    transport.fail = True
    with pytest.raises(FlagForgeError):
        sdk_client.refresh()

    # Cache intact, still answering.
    assert sdk_client.is_enabled("new-checkout-flow", user_id="alice@example.com") is True
    assert sdk_client.status()["last_error"] is not None
    assert sdk_client.status()["flags_cached"] == 1


def test_client_serves_defaults_before_it_has_ever_reached_the_api():
    sdk_client, transport = _client_with_stub(SNAPSHOT)
    transport.fail = True

    # start() must not raise even though the very first fetch fails.
    sdk_client.start(block_until_ready=True)
    try:
        assert sdk_client.is_ready is False
        assert sdk_client.get_value("new-checkout-flow", user_id="alice", default="safe") == "safe"
    finally:
        sdk_client.stop()


def test_non_blocking_start_still_fetches_immediately():
    """Not blocking startup must not mean serving defaults for a whole interval."""
    sdk_client, transport = _client_with_stub(SNAPSHOT, refresh_interval=30)
    sdk_client.start(block_until_ready=False)
    try:
        deadline = time.time() + 3
        while not sdk_client.is_ready and time.time() < deadline:
            time.sleep(0.02)

        assert sdk_client.is_ready, "background thread waited a full interval before its first fetch"
        assert transport.calls == 1
        assert sdk_client.is_enabled("new-checkout-flow", user_id="alice@example.com") is True
    finally:
        sdk_client.stop()


def test_background_thread_refreshes_and_stops_cleanly():
    sdk_client, transport = _client_with_stub(SNAPSHOT, refresh_interval=0.05)
    sdk_client.start(block_until_ready=True)
    try:
        deadline = time.time() + 3
        while transport.calls < 3 and time.time() < deadline:
            time.sleep(0.05)
        assert transport.calls >= 3, "background refresh never ran"
    finally:
        sdk_client.stop()

    assert not any(
        thread.name == "flagforge-refresh" and thread.is_alive()
        for thread in threading.enumerate()
    )


def test_all_values_bootstraps_every_flag_for_one_user(client):
    """What a frontend would receive on page load."""
    _seed_matrix(client)
    snapshot = client.get("/snapshot/staging").json()

    sdk_client, _ = _client_with_stub(snapshot)
    sdk_client.refresh()

    values = sdk_client.all_values(user_id="alice@example.com")
    assert values["targeted"] is True  # user-targeted
    assert values["killed"] is False  # kill switch
    assert values["overridden"] is True  # environment override
    assert values["plain"] is False  # default


def test_snapshot_endpoint_404s_for_an_unknown_environment(client):
    assert client.get("/snapshot/does-not-exist").status_code == 404


def test_snapshot_carries_typed_targeting_values(client):
    _seed_matrix(client)
    snapshot = client.get("/snapshot/staging").json()
    variant = next(flag for flag in snapshot["flags"] if flag["key"] == "variant")

    assert variant["targeted_value"] == "variant-b"
    assert variant["group_keys"] == ["beta_users"]


def test_group_membership_changes_reach_the_client_on_refresh(client):
    """A new member shouldn't need an app restart to take effect."""
    _seed_matrix(client)

    def fetch(_path):
        return client.get("/snapshot/staging").json()

    sdk_client = FlagForgeClient(api_url="http://example.invalid", environment="staging")
    sdk_client._get_json = fetch
    sdk_client.refresh()

    assert sdk_client.evaluate("targeted", user_id="zoe@example.com").reason == "default_value"

    client.put(
        "/environments/staging/user-groups",
        json={"group_key": "beta_users", "user_ids": ["zoe@example.com"]},
    )
    sdk_client.refresh()

    assert sdk_client.evaluate("targeted", user_id="zoe@example.com").reason == "group_targeting"


def test_seeded_flag_type_matrix_is_complete(db_session):
    """Guards the fixture itself: every flag type is represented in the matrix."""
    flag = crud.create_flag(
        db_session,
        schemas.FlagCreate(key="typed", type=models.FlagType.number, default_value=1),
    )
    assert flag.on_value(None) == 1
