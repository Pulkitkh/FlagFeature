"""Authentication and authorisation.

The valuable tests here are the negative ones: that endpoints actually refuse
anonymous callers, that a viewer genuinely can't write, and that the audit
log's actor can't be forged.
"""

import pytest

from app import crud, models, security

ADMIN = "admin@example.com"


# ---------- password hashing ----------


def test_passwords_are_hashed_not_stored():
    hashed = security.hash_password("correct horse battery staple")

    assert hashed != "correct horse battery staple"
    assert hashed.startswith("$2b$")
    assert security.verify_password("correct horse battery staple", hashed)
    assert not security.verify_password("wrong password", hashed)


def test_the_same_password_hashes_differently_each_time():
    """Salted, so two users with the same password don't share a hash."""
    assert security.hash_password("same-password") != security.hash_password("same-password")


def test_password_length_is_bounded():
    with pytest.raises(ValueError):
        security.hash_password("short")
    with pytest.raises(ValueError):
        # bcrypt silently truncates past 72 bytes, which would make the tail of
        # a long password meaningless.
        security.hash_password("x" * 73)


def test_verify_password_rejects_a_malformed_hash():
    assert security.verify_password("anything", "not-a-bcrypt-hash") is False


# ---------- tokens ----------


def test_token_round_trip_carries_subject_and_role():
    token = security.create_access_token("alice@example.com", "admin")
    payload = security.decode_access_token(token)

    assert payload["sub"] == "alice@example.com"
    assert payload["role"] == "admin"


def test_expired_token_is_rejected():
    token = security.create_access_token("alice@example.com", "admin", expires_minutes=-1)

    with pytest.raises(security.TokenError):
        security.decode_access_token(token)


def test_token_signed_with_another_key_is_rejected(monkeypatch):
    token = security.create_access_token("alice@example.com", "admin")

    monkeypatch.setattr(security.settings, "jwt_secret", "a-different-secret")
    with pytest.raises(security.TokenError):
        security.decode_access_token(token)


def test_garbage_token_is_rejected():
    with pytest.raises(security.TokenError):
        security.decode_access_token("clearly.not.a.token")


# ---------- login ----------


def test_login_returns_a_usable_token(anon_client, admin_user):
    response = anon_client.post(
        "/auth/login", json={"email": ADMIN, "password": "admin-password"}
    )
    assert response.status_code == 200

    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] > 0
    assert body["user"]["email"] == ADMIN
    assert body["user"]["role"] == "admin"
    assert "password" not in body["user"] and "password_hash" not in body["user"]

    me = anon_client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == ADMIN


def test_login_is_case_insensitive_on_email(anon_client, admin_user):
    response = anon_client.post(
        "/auth/login", json={"email": "ADMIN@Example.COM", "password": "admin-password"}
    )
    assert response.status_code == 200


def test_wrong_password_is_rejected(anon_client, admin_user):
    response = anon_client.post("/auth/login", json={"email": ADMIN, "password": "nope"})
    assert response.status_code == 401


def test_unknown_and_wrong_password_are_indistinguishable(anon_client, admin_user):
    """Different messages here would let anyone enumerate real accounts."""
    unknown = anon_client.post(
        "/auth/login", json={"email": "nobody@example.com", "password": "whatever"}
    )
    wrong = anon_client.post("/auth/login", json={"email": ADMIN, "password": "wrong"})

    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["detail"] == wrong.json()["detail"]


def test_deactivated_account_cannot_log_in(anon_client, db_session, admin_user):
    crud.update_user(db_session, admin_user, is_active=False)

    response = anon_client.post(
        "/auth/login", json={"email": ADMIN, "password": "admin-password"}
    )
    assert response.status_code == 401


def test_deactivating_an_account_invalidates_its_existing_session(
    client, db_session, viewer_user
):
    """Access is revoked on the next request, without tracking every token."""
    token = security.create_access_token(viewer_user.email, viewer_user.role.value)
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/auth/me", headers=headers).status_code == 200

    crud.update_user(db_session, viewer_user, is_active=False)

    response = client.get("/auth/me", headers=headers)
    assert response.status_code == 401
    assert "deactivated" in response.json()["detail"].lower()


def test_login_records_the_time(anon_client, db_session, admin_user):
    assert admin_user.last_login_at is None

    anon_client.post("/auth/login", json={"email": ADMIN, "password": "admin-password"})
    db_session.refresh(admin_user)

    assert admin_user.last_login_at is not None


# ---------- endpoints are actually protected ----------


PROTECTED_READS = [
    ("get", "/flags"),
    ("get", "/environments"),
    ("get", "/overview"),
    ("get", "/audit-log"),
    ("get", "/audit-log/actors"),
    ("get", "/cleanup/suggestions"),
    ("get", "/auth/me"),
]


@pytest.mark.parametrize("method,path", PROTECTED_READS)
def test_protected_endpoints_reject_anonymous_callers(anon_client, method, path):
    assert getattr(anon_client, method)(path).status_code == 401


def test_protected_endpoints_reject_a_garbage_token(anon_client):
    response = anon_client.get("/flags", headers={"Authorization": "Bearer nonsense"})
    assert response.status_code == 401


def test_a_non_bearer_authorization_header_is_rejected(anon_client, admin_user):
    response = anon_client.get("/flags", headers={"Authorization": "Basic abc123"})
    assert response.status_code == 401


def test_writes_reject_anonymous_callers(anon_client):
    assert (
        anon_client.post("/flags", json={"key": "x", "type": "boolean"}).status_code == 401
    )
    assert (
        anon_client.post("/environments", json={"key": "x", "name": "X"}).status_code == 401
    )


# ---------- the SDK's endpoints stay public ----------


def test_evaluate_and_snapshot_stay_public(anon_client, client):
    """Consuming applications must keep working without credentials — the
    middleware polls these on a background thread with no user to speak of."""
    client.post("/environments", json={"key": "staging", "name": "Staging"})
    client.post("/flags", json={"key": "public-flag", "type": "boolean", "default_value": True})

    evaluation = anon_client.post(
        "/evaluate", json={"flag_key": "public-flag", "environment_key": "staging"}
    )
    assert evaluation.status_code == 200
    assert evaluation.json()["value"] is True

    snapshot = anon_client.get("/snapshot/staging")
    assert snapshot.status_code == 200
    assert any(flag["key"] == "public-flag" for flag in snapshot.json()["flags"])

    assert anon_client.get("/health").status_code == 200


# ---------- roles ----------


def test_viewer_can_read_everything(viewer_client, db_session):
    from app import crud as crud_module
    from app import schemas

    crud_module.create_environment(db_session, schemas.EnvironmentCreate(key="staging", name="Staging"))
    crud_module.create_flag(db_session, schemas.FlagCreate(key="readable", type=models.FlagType.boolean))

    assert viewer_client.get("/flags").status_code == 200
    assert viewer_client.get("/environments").status_code == 200
    assert viewer_client.get("/overview").status_code == 200
    assert viewer_client.get("/audit-log").status_code == 200
    assert viewer_client.get("/cleanup/suggestions").status_code == 200
    assert viewer_client.get("/flags/readable/analytics").status_code == 200


def test_viewer_cannot_change_anything(viewer_client, db_session):
    from app import crud as crud_module
    from app import schemas

    crud_module.create_environment(db_session, schemas.EnvironmentCreate(key="staging", name="Staging"))
    crud_module.create_flag(db_session, schemas.FlagCreate(key="locked", type=models.FlagType.boolean))

    forbidden = [
        viewer_client.post("/flags", json={"key": "nope", "type": "boolean"}),
        viewer_client.put("/flags/locked", json={"enabled": False}),
        viewer_client.delete("/flags/locked"),
        viewer_client.put("/flags/locked/targeting/staging", json={"percentage": 50}),
        viewer_client.put("/flags/locked/environments/staging", json={"enabled": True}),
        viewer_client.post("/environments", json={"key": "qa", "name": "QA"}),
        viewer_client.put("/environments/staging", json={"name": "Renamed"}),
        viewer_client.put(
            "/environments/staging/user-groups",
            json={"group_key": "beta", "user_ids": ["a@b.c"]},
        ),
        viewer_client.post("/cleanup/locked/review", json={}),
        viewer_client.get("/auth/users"),
        viewer_client.post(
            "/auth/users", json={"email": "new@example.com", "password": "password123"}
        ),
    ]

    for response in forbidden:
        assert response.status_code == 403, f"{response.request.method} {response.request.url}"

    # And nothing actually changed.
    assert crud_module.get_flag_by_key(db_session, "locked").enabled is True


# ---------- user administration ----------


def test_admin_can_create_and_list_users(client):
    created = client.post(
        "/auth/users",
        json={
            "email": "New.Person@Example.com",
            "password": "another-password",
            "name": "New Person",
            "role": "viewer",
        },
    )
    assert created.status_code == 201
    # Emails are normalised, so the same address can't be registered twice in
    # different cases.
    assert created.json()["email"] == "new.person@example.com"

    emails = [user["email"] for user in client.get("/auth/users").json()]
    assert "new.person@example.com" in emails


def test_duplicate_email_is_rejected(client):
    payload = {"email": "dupe@example.com", "password": "a-password-1"}
    assert client.post("/auth/users", json=payload).status_code == 201
    assert client.post("/auth/users", json=payload).status_code == 409
    # Including in a different case.
    assert client.post("/auth/users", json={**payload, "email": "DUPE@example.com"}).status_code == 409


def test_short_passwords_are_rejected(client):
    response = client.post("/auth/users", json={"email": "weak@example.com", "password": "abc"})
    assert response.status_code == 422


def test_a_new_user_can_sign_in(anon_client, client):
    client.post(
        "/auth/users",
        json={"email": "fresh@example.com", "password": "fresh-password", "role": "admin"},
    )

    response = anon_client.post(
        "/auth/login", json={"email": "fresh@example.com", "password": "fresh-password"}
    )
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "admin"


def test_admin_cannot_deactivate_their_own_account(client, admin_user):
    response = client.put(f"/auth/users/{admin_user.id}", json={"is_active": False})
    assert response.status_code == 400
    assert "your own account" in response.json()["detail"]


def test_the_last_admin_cannot_be_demoted(client, admin_user):
    response = client.put(f"/auth/users/{admin_user.id}", json={"role": "viewer"})
    assert response.status_code == 400
    assert "last active admin" in response.json()["detail"]


def test_an_admin_can_be_demoted_once_another_exists(client, admin_user):
    client.post(
        "/auth/users",
        json={"email": "second@example.com", "password": "second-password", "role": "admin"},
    )

    response = client.put(f"/auth/users/{admin_user.id}", json={"role": "viewer"})
    assert response.status_code == 200
    assert response.json()["role"] == "viewer"


def test_changing_your_own_password(anon_client, client):
    changed = client.post(
        "/auth/me/password",
        json={"current_password": "admin-password", "new_password": "a-brand-new-password"},
    )
    assert changed.status_code == 200

    assert (
        anon_client.post(
            "/auth/login", json={"email": ADMIN, "password": "admin-password"}
        ).status_code
        == 401
    )
    assert (
        anon_client.post(
            "/auth/login", json={"email": ADMIN, "password": "a-brand-new-password"}
        ).status_code
        == 200
    )


def test_changing_password_requires_the_current_one(client):
    response = client.post(
        "/auth/me/password",
        json={"current_password": "not-my-password", "new_password": "a-brand-new-password"},
    )
    assert response.status_code == 400


def test_user_changes_are_audited_without_leaking_the_password(client):
    client.post(
        "/auth/users",
        json={"email": "audited@example.com", "password": "audited-password", "role": "viewer"},
    )

    entries = client.get("/audit-log?entity_type=user").json()
    created = next(entry for entry in entries if entry["action"] == "created")

    assert created["actor"] == ADMIN
    assert created["entity_key"] == "audited@example.com"
    assert created["after_state"]["role"] == "viewer"

    serialized = str(entries)
    assert "audited-password" not in serialized
    assert "password_hash" not in serialized
    assert "$2b$" not in serialized


# ---------- bootstrap ----------


def test_bootstrap_creates_the_first_admin_only_once(db_session):
    assert crud.count_users(db_session) == 0

    created = crud.ensure_bootstrap_admin(db_session)
    assert created is not None
    assert created.role == models.UserRole.admin

    # A second call must not create another, or reset the first one's password.
    assert crud.ensure_bootstrap_admin(db_session) is None
    assert crud.count_users(db_session) == 1


def test_bootstrap_does_not_run_when_users_already_exist(db_session, viewer_user):
    """Even if every existing account is a viewer — silently minting an admin
    would be a back door."""
    assert crud.ensure_bootstrap_admin(db_session) is None
    assert crud.count_users(db_session) == 1
