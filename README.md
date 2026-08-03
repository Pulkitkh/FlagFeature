# FlagForge — Feature Flag Management Platform

A feature flag platform: create flags, target them by user/group/percentage,
flip them per environment without a deploy, and see every change in an audit
trail. This repo covers **Milestones 1 and 2** — schema, evaluation engine
(with caching), and the full targeting/rollout UI, backend + frontend + live
API.

## Stack

- **Backend:** FastAPI, SQLAlchemy, PostgreSQL, Redis
- **Frontend:** React (Vite), React Router, Tailwind CSS
- **Tests:** Pytest (evaluation engine, SQLite in-memory — no external deps needed)

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
│   │   └── test_evaluation.py # the 4 required evaluation-engine cases
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/              # Flags, FlagDetail, Environments, AuditLog
│   │   ├── components/         # Sidebar, Navbar, EnvironmentSwitcher, FlagTable, FlagForm
│   │   ├── context/             # selected-environment state
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
2. If the flag is globally disabled → always resolves to `False`.
3. Environment must exist, else `EnvironmentNotFoundError`.
4. **User targeting** — if `user_context.user_id` is on the flag's whitelist for this environment → resolves `True`.
5. **Group targeting** — if the user belongs to one of the flag's targeted groups → resolves `True`.
6. **Percentage rollout** — the user is hashed (SHA-256 of `user_id:flag_key`) into a stable 0–100 bucket; if it falls under the configured percentage → resolves `True`. Same user always lands in the same bucket for a given flag, so rollout status doesn't flap as the percentage changes.
7. **Environment override** — an explicit on/off (or pinned value) set for this environment wins if nothing above matched.
8. **Default value** — the flag's own `default_value`, if nothing else applied.

Results are cached in Redis (keyed by flag + environment + a hash of the
user context) for 60s, and the cache is invalidated immediately whenever the
flag, its targeting rules, or its environment override change.

Test coverage in `backend/tests/test_evaluation.py` (9 tests) checks each
priority level individually, the full priority ordering together, global
disable precedence, unknown flag/environment errors, and safe handling of an
empty/missing user context.

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
pytest tests/ -v
```

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



