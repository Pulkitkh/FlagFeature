"""End-to-end tests through the HTTP layer.

These cover the Milestone 1 error contract and the Milestone 2 integration
checkpoint: rule priority, environment overrides and cache invalidation all
working together over the real routers.
"""


def _create_environment(client, key="staging", name="Staging"):
    response = client.post("/environments", json={"key": key, "name": name})
    assert response.status_code == 201, response.text
    return response.json()


def _create_flag(client, key="new-checkout-flow", **overrides):
    payload = {
        "key": key,
        "type": "boolean",
        "default_value": False,
        "enabled": True,
        "description": "Test flag",
        "owner_team": "growth",
    }
    payload.update(overrides)
    response = client.post("/flags", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _evaluate(client, flag_key, environment_key, user_context=None):
    response = client.post(
        "/evaluate",
        json={
            "flag_key": flag_key,
            "environment_key": environment_key,
            "user_context": user_context or {},
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


# ---------- health ----------


def test_health_reports_database_and_redis(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"
    assert body["redis"] == "connected"


# ---------- flag CRUD + error contract ----------


def test_flag_crud_round_trip(client):
    created = _create_flag(client)
    assert created["key"] == "new-checkout-flow"

    listed = client.get("/flags").json()
    assert [flag["key"] for flag in listed] == ["new-checkout-flow"]

    fetched = client.get("/flags/new-checkout-flow").json()
    assert fetched["owner_team"] == "growth"

    updated = client.put(
        "/flags/new-checkout-flow",
        json={"enabled": False, "description": "Now off", "change_note": "Killed"},
    ).json()
    assert updated["enabled"] is False
    assert updated["description"] == "Now off"

    versions = client.get("/flags/new-checkout-flow/versions").json()
    assert [version["version_number"] for version in versions] == [2, 1]
    assert versions[0]["change_note"] == "Killed"

    assert client.delete("/flags/new-checkout-flow").status_code == 204
    assert client.get("/flags/new-checkout-flow").status_code == 404


def test_duplicate_flag_key_is_rejected(client):
    _create_flag(client)
    response = client.post(
        "/flags", json={"key": "new-checkout-flow", "type": "boolean", "default_value": False}
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_duplicate_environment_key_is_rejected(client):
    _create_environment(client)
    response = client.post("/environments", json={"key": "staging", "name": "Staging again"})
    assert response.status_code == 409


def test_missing_flag_and_environment_return_404(client):
    _create_environment(client)
    _create_flag(client)

    assert client.get("/flags/ghost").status_code == 404
    assert client.put("/flags/ghost", json={"enabled": True}).status_code == 404
    assert client.put("/environments/ghost", json={"name": "Ghost"}).status_code == 404
    assert (
        client.get("/flags/new-checkout-flow/targeting/ghost-env").status_code == 404
    )
    assert (
        client.put(
            "/flags/new-checkout-flow/environments/ghost-env", json={"enabled": True}
        ).status_code
        == 404
    )

    missing_flag = client.post(
        "/evaluate", json={"flag_key": "ghost", "environment_key": "staging"}
    )
    assert missing_flag.status_code == 404

    missing_env = client.post(
        "/evaluate", json={"flag_key": "new-checkout-flow", "environment_key": "ghost-env"}
    )
    assert missing_env.status_code == 404


def test_invalid_payloads_are_rejected(client):
    _create_environment(client)
    _create_flag(client)

    # Percentage outside 0-100.
    over_range = client.put(
        "/flags/new-checkout-flow/targeting/staging", json={"percentage": 140}
    )
    assert over_range.status_code == 422

    # A string value on a boolean flag.
    wrong_type = client.put(
        "/flags/new-checkout-flow/targeting/staging",
        json={"user_ids": ["alice"], "value": "variant-b"},
    )
    assert wrong_type.status_code == 422


# ---------- environments ----------


def test_environment_management_and_per_environment_overrides(client):
    _create_environment(client, "development", "Development")
    _create_environment(client, "production", "Production")
    _create_flag(client, default_value=False)

    renamed = client.put("/environments/production", json={"name": "Prod"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Prod"

    # On in development, untouched in production: the same flag, two behaviours.
    client.put("/flags/new-checkout-flow/environments/development", json={"enabled": True})

    assert _evaluate(client, "new-checkout-flow", "development")["value"] is True
    assert _evaluate(client, "new-checkout-flow", "production")["value"] is False


def test_environment_override_can_pin_a_typed_value(client):
    _create_environment(client)
    _create_flag(client, key="checkout-copy", type="string", default_value="control")

    client.put(
        "/flags/checkout-copy/environments/staging",
        json={"enabled": True, "value": "holiday-copy"},
    )

    assert _evaluate(client, "checkout-copy", "staging")["value"] == "holiday-copy"


# ---------- targeting, rollout & priority order ----------


def test_rule_priority_order_end_to_end(client):
    _create_environment(client)
    _create_flag(client, default_value=False)

    client.put(
        "/environments/staging/user-groups",
        json={"group_key": "beta_users", "user_ids": ["carol@example.com"]},
    )
    client.put(
        "/flags/new-checkout-flow/environments/staging", json={"enabled": False}
    )
    client.put(
        "/flags/new-checkout-flow/targeting/staging",
        json={
            "user_ids": ["alice@example.com"],
            "group_keys": ["beta_users"],
            "percentage": 100,
        },
    )

    assert (
        _evaluate(client, "new-checkout-flow", "staging", {"user_id": "alice@example.com"})["reason"]
        == "user_targeting"
    )
    assert (
        _evaluate(client, "new-checkout-flow", "staging", {"user_id": "carol@example.com"})["reason"]
        == "group_targeting"
    )
    assert (
        _evaluate(client, "new-checkout-flow", "staging", {"user_id": "dave@example.com"})["reason"]
        == "percentage_rollout"
    )
    # No user_id: nothing to bucket, so the environment override answers.
    assert (
        _evaluate(client, "new-checkout-flow", "staging")["reason"]
        == "environment_override_disabled"
    )


def test_percentage_rollout_is_stable_across_requests(client):
    _create_environment(client)
    _create_flag(client, default_value=False)
    client.put("/flags/new-checkout-flow/targeting/staging", json={"percentage": 50})

    first_pass = {
        f"user-{index}": _evaluate(
            client, "new-checkout-flow", "staging", {"user_id": f"user-{index}"}
        )["value"]
        for index in range(40)
    }
    included = sum(1 for value in first_pass.values() if value is True)

    # A 50% rollout over 40 users shouldn't land at either extreme.
    assert 5 < included < 35

    # Widening the rollout never removes a user who was already in it.
    client.put("/flags/new-checkout-flow/targeting/staging", json={"percentage": 80})
    for user_id, was_in in first_pass.items():
        if was_in:
            assert (
                _evaluate(client, "new-checkout-flow", "staging", {"user_id": user_id})["value"]
                is True
            ), f"{user_id} dropped out of the rollout when it widened"


def test_user_group_membership_management(client):
    _create_environment(client)

    client.put(
        "/environments/staging/user-groups",
        json={"group_key": "beta_users", "user_ids": ["alice@example.com", "bob@example.com"]},
    )

    groups = client.get("/environments/staging/user-groups").json()
    assert groups == [
        {"group_key": "beta_users", "user_ids": ["alice@example.com", "bob@example.com"]}
    ]
    assert client.get("/environments/staging/groups").json() == ["beta_users"]

    removed = client.delete("/environments/staging/user-groups/beta_users/bob@example.com")
    assert removed.status_code == 204
    assert client.get("/environments/staging/user-groups").json()[0]["user_ids"] == [
        "alice@example.com"
    ]


# ---------- caching & invalidation ----------


def test_repeat_evaluations_are_served_from_cache(client):
    _create_environment(client)
    _create_flag(client, default_value=True)

    assert _evaluate(client, "new-checkout-flow", "staging")["cached"] is False
    assert _evaluate(client, "new-checkout-flow", "staging")["cached"] is True


def test_cache_is_invalidated_when_the_flag_changes(client):
    _create_environment(client)
    _create_flag(client, default_value=True)

    assert _evaluate(client, "new-checkout-flow", "staging")["value"] is True
    assert _evaluate(client, "new-checkout-flow", "staging")["cached"] is True

    client.put("/flags/new-checkout-flow", json={"default_value": False})

    refreshed = _evaluate(client, "new-checkout-flow", "staging")
    assert refreshed["cached"] is False
    assert refreshed["value"] is False


def test_cache_is_invalidated_when_targeting_rules_change(client, fake_redis):
    _create_environment(client)
    _create_flag(client, default_value=False)
    context = {"user_id": "alice@example.com"}

    assert _evaluate(client, "new-checkout-flow", "staging", context)["value"] is False
    assert _evaluate(client, "new-checkout-flow", "staging", context)["cached"] is True

    client.put(
        "/flags/new-checkout-flow/targeting/staging", json={"user_ids": ["alice@example.com"]}
    )
    assert fake_redis.store == {}, "targeting update should clear this flag's cache"

    refreshed = _evaluate(client, "new-checkout-flow", "staging", context)
    assert refreshed["cached"] is False
    assert refreshed["value"] is True
    assert refreshed["reason"] == "user_targeting"


def test_cache_is_invalidated_when_an_environment_override_changes(client):
    _create_environment(client)
    _create_flag(client, default_value=False)

    assert _evaluate(client, "new-checkout-flow", "staging")["value"] is False

    client.put("/flags/new-checkout-flow/environments/staging", json={"enabled": True})

    refreshed = _evaluate(client, "new-checkout-flow", "staging")
    assert refreshed["cached"] is False
    assert refreshed["value"] is True


def test_cache_is_invalidated_when_group_membership_changes(client):
    _create_environment(client)
    _create_flag(client, default_value=False)
    client.put(
        "/flags/new-checkout-flow/targeting/staging", json={"group_keys": ["beta_users"]}
    )
    context = {"user_id": "carol@example.com"}

    assert _evaluate(client, "new-checkout-flow", "staging", context)["value"] is False
    assert _evaluate(client, "new-checkout-flow", "staging", context)["cached"] is True

    client.put(
        "/environments/staging/user-groups",
        json={"group_key": "beta_users", "user_ids": ["carol@example.com"]},
    )

    refreshed = _evaluate(client, "new-checkout-flow", "staging", context)
    assert refreshed["value"] is True
    assert refreshed["reason"] == "group_targeting"


def test_cache_separates_distinct_user_contexts(client):
    _create_environment(client)
    _create_flag(client, default_value=False)
    client.put(
        "/flags/new-checkout-flow/targeting/staging", json={"user_ids": ["alice@example.com"]}
    )

    alice = _evaluate(client, "new-checkout-flow", "staging", {"user_id": "alice@example.com"})
    bob = _evaluate(client, "new-checkout-flow", "staging", {"user_id": "bob@example.com"})

    assert alice["value"] is True
    assert bob["value"] is False, "bob must not be served alice's cached result"


# ---------- audit log & overview ----------


def test_audit_log_records_every_change(client):
    _create_environment(client)
    _create_flag(client)
    client.put("/flags/new-checkout-flow", json={"enabled": False})
    client.put("/flags/new-checkout-flow/environments/staging", json={"enabled": True})

    entries = client.get("/audit-log").json()
    actions = {(entry["entity_type"], entry["action"]) for entry in entries}

    assert ("flag", "created") in actions
    assert ("flag", "updated") in actions
    assert ("targeting_rule", "toggled") in actions
    # Newest first.
    assert entries == sorted(entries, key=lambda entry: entry["timestamp"], reverse=True)


def test_overview_aggregates_reflect_the_workspace(client):
    _create_environment(client, "development", "Development")
    _create_environment(client, "production", "Production")
    _create_flag(client, key="flag-a", enabled=True)
    _create_flag(client, key="flag-b", enabled=False, type="string", default_value="control")
    client.put("/flags/flag-a/targeting/development", json={"percentage": 25})
    client.put("/flags/flag-a/environments/production", json={"enabled": False})
    client.put(
        "/environments/development/user-groups",
        json={"group_key": "beta_users", "user_ids": ["alice@example.com"]},
    )

    overview = client.get("/overview?environment_key=development").json()

    assert overview["totals"] == {
        "flags": 2,
        "enabled": 1,
        "disabled": 1,
        "environments": 2,
        "groups": 1,
        "members": 1,
    }
    assert overview["by_type"]["boolean"] == 1
    assert overview["by_type"]["string"] == 1
    assert overview["rule_mix"]["percentage_rollout"] == 1

    coverage = {entry["key"]: entry for entry in overview["environment_coverage"]}
    assert coverage["development"]["targeted_flags"] == 1
    assert coverage["development"]["avg_rollout"] == 25
    assert coverage["production"]["overridden_flags"] == 1

    assert len(overview["activity"]) == 14
    assert overview["activity"][-1]["changes"] > 0, "today's changes should be counted"
    assert len(overview["recent_activity"]) > 0
