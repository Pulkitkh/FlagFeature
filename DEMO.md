# Demo walkthrough

A 12–15 minute script covering every feature built across the three milestones.
Each step says what to do, what to point at, and why it matters.

## Before you start

```bash
docker compose up --build          # Postgres + Redis + API on :8000
cd frontend && npm install && npm run dev   # dashboard on :5173
```

Have three terminals ready: the API, the dashboard, and a spare for `curl`.
Open the dashboard at `http://localhost:5173` and the API docs at
`http://localhost:8000/docs`.

Start from an empty database — the story is better when the audience watches
the data appear.

---

## Signing in (≈1 min)

**0. The login screen.** Open the dashboard and you land on it — nothing is
reachable without an account. Sign in as `admin@flagforge.local` /
`admin12345`.

Say: *"Everything you're about to see is attributed. The audit log's actor
comes from the signed-in user's token, not a header — it can't be forged."*

Worth showing: open the user menu, point at the **Admin** badge, then mention
there's a **viewer** role that can read everything and change nothing. If
you've got a minute spare, sign in as a viewer in a private window — the
Create flag button and the Accounts page simply aren't there, and the API
returns 403 even if you go around the UI.

---

## Milestone 1 — foundation (≈3 min)

**1. The shell.** Point at the sidebar (Flags, Environments, User groups, Audit
log) and the environment switcher in the top bar. Say: *"Every page reacts to
that switcher — it's the backbone of the whole system."*

**2. Health.** `curl localhost:8000/health` →
`{"status":"ok","database":"connected","redis":"connected"}`.

**3. Create a flag.** Flags → **Create flag**:
- key `new-checkout-flow`, type Boolean, default `false`
- owner `growth`, description "Express checkout with saved cards"

Show it appear in the table, then click into it.

**4. The detail page.** Point at type, default, owner, global status, and the
"Resolved in Development" card showing `false` / `default_value`.

> Why it matters: the evaluation engine is the product. Everything else exists
> to configure what it returns.

---

## Milestone 2 — targeting and rollouts (≈5 min)

**5. Seed a group.** User groups → group key `beta_users`, users
`carol@example.com, dan@example.com` → Save.

**6. User targeting.** Back on the flag, add `alice@example.com` to the user
whitelist → Save targeting rules. In the **evaluation test panel** type
`alice@example.com` → resolves `true`, *"Resolved by user_targeting"*.

**7. Group targeting.** Click `beta_users` in the group panel → Save. Test
`carol@example.com` → `true`, *"group_targeting"*. Then type `beta_users` into
**Test groups** with a made-up user — also `true`, without touching the
membership table.

**8. Percentage rollout.** Drag the slider to 50% → Save. Try a few user IDs in
the test panel; roughly half come back `true`, and the same ID always gives the
same answer. Say: *"That's a hash of user_id + flag_key — a user never flips
back and forth as you move the slider."*

**9. Environment override.** Switch the top bar to **Production**. Note the
targeting panel is empty — rules are per environment. Hit **Turn off here**,
then switch back to Development and show it's still on.

**10. Caching.** Evaluate the same user twice: the badge goes **Live** → **Cached**.
Now change a rule and evaluate again — **Live**. Say: *"Any change clears that
flag's cache immediately, so the cache can never serve a stale decision."*

**11. Priority order.** Point at the strip above the rules:
`user IDs → groups → percentage → environment override → default`. That order
is asserted end-to-end in `test_rule_priority_order_end_to_end`.

---

## Milestone 3 — audit, analytics, cleanup, middleware (≈5 min)

**12. Audit log.** Open Audit log. Every step so far is on the record, newest
first, with actor, entity, action and a one-line summary of what changed.

Click **View diff** on the targeting change: field-by-field before/after, plus
the raw JSON either side. Say: *"This is how you answer 'who changed this flag,
and to what?' — not just that something changed."*

**13. Audit filters.** Filter by flag key `new-checkout-flow`; by action
`disabled`; by a date range. Tick **Only Development** to scope it to the
environment.

**14. Analytics.** Generate some traffic:

```bash
for i in $(seq 1 50); do
  curl -s -X POST localhost:8000/evaluate \
    -H 'Content-Type: application/json' \
    -d "{\"flag_key\":\"new-checkout-flow\",\"environment_key\":\"development\",\"user_context\":{\"user_id\":\"user-$i\"}}" > /dev/null
done
```

Reload the flag detail page → the **Evaluation volume** chart shows today's
bar. Toggle 7 / 30 days and All envs / Development. Say: *"Counts go to Redis
on the hot path — one INCR, no database write per evaluation — and a daily job
flushes them into Postgres. The chart merges both, so today is live."*

```bash
cd backend && python -m scripts.flush_analytics
```

**15. Cleanup suggestions.** On the Flags page, point at the **Cleanup
suggestions** panel. Explain the rule: a flag qualifies only when it resolves
*the same way for everyone in every environment* and hasn't changed in N days.
Anything still selective is excluded, because it's still doing real work.

Show a suggestion's staleness and evaluation count, then **Mark reviewed** — it
disappears from the list.

> Why it matters: this closes the loop on a flag's lifecycle. Flags left in
> code forever are the technical debt feature flags are famous for.

**16. The middleware.** This is the part that proves the system works outside
the dashboard.

```bash
cd examples/fastapi_app
pip install -e ../../sdk fastapi uvicorn
uvicorn main:app --port 9000
```

```bash
curl "localhost:9000/checkout?user_id=carol@example.com"
# {"checkout":"express","flag_value":true,"resolved_by":"group_targeting"}
```

Say: *"That handler made no HTTP call. The client holds the whole environment
in memory and refreshes in the background — 2.6µs per check versus 4.9ms for a
round trip, about 1,800× faster."*

Then the resilience demo: **stop the FlagForge API** and curl again. It still
answers from the last snapshot. `curl localhost:9000/health` shows
`last_error` set and `seconds_since_refresh` climbing.

> Why it matters: a flag service being down must never take the application
> down with it.

---

## Closing (≈2 min)

**17. Tests.**

```bash
cd backend && pytest -q     # 120 passed
```

Call out four:
- `test_viewer_cannot_change_anything` — every write path is tried as a viewer
  and every one returns 403.
- `test_local_evaluation_matches_the_server` — the SDK reimplements the rules,
  so a contract test runs a matrix of flags × contexts through both paths and
  asserts value *and* reason match.
- `test_full_path_create_target_evaluate_cache_audit_analytics` — one test that
  walks create → target → evaluate → cache → invalidate → audit → analytics.
- `test_disabled_flag_always_returns_false` — the kill switch outranks every
  rule stacked against it.

**18. Load test.**

```bash
python scripts/load_test.py --requests 2000 --concurrency 16
```

Point at the split between cache hits and misses.

**19. Migrations.** `alembic history` — the schema is versioned, and an
existing database adopts migrations with `alembic stamp 0001`.

## Questions worth pre-empting

**"What happens if Redis goes down?"** Evaluation still works — the cache and
the analytics counter are both best-effort and fall through to the database.
`/health` reports Redis as unavailable.

**"How does a user not flip in and out of a rollout?"** The bucket is
`sha256(user_id + ":" + flag_key)`, so it's stable for a given user and flag
regardless of the percentage. Widening a rollout only ever adds users — there's
a test for exactly that.

**"Who can change flags?"** Admins. Viewers can read everything and change
nothing, enforced server-side. The audit actor comes from the verified token,
so it can't be spoofed.

**"What are the limits of the auth?"** Be upfront: tokens can't be revoked
individually (deactivating an account blocks it on the next request), there are
no refresh tokens, login isn't rate-limited, and the token lives in
`localStorage`. All reasonable for an internal tool, all listed in the README.

**"How fresh is the middleware's data?"** Up to `refresh_interval` seconds
(default 30) — the deliberate cost of not making a network call per check. For
an instant kill switch, call `POST /evaluate` directly.
