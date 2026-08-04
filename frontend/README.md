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
| `/` | Public landing page — what the product does, and the way in to `/login` |
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

## Theme

Light and dark, plus **System**, which follows the OS and keeps following it —
change your machine to dark at sunset and the console follows without touching
the menu. The choice persists in `localStorage` under `flagforge.theme`.

Colours are CSS custom properties in `src/styles/index.css`, exposed to Tailwind
through `tailwind.config.js` as `"R G B"` triples so opacity modifiers
(`bg-surface/60`, `border-bad/25`) keep working. Switching themes swaps the
variables on `<html data-theme>`; no component knows which theme is active.

Two things can't come from CSS variables and are handled explicitly:

- **Recharts colours** are props, not classes, so `EvaluationChart.jsx` picks a
  palette per theme in JS — the darker validated blue on light backgrounds, the
  lighter one on dark.
- **First paint.** An inline script in `index.html` sets `data-theme` before
  React mounts. Without it every load flashes white for dark-theme users.

The light palette is byte-for-byte what it was before dark mode existed.

## Languages

46 languages — English, 16 spoken across India, and 29 more — selectable from
the globe menu in the top bar, on the login screen, and on the landing page.
The menu searches on either the endonym or the English name, so Bengali is
findable by typing `Bengali` or `বাংলা`. The choice persists under
`flagforge.language`; with nothing stored, `navigator.languages` decides.

- `src/i18n/languages.js` — the list, with each language's own name, its English
  name, its region grouping, and whether it reads right-to-left.
- `src/i18n/translations.js` — the strings. English is the complete catalogue
  and the fallback; every other locale defines the *shell* (navigation, landing
  page, sign-in screen, preference controls). A key a locale doesn't define
  falls through to English rather than rendering a raw key.
- `src/context/LanguageContext.jsx` — `t()`, plus the `lang` and `dir`
  attributes on `<html>`.

**What isn't translated:** the deeper console screens — flag editor, targeting
rules, audit diffs, analytics labels — are English in every locale. They're
dense with API field names and JSON, and translating them convincingly is a
content job rather than a code one. The boundary is deliberate; adding a screen
means adding its keys to `en` and to whichever locales you can cover.

Arabic, Urdu, Persian and Hebrew set `dir="rtl"`. Layout uses Tailwind's logical
properties (`ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`) so the mirroring is
automatic; `.rtl-flip` handles the few icons that encode a physical direction.

```bash
npm run check:i18n   # catalogue invariants, no test runner needed
```

That script fails on a translation key English doesn't have, an empty string, a
locale missing any shell key, a locale declared but never translated, and a
drift between the RTL list and the copy hardcoded in `index.html`'s pre-paint
script.
