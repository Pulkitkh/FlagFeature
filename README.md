<<<<<<< HEAD
# FlagForge — Feature Flag Management Platform

A feature flag platform: create flags, flip them per environment without a
deploy, and see every change in an audit trail. This repo covers **Milestone
1** — database schema, evaluation engine, and a working create/view flow
end-to-end (backend + frontend + live API).

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
| `targeting_rules` | per-environment rules; Milestone 1 uses `rule_type="environment_override"` to flip a flag on/off (or pin a value) per environment. The generic shape leaves room for Milestone 2's percentage rollout / user-group rules without a schema change |
| `user_group_memberships` | reserved for Milestone 2 targeting |
| `audit_log` | every create / update / delete / toggle |

Indexes on `flags.key` and the `environment_id` foreign keys keep the
lookups that happen on every evaluation call fast.

## Evaluation engine (Day 4/5)

`evaluate_flag(db, flag_key, environment_key, user_context)`:

1. Flag must exist, else `FlagNotFoundError`.
2. If the flag is globally disabled → always resolves to `False`.
3. Environment must exist, else `EnvironmentNotFoundError`.
4. If an environment override exists → it wins (off, or a pinned value).
5. Otherwise → the flag's `default_value`.

The 4 required test cases live in `backend/tests/test_evaluation.py` and all pass:
default-value fallback, environment override, global-disable precedence, and
safe handling of an empty/missing user context.

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
`unavailable`, everything else still works (Redis isn't on the evaluation
hot path yet in Milestone 1; it's wired up for Milestone 2 caching).

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
| GET/POST | `/flags` | list / create flags |
| GET/PUT/DELETE | `/flags/{key}` | read / update / delete a flag |
| GET | `/flags/{key}/versions` | version history |
| PUT | `/flags/{key}/environments/{env_key}` | set an environment override |
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

## What's next (Milestone 2, not in this repo yet)

- Real targeting rules: percentage rollout, user-group membership checks
- Redis caching of evaluation results on the hot path
- Auth / roles for who can toggle what

