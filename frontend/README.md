# FlagForge dashboard

React admin console for the FlagForge API: create flags, target users and
groups, roll out gradually, flip behaviour per environment, read the audit
trail, and see which flags are safe to delete.

## Run it

```bash
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000
npm run dev                 # http://localhost:5173
```

The backend must be running first — see the [root README](../README.md).

```bash
npm run build               # production bundle into dist/
npm run preview             # serve that bundle locally
```

## Pages

| Route | What it does |
|---|---|
| `/login` | Sign in. Everything else redirects here without a session |
| `/flags` | Flag table with search, status filter and sort, the create form, and the cleanup-suggestions panel |
| `/flags/:key` | Configuration, per-environment resolution, targeting rules, evaluation test panel, evaluation-volume chart, version history |
| `/environments` | All environments, and how a chosen flag resolves in each |
| `/groups` | Group memberships for the selected environment |
| `/audit-log` | Filterable table of every change, with a JSON diff modal |
| `/accounts` | Admin only: add people, set roles, reset passwords, deactivate |

## How it's put together

- `src/api/client.js` — the single place that talks to the API. It attaches the
  bearer token to every request, clears it and bounces to the login screen on a
  401, unwraps FastAPI validation errors into readable messages, and encodes
  query parameters properly (an ISO timestamp's `+` would otherwise arrive as a
  space).
- `src/context/AuthContext.jsx` — the signed-in user, token persistence, and the
  `isAdmin` flag every write action is gated on. The backend enforces the same
  rules; hiding buttons is a courtesy, not the control.
- `src/components/RequireAuth.jsx` — route guard. Shows a spinner while a stored
  token is being validated, so a signed-in user reloading doesn't see a flash of
  the login screen.
- `src/context/EnvironmentContext.jsx` — the selected environment, shared by
  every page and persisted across reloads. Seeds development/staging/production
  on first run.
- `src/components/ui/` — the shared primitives (Button, Card, Modal, Dropdown,
  Table, Badge, StatCard…). The `Dropdown` replaces the native `<select>`,
  whose open option list can't be themed consistently across browsers.
- `src/components/EvaluationChart.jsx` — Recharts bar chart of evaluation
  volume, 7 or 30 days, optionally scoped to one environment.
- `src/components/CleanupPanel.jsx` — stale-flag suggestions with a
  mark-reviewed action.
- `src/components/AuditDiffModal.jsx` — field-by-field before/after for one
  audit entry, plus the raw JSON either side.

The environment switcher in the top bar drives targeting rules, group
memberships, the analytics chart's scope, and the audit log's optional
environment filter.
