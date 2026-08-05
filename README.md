# FlagForge — Feature Flag Management Platform

A feature flag platform: create flags, target them by user/group/percentage,
flip them per environment without a deploy, see every change in an audit trail
with a JSON diff, track how often each flag is actually evaluated, and get told
which flags are safe to delete. Ships with a Python middleware client so real
applications can consume it without an HTTP call per flag check.

All three milestones are complete.

## Stack

- **Backend:** FastAPI, SQLAlchemy, PostgreSQL, Redis
- **Frontend:** React (Vite), React Router, Tailwind CSS, Recharts
- **Tests:** Pytest — evaluation-engine unit tests plus end-to-end API tests
  through FastAPI's `TestClient`, on in-memory SQLite and a fake Redis, so the
  suite runs with no external services

## Project structure

```
flagforge/
├── sdk/                         # the Python middleware applications install
│   └── flagforge/
│       ├── client.py            # in-memory cache + background refresh
│       ├── evaluator.py         # local evaluation, same rules as the server
│       └── integrations/        # FastAPI and Django glue
├── examples/                    # runnable FastAPI and Django demo apps
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, /health
│   │   ├── config.py          # env-var settings
│   │   ├── database.py        # SQLAlchemy engine/session
│   │   ├── redis_client.py
│   │   ├── models.py          # environments, flags, flag_versions,
│   │   │                      # targeting_rules, user_group_memberships, audit_log
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── crud.py            # DB operations + audit logging
│   │   ├── evaluation.py      # core evaluation engine
│   │   └── routers/
│   │       ├── environments.py
│   │       ├── flags.py
│   │       └── evaluation.py
│   ├── alembic/               # versioned schema migrations
│   ├── scripts/
│   │   ├── flush_analytics.py # Redis counters -> Postgres (run daily)
│   │   └── load_test.py       # latency of /evaluate, split by cache hit/miss
│   ├── tests/
│   │   ├── test_evaluation.py # evaluation-engine unit tests
│   │   ├── test_api.py        # HTTP tests: CRUD, errors, targeting, caching
│   │   ├── test_milestone3.py # audit diffs, analytics, cleanup, full path
│   │   └── test_middleware.py # SDK behaviour + SDK-vs-server contract
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/              # Dashboard, Flags, FlagDetail, Environments,
│   │   │                       # Groups, AuditLog
│   │   ├── components/
│   │   │   ├── ui/             # design-system primitives (Button, Card, Modal…)
│   │   │   └── charts/         # Recharts wrappers + the shared palette hook
│   │   ├── context/            # environment, theme and toast providers
│   │   └── api/client.js
│   └── package.json
└── docker-compose.yml           # Postgres + Redis + backend for local dev
```

## Data model (Day 2)

| Table | Purpose |
|---|---|
| `environments` | development / staging / production, etc. |
| `flags` | key, type, default value, global enabled flag, owner |
| `flag_versions` | snapshot of a flag on every create/update (basic version history) |
| `targeting_rules` | per-environment rules: `user_targeting`, `group_targeting`, `percentage_rollout`, and `environment_override` all share this table |
| `user_group_memberships` | which users belong to which group, per environment |
| `audit_log` | every change, with actor, before/after state and a JSON diff |
| `flag_evaluation_stats` | hourly evaluation counts, flushed out of Redis |
| `flag_cleanup_reviews` | stale-flag suggestions somebody has signed off |
| `users` | dashboard accounts: email, bcrypt hash, role, active flag |

Indexes on `flags.key` and the `environment_id` foreign keys keep the
lookups that happen on every evaluation call fast.

## Evaluation engine

`evaluate_flag(db, flag_key, environment_key, user_context)`:

1. Flag must exist, else `FlagNotFoundError`.
2. If the flag is globally disabled → resolves to `False` (or, for a string/number flag, to its default, since `False` isn't a valid value of that type).
3. Environment must exist, else `EnvironmentNotFoundError` — checked before the kill switch, so a bad environment key is never masked by a disabled flag.
4. **User targeting** — if `user_context.user_id` is on the flag's whitelist for this environment → resolves to the rule's value.
5. **Group targeting** — if the user belongs to one of the flag's targeted groups → resolves to the rule's value. Membership comes from the `user_group_memberships` table, plus any groups passed inline on the request (which is what the dashboard's test panel uses).
6. **Percentage rollout** — the user is hashed (SHA-256 of `user_id:flag_key`) into a stable 0–100 bucket; if it falls under the configured percentage → resolves to the rule's value. Same user always lands in the same bucket for a given flag, so rollout status doesn't flap as the percentage changes.
7. **Environment override** — an explicit on/off (or pinned value) set for this environment wins if nothing above matched.
8. **Default value** — the flag's own `default_value`, if nothing else applied.

Results are cached in Redis (keyed by flag + environment + a hash of the
user context) for 60s, and the cache is invalidated immediately whenever the
flag, its targeting rules, or its environment override change.

A matched rule serves `True` for boolean flags; string and number flags serve
the value configured on the rule, so "enabled for `beta_users`" can mean
"`beta_users` see `variant-b`". The API rejects a value that doesn't match the
flag's declared type.

Test coverage (33 tests, `pytest -q`):

- `test_evaluation.py` — each priority level individually, the full ordering
  together, kill-switch precedence over every rule, typed targeting values,
  inline context groups, empty/missing user context, and unknown
  flag/environment errors.
- `test_api.py` — flag and environment CRUD over HTTP, the error contract
  (404 / 409 / 422), rule priority end to end, rollout stability as a
  percentage widens, group-membership management, cache hits, cache
  invalidation after every kind of change, per-user cache isolation, the audit
  log, and the overview aggregates.

## Authentication

The dashboard sits behind a login. Admin endpoints require a bearer token;
`/evaluate`, `/snapshot` and `/health` stay public so the middleware SDK and
consuming applications keep working without credentials.

### Signing in the first time

On first start, when the users table is empty, a single admin is created:

| | |
|---|---|
| Email | `admin@flagforge.local` |
| Password | `admin12345` |

**Change it once you're in** (user menu → Change password), or set
`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` before the first start.
The bootstrap only ever runs against an empty users table, so it can't
resurrect an account you deliberately removed.

### Roles

| Role | Can |
|---|---|
| **admin** | Everything: create and change flags, targeting, environments, groups, cleanup reviews and accounts |
| **viewer** | Read everything — flags, analytics, the audit log — and change nothing |

Roles are enforced on the server. The dashboard hides what a viewer can't do,
but the API returns 403 regardless of what the UI shows.

### Who changed what

The audit log's actor is taken from the verified token, not from a header. It
cannot be forged by whoever calls the API — there's a test for exactly that
(`test_audit_actor_comes_from_the_token_not_a_header`).

The one exception is the bootstrap admin's own creation row, recorded as
`system`, because nobody was signed in when it happened.

### Configuration

| Variable | Default | Notes |
|---|---|---|
| `JWT_SECRET` | a development placeholder | **Set this.** Anyone who knows it can mint valid tokens |
| `ACCESS_TOKEN_MINUTES` | `720` (12 hours) | How long a session lasts |
| `BOOTSTRAP_ADMIN_EMAIL` | `admin@flagforge.local` | First admin, created only on an empty database |
| `BOOTSTRAP_ADMIN_PASSWORD` | `admin12345` | Same |

The app logs a warning at startup if either default is still in use.

### What this is not

Worth being straight about the limits, since it's an obvious question:

- **Tokens can't be revoked individually.** Deactivating an account blocks it on
  the next request, which is the practical equivalent, but a stolen token stays
  valid until it expires. A token version column or a deny-list would fix it.
- **No refresh tokens.** When a session expires you sign in again.
- **No rate limiting on login.** Passwords are bcrypt-hashed (cost 12) so
  guessing is slow, and failures don't reveal whether an email exists, but a
  determined attacker isn't throttled.
- **The token is in `localStorage`,** which is readable by any script running on
  the page. That's a reasonable trade for an internal admin tool; a
  `Secure; HttpOnly` cookie would be stronger.

## Dashboard pages

| Page | What it does |
|---|---|
| **Landing** (`/`, public) | What the product does, and the way in to the sign-in screen |
| **Flags** | Searchable/filterable flag table, create form, and the cleanup-suggestions panel |
| **Flag detail** | Full configuration, per-environment resolution, targeting rule panel (user / group / percentage), evaluation test panel, evaluation-volume chart, and version history |
| **Environments** | All environments, plus how a chosen flag resolves in each one |
| **User groups** | Group memberships per environment, targetable from any flag |
| **Audit log** | Filterable table of every change, with a JSON diff modal |
| **Accounts** (admin) | Add people, set their role, reset passwords, deactivate access |

The environment switcher in the top bar drives every page: targeting rules,
group memberships, the analytics chart's environment scope, and the audit log's
optional environment filter.

Every chart is single-series and uses one validated hue, so identity never
rests on colour. The hue changes with the theme — the darker blue on light
backgrounds, the lighter one on dark.

### Theme and language

Both preferences sit in the top bar, and on the landing and sign-in screens too,
since someone who can't read English needs the language picker *before* signing
in rather than after.

- **Theme** — light, dark, or **System**, which keeps following the OS. Colours
  are CSS custom properties swapped on `<html data-theme>`; the light palette is
  byte-for-byte what it was before dark mode existed.
- **Languages** — 46 of them: English, 16 spoken across India, and 29 more.
  Searchable by either the language's own name or its English one. Arabic,
  Urdu, Persian and Hebrew render right-to-left.

**Every user-facing string on every page** goes through the translation
layer — navigation, page headers, table columns, buttons, form labels, hints,
empty states, error messages and modals. What stays English in every locale is
the data underneath: flag keys, `boolean`/`true`/`false`, JSON payloads, reason
codes like `percentage_rollout`, and paths like `POST /evaluate`. Translating
those would make the console misreport what the API actually stores.

English, Hindi and Bengali are complete (308 keys). The other 43 locales carry
the shell and fall back to English for the rest, so a partially translated
locale degrades into a readable mixed interface rather than a broken one —
`npm run check:i18n` prints the split so partial coverage never looks like full
coverage. Filling one in is data entry, not code.

`cd frontend && npm run check:i18n` runs two checks: the catalogue invariants
(no invented keys, no empty strings, correct locale resolution, no drift with
the pre-paint script) and a scanner that fails the build on any user-facing
string still hardcoded in JSX. The second one exists because the first pass at
i18n translated the navigation and stopped, and nothing caught it.

## Audit log (Milestone 3)

Every create, update, enable, disable, delete, targeting change and environment
override writes a row carrying:

- **actor** — taken from the `X-Actor` request header. The dashboard sends
  `dashboard`; scripts send their own name; anything that sends nothing is
  recorded as `system`. When real authentication lands, `app/deps.py` is the
  only place that changes.
- **before / after state** and a **field-level diff** of just what moved.
- the **environment** and the **entity key** (the flag key, not a database id),
  so the log can be filtered by the thing people actually name.

Flipping only the kill switch is recorded as `enabled` / `disabled` rather than
a vague `updated`.

`GET /audit-log` filters by `actor`, `entity_key`, `entity_type`, `action`,
`environment_key`, `start` and `end`. The dashboard exposes all of them and a
"view diff" modal that shows the before/after per field plus the raw JSON.

## Evaluation analytics (Milestone 3)

Every successful `/evaluate` bumps a Redis counter keyed by flag + environment
+ hour. Redis absorbs the write volume (one `INCR`, no database round trip on
the hot path) and a daily job moves the counters into Postgres:

```bash
cd backend
python -m scripts.flush_analytics          # run from cron / a scheduled job
python -m scripts.flush_analytics --keep-counters   # dry run
```

Reads merge both sources, so today's bar is live rather than stuck at zero
until the nightly flush. `GET /flags/{key}/analytics?days=7|30` powers the chart
on the flag detail page, optionally scoped to one environment.

Analytics never breaks evaluation: if Redis is unavailable the counter is
skipped and the evaluation still returns.

## Cleanup suggestions (Milestone 3)

A flag that has been at 100% everywhere for months isn't a flag any more — it's
a branch nobody deleted. `GET /cleanup/suggestions?stale_days=30` lists flags
that resolve **the same way for everyone in every environment** and haven't
changed in that long:

- **fully rolled out** — 100% rollout or forced on, in every environment
- **fully off** — globally disabled, or forced off everywhere

Anything still selective (a user whitelist, a targeted group, a rollout between
1% and 99%) is excluded: it's still doing real work. Each suggestion reports how
long it has been stale and how many evaluations it has served, and can be marked
reviewed so it drops off the list.

## Python middleware (Milestone 3)

Applications consume FlagForge through the client in [`sdk/`](sdk), which
caches the environment's whole configuration in memory and evaluates locally:

```python
from flagforge import FlagForgeClient

flags = FlagForgeClient(api_url="http://localhost:8000", environment="production")
flags.start()

if flags.is_enabled("new-checkout-flow", user_id="alice@example.com"):
    ...
```

Measured locally: **2.6µs per evaluation vs 4.9ms via `POST /evaluate`**. It
keeps serving the last snapshot when the API is unreachable, and the caller's
default when it has never reached it at all.

Because that means the rules are implemented twice, a contract test
(`test_middleware.py::test_local_evaluation_matches_the_server`) runs a matrix
of flags × user contexts through both the SDK and the API and asserts the value
*and* the reason match.

See [`sdk/README.md`](sdk/README.md) and the runnable FastAPI and Django apps in
[`examples/`](examples).

## Running locally

### Option A — Docker (recommended, matches how it'll deploy)

```bash
docker compose up --build
```

This starts Postgres, Redis, and the backend on `http://localhost:8000`.
Then, in a second terminal, run the frontend:

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:5173`.

### Option B — No Docker (SQLite, zero setup)

The backend works with SQLite too — useful if you don't want to install
Postgres/Redis locally.

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
DATABASE_URL="sqlite:///./flagforge.db" uvicorn app.main:app --reload
```

### Migrations

Under Docker this is automatic: the backend container runs
`python -m scripts.migrate` before uvicorn starts, so the schema is current
before the first request is served. `AUTO_CREATE_TABLES=false` is set there,
making Alembic the single source of truth.

Running the backend directly, the app still creates its tables on startup for
convenience. To manage the schema properly:

```bash
cd backend
python -m scripts.migrate       # what the container runs — safe on any database
alembic upgrade head            # equivalent for an already-managed database
alembic downgrade -1            # step back one revision
alembic history                 # what exists
```

`scripts/migrate.py` handles three cases: an empty database, an
Alembic-managed one, and one that has tables but has never seen Alembic. That
last case is what every database built by the old `create_all` startup path
looks like — it detects which schema is present, stamps that revision, and
upgrades from there. Existing data is preserved.

#### If you see `column audit_log.entity_key does not exist`

Your database predates Milestone 3 and was never migrated. `create_all` adds
*missing tables* but never alters an existing one, so `audit_log` kept its old
columns while the new tables appeared alongside it. Rebuild the backend
container — the entrypoint repairs the schema in place, keeping your flags,
environments and history:

```bash
docker compose up -d --build backend
```

Running without Docker, do the same thing directly:

```bash
cd backend && python -m scripts.migrate
```

Nothing needs to be dropped or recreated. `tests/test_migrations.py` covers
both the legacy and half-upgraded shapes so this can't regress.

#### If the backend container restart-loops with `exec ./entrypoint.sh: no such file or directory`

The file is there — its line endings aren't. A checkout on Windows converts
`entrypoint.sh` to CRLF, which makes the shebang `#!/bin/sh\r`: an interpreter
that doesn't exist, reported as a missing file.

`.gitattributes` now pins shell scripts to LF, and the Dockerfile strips any
carriage returns during the build, so a fresh clone and rebuild fixes it:

```bash
git pull
docker compose build --no-cache backend
docker compose up -d
```

If you'd rather not re-clone, normalising the existing working tree does the
same job:

```bash
git rm --cached -r . && git reset --hard
```

Redis is optional for this option — `/health` will just report it as
`unavailable`, and evaluation falls back to computing results live instead
of serving them from cache.

### Running tests

```bash
cd backend
pip install -r requirements.txt
pytest -q
```

No Postgres or Redis needed — the suite uses in-memory SQLite and an in-memory
Redis stand-in.

### Load test

With the API running:

```bash
cd backend
python scripts/load_test.py --requests 2000 --concurrency 16
```

It reports p50/p95/p99 split by cache hit and miss. On a local SQLite setup a
cached evaluation runs at roughly half the latency of an uncached one; note
that a cache hit still costs two small queries (the flag and the environment)
because the cache key is scoped to the flag's `updated_at`, which is what makes
invalidation safe.

## API quick reference

Every endpoint below requires a bearer token except `/health`, `/evaluate`,
`/snapshot/{env_key}` and `/auth/login`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | server + DB + Redis status (public) |
| POST | `/auth/login` | email + password → bearer token (public) |
| GET | `/auth/me` | the signed-in account |
| POST | `/auth/me/password` | change your own password |
| GET/POST | `/auth/users` | list / create accounts (admin) |
| PUT | `/auth/users/{id}` | change role, deactivate, reset password (admin) |
| GET/POST | `/environments` | list / create environments |
| PUT | `/environments/{key}` | rename an environment |
| GET/PUT | `/environments/{key}/user-groups` | list / upsert group memberships for an environment |
| DELETE | `/environments/{key}/user-groups/{group_key}/{user_id}` | remove one user from a group |
| GET/POST | `/flags` | list / create flags |
| GET/PUT/DELETE | `/flags/{key}` | read / update / delete a flag |
| GET | `/flags/{key}/versions` | version history |
| PUT | `/flags/{key}/environments/{env_key}` | set an environment override |
| GET/PUT | `/flags/{key}/targeting/{env_key}` | read / set user, group, and percentage targeting rules |
| POST | `/evaluate` | resolve a flag's value for an environment |
| GET | `/audit-log` | activity, filterable by actor / entity_key / entity_type / action / environment_key / start / end |
| GET | `/audit-log/actors` | distinct actors, for the filter dropdown |
| GET | `/overview` | dashboard aggregates: totals, rule mix, per-environment coverage, 14-day activity |
| GET | `/flags/{key}/analytics` | evaluations per day (`days`, optional `environment_key`) |
| GET | `/cleanup/suggestions` | flags safe to delete (`stale_days`, `include_reviewed`) |
| POST/DELETE | `/cleanup/{key}/review` | mark a suggestion reviewed / undo it |
| GET | `/snapshot/{env_key}` | full configuration for one environment — what the middleware polls |

Mutating endpoints require an admin token; read endpoints accept any signed-in
account. The audit log records the token's subject as the actor.

Interactive docs are auto-generated at `/docs` (Swagger) once the backend is running.

## Deploying

Since this needs to be reachable for review/demo, not just run locally:

**Backend + Postgres + Redis → Render or Railway**
1. Push this repo to GitHub.
2. On Render: create a **PostgreSQL** instance and a **Redis** instance (both have free tiers), then a **Web Service** pointing at `backend/` with the existing `Dockerfile`.
3. Set `DATABASE_URL` and `REDIS_URL` env vars on the web service to the values Render gives you for the DB/Redis instances, and set `CORS_ORIGINS` to your deployed frontend URL.
4. Railway works the same way: add Postgres + Redis plugins, deploy `backend/` as a service, wire up the same env vars.

**Frontend → Vercel or Netlify**
1. Import the repo, set the project root to `frontend/`.
2. Build command `npm run build`, output directory `dist`.
3. Set env var `VITE_API_URL` to your deployed backend URL.



