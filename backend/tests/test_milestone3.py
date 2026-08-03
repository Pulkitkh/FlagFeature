"""Milestone 3 backend: audit diffs, analytics, cleanup, and the full path end to end."""

from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from app import analytics, cleanup, models
from app.audit import diff_states, summarize_diff

# The account the authenticated `client` fixture signs in as.
ADMIN = "admin@example.com"


def _seed(client):
    client.post("/environments", json={"key": "staging", "name": "Staging"})
    client.post("/environments", json={"key": "production", "name": "Production"})
    client.post(
        "/flags",
        json={
            "key": "new-checkout-flow",
            "type": "boolean",
            "default_value": False,
            "description": "Express checkout",
            "owner_team": "growth",
        },
    )


# ---------- Day 15: audit diffs ----------


def test_diff_states_reports_only_what_moved():
    before = {"enabled": True, "description": "old", "owner_team": "growth"}
    after = {"enabled": False, "description": "old", "owner_team": "growth"}

    assert diff_states(before, after) == {"enabled": {"before": True, "after": False}}


def test_diff_states_handles_creates_and_deletes():
    created = diff_states(None, {"enabled": True})
    assert created == {"enabled": {"before": None, "after": True}}

    deleted = diff_states({"enabled": True}, None)
    assert deleted == {"enabled": {"before": True, "after": None}}


def test_summarize_diff_is_readable():
    assert summarize_diff({}) == "no field changes"
    assert "enabled" in summarize_diff({"enabled": {"before": True, "after": False}})


def test_audit_records_actor_and_diff(client):
    _seed(client)
    client.put(
        "/flags/new-checkout-flow",
        json={"enabled": False, "description": "Paused for the holidays"},
    )

    entries = client.get("/audit-log?entity_key=new-checkout-flow").json()
    update = next(entry for entry in entries if entry["action"] == "updated")

    assert update["actor"] == ADMIN
    assert update["entity_key"] == "new-checkout-flow"
    assert update["diff"]["enabled"] == {"before": True, "after": False}
    assert update["diff"]["description"]["after"] == "Paused for the holidays"
    # Unchanged fields stay out of the diff.
    assert "owner_team" not in update["diff"]
    assert update["before_state"]["enabled"] is True
    assert update["after_state"]["enabled"] is False

    create = next(entry for entry in entries if entry["action"] == "created")
    assert create["actor"] == ADMIN


def test_audit_records_targeting_rule_changes_with_a_diff(client):
    _seed(client)
    client.put(
        "/flags/new-checkout-flow/targeting/staging",
        json={"user_ids": ["alice@example.com"], "percentage": 25},
    )
    client.put(
        "/flags/new-checkout-flow/targeting/staging",
        json={"user_ids": ["alice@example.com", "bob@example.com"], "percentage": 60},
    )

    entries = client.get("/audit-log?entity_type=targeting_rule").json()
    latest = entries[0]

    assert latest["actor"] == ADMIN
    assert latest["environment_key"] == "staging"
    assert latest["diff"]["percentage"] == {"before": 25.0, "after": 60.0}
    assert latest["diff"]["user_ids"]["after"] == ["alice@example.com", "bob@example.com"]


def test_audit_actor_comes_from_the_token_not_a_header(client):
    """The actor can't be forged: a spoofed X-Actor header is ignored."""
    client.post(
        "/environments",
        json={"key": "staging", "name": "Staging"},
        headers={"X-Actor": "someone-else@evil.example"},
    )

    entries = client.get("/audit-log").json()
    assert entries[0]["actor"] == ADMIN


def test_audit_filters(client):
    _seed(client)
    client.put(
        "/flags/new-checkout-flow", json={"enabled": False}
    )
    client.put(
        "/flags/new-checkout-flow/environments/production",
        json={"enabled": True},
    )

    by_actor = client.get(f"/audit-log?actor={ADMIN}").json()
    assert by_actor and all(entry["actor"] == ADMIN for entry in by_actor)
    assert client.get("/audit-log?actor=nobody-by-this-name").json() == []

    by_action = client.get("/audit-log?action=disabled").json()
    assert by_action and all(entry["action"] == "disabled" for entry in by_action)

    by_environment = client.get("/audit-log?environment_key=production").json()
    assert by_environment and all(
        entry["environment_key"] == "production" for entry in by_environment
    )

    by_key = client.get("/audit-log?entity_key=new-checkout").json()
    assert by_key and all("new-checkout" in (entry["entity_key"] or "") for entry in by_key)

    # An unknown environment matches nothing rather than everything.
    assert client.get("/audit-log?environment_key=nope").json() == []

    actors = client.get("/audit-log/actors").json()
    assert ADMIN in actors


def test_audit_date_range_filter(client):
    _seed(client)

    # quote() matters: a "+00:00" offset decodes as a space in a query string,
    # which is a 422 rather than a filter. The dashboard encodes these too.
    future = quote((datetime.now(timezone.utc) + timedelta(days=1)).isoformat())
    past = quote((datetime.now(timezone.utc) - timedelta(days=1)).isoformat())

    assert client.get(f"/audit-log?start={future}").json() == []
    assert client.get(f"/audit-log?end={past}").json() == []
    assert client.get(f"/audit-log?start={past}&end={future}").json() != []


def test_audit_date_filter_accepts_a_plain_date(client):
    """What a date picker sends: no time, no offset."""
    _seed(client)

    today = datetime.now(timezone.utc).date()
    tomorrow = today + timedelta(days=1)

    assert client.get(f"/audit-log?start={today.isoformat()}").json() != []
    assert client.get(f"/audit-log?start={tomorrow.isoformat()}").json() == []


# ---------- Day 16: analytics ----------


def test_evaluations_are_counted_per_flag_and_environment(client):
    _seed(client)

    for _ in range(3):
        client.post(
            "/evaluate",
            json={"flag_key": "new-checkout-flow", "environment_key": "staging"},
            # A distinct user each time would still count once per call; the
            # user doesn't matter to the counter.
        )
    client.post(
        "/evaluate", json={"flag_key": "new-checkout-flow", "environment_key": "production"}
    )

    everywhere = client.get("/flags/new-checkout-flow/analytics?days=7").json()
    assert everywhere["total"] == 4
    assert len(everywhere["series"]) == 7
    assert everywhere["series"][-1]["evaluations"] == 4  # all today

    staging_only = client.get(
        "/flags/new-checkout-flow/analytics?days=7&environment_key=staging"
    ).json()
    assert staging_only["total"] == 3


def test_failed_evaluations_are_not_counted(client, db_session):
    """A 404 shouldn't make a nonexistent flag look busy."""
    _seed(client)
    assert (
        client.post("/evaluate", json={"flag_key": "ghost", "environment_key": "staging"}).status_code
        == 404
    )

    assert "ghost" not in analytics.totals_by_flag(db_session)


def test_analytics_404s_for_unknown_flag_or_environment(client):
    _seed(client)
    assert client.get("/flags/ghost/analytics").status_code == 404
    assert (
        client.get("/flags/new-checkout-flow/analytics?environment_key=ghost").status_code == 404
    )


def test_flush_moves_counters_into_the_database(client, db_session, fake_redis):
    _seed(client)
    for _ in range(5):
        client.post(
            "/evaluate", json={"flag_key": "new-checkout-flow", "environment_key": "staging"}
        )

    # Before the flush the counts live only in Redis.
    assert db_session.query(models.FlagEvaluationStat).count() == 0
    assert analytics.read_live_counters()

    written = analytics.flush_to_database(db_session)
    assert written == 1

    stats = db_session.query(models.FlagEvaluationStat).all()
    assert len(stats) == 1
    assert stats[0].count == 5
    assert stats[0].flag_key == "new-checkout-flow"
    assert stats[0].environment_key == "staging"

    # Counters are cleared, so a second flush doesn't double count.
    assert analytics.read_live_counters() == {}
    assert analytics.flush_to_database(db_session) == 0
    assert db_session.query(models.FlagEvaluationStat).one().count == 5

    # The series still reads correctly once the data has moved.
    series = client.get("/flags/new-checkout-flow/analytics?days=7").json()
    assert series["total"] == 5


def test_flush_tops_up_an_existing_hour_rather_than_overwriting(client, db_session):
    _seed(client)
    client.post("/evaluate", json={"flag_key": "new-checkout-flow", "environment_key": "staging"})
    analytics.flush_to_database(db_session)

    client.post("/evaluate", json={"flag_key": "new-checkout-flow", "environment_key": "staging"})
    analytics.flush_to_database(db_session)

    assert db_session.query(models.FlagEvaluationStat).one().count == 2


def test_analytics_survives_redis_being_unavailable(client, monkeypatch):
    _seed(client)

    class DeadRedis:
        def incr(self, *args, **kwargs):
            raise ConnectionError("redis is down")

        def expire(self, *args, **kwargs):
            raise ConnectionError("redis is down")

        def scan_iter(self, *args, **kwargs):
            raise ConnectionError("redis is down")

    monkeypatch.setattr("app.redis_client.redis_client", DeadRedis())

    # Evaluation still works; analytics just records nothing.
    response = client.post(
        "/evaluate", json={"flag_key": "new-checkout-flow", "environment_key": "staging"}
    )
    assert response.status_code == 200
    assert analytics.read_live_counters() == {}


# ---------- Day 17: cleanup ----------


def _age_flag(db_session, flag_key: str, days: int):
    """Backdate a flag and its audit trail so it counts as stale."""
    old = datetime.now(timezone.utc) - timedelta(days=days)
    naive_old = old.replace(tzinfo=None)

    flag = db_session.query(models.Flag).filter(models.Flag.key == flag_key).one()
    flag.updated_at = naive_old
    flag.created_at = naive_old
    db_session.query(models.AuditLog).filter(models.AuditLog.entity_key == flag_key).update(
        {models.AuditLog.timestamp: naive_old}
    )
    db_session.commit()


def test_fully_rolled_out_flag_is_suggested_for_cleanup(client, db_session):
    _seed(client)
    for environment in ("staging", "production"):
        client.put(
            f"/flags/new-checkout-flow/targeting/{environment}", json={"percentage": 100}
        )
    _age_flag(db_session, "new-checkout-flow", days=45)

    body = client.get("/cleanup/suggestions?stale_days=30").json()
    suggestion = next(item for item in body["suggestions"] if item["flag_key"] == "new-checkout-flow")

    assert suggestion["state"] == "on"
    assert suggestion["stale_days"] >= 45
    assert "rolled out" in suggestion["reason"].lower()


def test_globally_disabled_flag_is_suggested_for_cleanup(client, db_session):
    _seed(client)
    client.put("/flags/new-checkout-flow", json={"enabled": False})
    _age_flag(db_session, "new-checkout-flow", days=60)

    body = client.get("/cleanup/suggestions?stale_days=30").json()
    suggestion = next(item for item in body["suggestions"] if item["flag_key"] == "new-checkout-flow")

    assert suggestion["state"] == "off"


def test_partially_rolled_out_flag_is_not_suggested(client, db_session):
    """A flag still doing real work is never a cleanup candidate."""
    _seed(client)
    client.put("/flags/new-checkout-flow/targeting/staging", json={"percentage": 50})
    client.put("/flags/new-checkout-flow/targeting/production", json={"percentage": 100})
    _age_flag(db_session, "new-checkout-flow", days=90)

    keys = [
        item["flag_key"]
        for item in client.get("/cleanup/suggestions?stale_days=30").json()["suggestions"]
    ]
    assert "new-checkout-flow" not in keys


def test_user_targeted_flag_is_not_suggested(client, db_session):
    _seed(client)
    for environment in ("staging", "production"):
        client.put(
            f"/flags/new-checkout-flow/targeting/{environment}",
            json={"user_ids": ["alice@example.com"], "percentage": 100},
        )
    _age_flag(db_session, "new-checkout-flow", days=90)

    keys = [
        item["flag_key"]
        for item in client.get("/cleanup/suggestions?stale_days=30").json()["suggestions"]
    ]
    assert "new-checkout-flow" not in keys


def test_recently_changed_flag_is_not_suggested(client):
    _seed(client)
    for environment in ("staging", "production"):
        client.put(f"/flags/new-checkout-flow/targeting/{environment}", json={"percentage": 100})

    # Stale in configuration, but changed today.
    body = client.get("/cleanup/suggestions?stale_days=30").json()
    assert body["suggestions"] == []


def test_marking_a_suggestion_reviewed_removes_it(client, db_session):
    _seed(client)
    client.put("/flags/new-checkout-flow", json={"enabled": False})
    _age_flag(db_session, "new-checkout-flow", days=60)

    assert client.get("/cleanup/suggestions?stale_days=30").json()["suggestions"]

    review = client.post(
        "/cleanup/new-checkout-flow/review",
        json={"note": "Ticket PLAT-421 raised to remove the branch"},
    )
    assert review.status_code == 200
    assert review.json()["reviewed_by"] == ADMIN

    assert client.get("/cleanup/suggestions?stale_days=30").json()["suggestions"] == []

    # Still visible when explicitly asked for, flagged as reviewed.
    included = client.get(
        "/cleanup/suggestions?stale_days=30&include_reviewed=true"
    ).json()["suggestions"]
    assert included[0]["reviewed"] is True
    assert included[0]["reviewed_by"] == ADMIN

    # And a review can be undone.
    assert client.delete("/cleanup/new-checkout-flow/review").status_code == 204
    assert client.get("/cleanup/suggestions?stale_days=30").json()["suggestions"]


def test_cleanup_review_404s_for_unknown_flag(client):
    assert client.post("/cleanup/ghost/review", json={}).status_code == 404
    assert client.delete("/cleanup/ghost/review").status_code == 404


def test_cleanup_reports_evaluation_volume(client, db_session):
    """Usage is what tells you whether removing a flag is actually safe."""
    _seed(client)
    client.put("/flags/new-checkout-flow", json={"enabled": False})
    for _ in range(4):
        client.post(
            "/evaluate", json={"flag_key": "new-checkout-flow", "environment_key": "staging"}
        )
    _age_flag(db_session, "new-checkout-flow", days=60)

    suggestion = client.get("/cleanup/suggestions?stale_days=30").json()["suggestions"][0]
    assert suggestion["evaluations"] == 4


def test_cleanup_needs_at_least_one_environment(db_session):
    assert cleanup.find_stale_flags(db_session) == []


# ---------- Day 19: the whole path, end to end ----------


def test_full_path_create_target_evaluate_cache_audit_analytics(client, db_session):
    """Every module in one flow, the way a real integration exercises them."""
    client.post("/environments", json={"key": "staging", "name": "Staging"})

    # 1. Create
    client.post(
        "/flags",
        json={"key": "checkout-v2", "type": "boolean", "default_value": False},
    )

    # 2. Configure targeting
    client.put(
        "/environments/staging/user-groups",
        json={"group_key": "beta_users", "user_ids": ["carol@example.com"]},
    )
    client.put(
        "/flags/checkout-v2/targeting/staging",
        json={"group_keys": ["beta_users"], "percentage": 0},
    )

    # 3. Evaluate
    first = client.post(
        "/evaluate",
        json={
            "flag_key": "checkout-v2",
            "environment_key": "staging",
            "user_context": {"user_id": "carol@example.com"},
        },
    ).json()
    assert first["value"] is True
    assert first["reason"] == "group_targeting"
    assert first["cached"] is False

    # 4. Cache
    second = client.post(
        "/evaluate",
        json={
            "flag_key": "checkout-v2",
            "environment_key": "staging",
            "user_context": {"user_id": "carol@example.com"},
        },
    ).json()
    assert second["cached"] is True

    # 5. Audit — the whole story is on the record, attributed
    entries = client.get("/audit-log?entity_key=checkout-v2").json()
    assert {entry["action"] for entry in entries} >= {"created", "updated"}
    assert all(entry["actor"] == ADMIN for entry in entries)

    # 6. Analytics — cached evaluations still count as usage
    series = client.get("/flags/checkout-v2/analytics?days=7").json()
    assert series["total"] == 2

    # 7. Snapshot — the middleware sees the same configuration
    snapshot = client.get("/snapshot/staging").json()
    snapshot_flag = next(flag for flag in snapshot["flags"] if flag["key"] == "checkout-v2")
    assert snapshot_flag["group_keys"] == ["beta_users"]
    assert snapshot["group_members"]["beta_users"] == ["carol@example.com"]

    # 8. Changing the rule invalidates the cache, and the change is audited
    client.put(
        "/flags/checkout-v2/targeting/staging",
        json={"group_keys": []},
    )
    third = client.post(
        "/evaluate",
        json={
            "flag_key": "checkout-v2",
            "environment_key": "staging",
            "user_context": {"user_id": "carol@example.com"},
        },
    ).json()
    assert third["cached"] is False
    assert third["value"] is False

    latest_audit = client.get("/audit-log?entity_key=checkout-v2").json()[0]
    assert latest_audit["actor"] == ADMIN
    assert latest_audit["diff"]["group_keys"] == {"before": ["beta_users"], "after": []}
