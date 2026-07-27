# FlagForge — Feature Flag Management Platform

A feature flag platform: create flags, target them by user/group/percentage,
flip them per environment without a deploy, and see every change in an audit
trail. This repo covers **Milestones 1 and 2** — schema, evaluation engine
(with caching), and the full targeting/rollout UI, backend + frontend + live
API.

## Stack

- **Backend:** FastAPI, SQLAlchemy, PostgreSQL, Redis
- **Frontend:** React (Vite), React Router, Tailwind CSS, Recharts
- **Tests:** Pytest — evaluation-engine unit tests plus end-to-end API tests
  through FastAPI's `TestClient`, on in-memory SQLite and a fake Redis, so the
  suite runs with no external services

## Project structure

```
flagforge/
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
│   ├── tests/
│   │   ├── test_evaluation.py # evaluation-engine unit tests
│   │   └── test_api.py        # end-to-end HTTP tests: CRUD, errors,
│   │                          # targeting, rollout, caching, overview
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
| `audit_log` | every create / update / delete / toggle |

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

## Dashboard

The console opens on a dashboard that reads from `GET /overview`:

- **Stat tiles** — flag count and enabled/disabled split, environments, active
  rules in the selected environment, and changes today.
- **Configuration activity** — an area chart of every flag, rule and override
  change over the last 14 days.
- **Flag health** — a meter for the enabled share, a per-type breakdown, and a
  bar chart of the rule mix in the selected environment.
- **Environment coverage** — how many flags carry a targeting rule or override
  in each environment, with average rollout percentages.

Chart colours are a validated two-slot palette (blue, orange) that clears the
colourblind-separation and contrast checks against both the light and dark
chart surfaces. Every chart is single-series with direct labels, so identity
never rests on colour alone.

## Theming and accessibility

- Light and dark themes, each a deliberately chosen set of tokens rather than
  an inverted copy. The choice is stored and applied before first paint, so a
  reload never flashes the wrong theme.
- Full keyboard support: the environment switcher and every dropdown handle
  arrows, Home/End, Enter and Escape; dialogs trap Escape, lock body scroll and
  move focus inside; table rows are reachable and activatable by keyboard.
- Visible focus rings throughout, `aria-*` on switches, meters and listboxes,
  and a `prefers-reduced-motion` block that disables all animation.
- Responsive from 320px up: the sidebar becomes a drawer below `lg`, tables
  scroll horizontally rather than forcing the page to.

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

## API quick reference

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | server + DB + Redis status |
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
| GET | `/audit-log` | recent activity |
| GET | `/overview` | dashboard aggregates: totals, rule mix, per-environment coverage, 14-day activity |

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



