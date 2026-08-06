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
- `src/components/DecisionTrace.jsx` — the evaluation engine's priority ladder
  with the step that decided the value lit up. The API already returns a
  `reason`; this puts it back into the ordered chain it came from, so "true
  because of a percentage rollout" is a position in a sequence rather than a
  string you have to know how to read. Steps above the deciding one were
  evaluated and didn't match; steps below were never reached, and those are
  drawn differently because they are different states.

### Flag detail

Four tabs — Overview, Targeting, Analytics, History — instead of one long
scroll. Overview pairs the decision trace with the test-user inputs directly
above it, so changing the user re-lights the ladder in place. Alongside it, a
matrix showing how the flag resolves in *every* environment at once.

### Group management

Each group expands inline (not into a modal — you're usually comparing against
the rest of the list) with member chips you can remove, an add-members field
that merges rather than replaces, rename, and delete.

**Rename is composed from the two endpoints the API already has**: write the
membership under the new key, then drop it from the old one. There is no rename
endpoint and adding one would mean changing a backend that works. The cost is
that targeting rules referencing the old key keep referencing it — the form says
so, because silently breaking a rollout is worse than one extra step. Deleting a
group removes its memberships, which is what a group *is*.

### Audit log paging

15 rows a page by default (10 / 15 / 25 / 50 selectable), with next/previous —
so the page stays one screen tall instead of stretching the scrollbar to a
sliver. The API returns the whole matching set, so paging is client-side and
switching pages costs no round trip. Changing any filter resets to page one,
because the old page number would point into a different list.

The environment switcher in the top bar drives targeting rules, group
memberships, the analytics chart's scope, and the audit log's optional
environment filter.

## Design system

The console reads as **paper and ink** rather than as a SaaS dashboard. Three
decisions carry that:

- **Warm neutrals.** The greys carry a little yellow, so the surface reads as
  paper. A pure blue-grey ramp is the giveaway of an untouched default.
- **Ink is the primary action.** `Button variant="primary"` is near-black, not a
  brand blue — a page has one committed action and it should look like it.
- **One accent, and it is the data colour.** The blue used for selection is
  slot 1 of the validated data-viz palette, the same value the evaluation chart
  plots with. Interactive colour and series colour are the same thing rather
  than two arbitrary picks.

Signature elements: monospace `[01]` index markers before section titles, a
hairline rule with an accent lead-in under each page title, a dot field instead
of graph paper, and monospace for every value that came from the API — so data
always looks like data.

### Typography

| Role | Face | Why |
|---|---|---|
| Display | **Cabinet Grotesk** (Fontshare) | Tight apertures give headings edge |
| Body | **Satoshi** (Fontshare) | Neutral enough for dense tables |
| Mono | **JetBrains Mono** (Google) | Carries every API value |

Fontshare is the Indian Type Foundry's free library. The pairing was chosen
over the usual Inter / Space Grotesk defaults so the console has a voice of its
own. Fallback stacks are real font stacks, not a bare `sans-serif`, so a blocked
webfont degrades to something with similar metrics.

## Theme

Light and dark, plus **System**, which follows the OS and keeps following it.
The choice persists in `localStorage` under `flagforge.theme`.

Colours are CSS custom properties in `src/styles/index.css`, exposed to Tailwind
through `tailwind.config.js` as `"R G B"` triples so opacity modifiers
(`bg-surface/60`, `border-bad/25`) keep working. Switching themes swaps the
variables on `<html data-theme>`; no component knows which theme is active.

Two things can't come from CSS variables and are handled explicitly:

- **Recharts colours** are props, not classes, so `EvaluationChart.jsx` picks a
  palette per theme in JS — the darker validated blue on light backgrounds, the
  lighter one on dark. The dark surface matches the palette's reference dark
  surface, so the chart sits on the background it was validated against.
- **First paint.** An inline script in `index.html` sets `data-theme` before
  React mounts. Without it every load flashes white for dark-theme users.

## Languages

46 languages — English, 16 spoken across India, and 29 more — selectable from
the globe menu in the top bar, on the login screen, and on the landing page.
The menu searches on either the endonym or the English name, so Bengali is
findable by typing `Bengali` or `বাংলা`. The choice persists under
`flagforge.language`; with nothing stored, `navigator.languages` decides.

- `src/i18n/languages.js` — the list, with each language's own name, its English
  name, its region grouping, and whether it reads right-to-left.
- `src/i18n/locales/*.js` — one catalogue per language. `en.js` is complete and
  is the fallback; a key a locale doesn't define falls through to English rather
  than rendering a raw key.
- `src/i18n/translations.js` — the registry. Imports are explicit rather than
  `import.meta.glob` so the checks below can run under plain Node.
- `src/context/LanguageContext.jsx` — `t(key, values)`, plus the `lang` and
  `dir` attributes on `<html>`.

**Every user-facing string on every page goes through `t()`** — navigation,
page headers, table columns, buttons, form labels, hints, empty states, error
messages, modals and `aria-label`s. Interpolation (`t('showingFlags', { shown,
total })`) keeps each sentence one translatable unit, because word order differs
between languages and a translator can't reorder fragments that were
concatenated in JSX.

**What deliberately stays in English, in every locale:** values that come from
the API rather than from the interface — flag keys, `boolean`/`string`/`number`
types, `true`/`false`, JSON payloads, reason codes like `percentage_rollout`,
environment keys, and paths like `POST /evaluate`. Translating those would make
the console misreport what is actually stored.

### Translation coverage

`en`, `hi`, `bn`, `mr`, `ta` and `te` are complete (308 keys) — English plus
the five most widely spoken Indian languages. The other 40 locales carry the
**shell** — navigation, landing page, sign-in screen, and the theme/language
controls — and fall back to English for the rest. `npm run check:i18n` prints
the split on every run, so partial coverage never looks like full coverage.

Filling one in is data entry, not code: copy `src/i18n/locales/en.js`, translate
the values, and the check will confirm no key was invented or left empty.

### Right-to-left

Arabic, Urdu, Persian and Hebrew set `dir="rtl"`. Layout uses Tailwind's logical
properties (`ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`) so mirroring is
automatic; `.rtl-flip` handles the few icons that encode a physical direction,
and the `Switch` knob is positioned rather than translated so it slides the
right way.

### Checks

```bash
npm run check:i18n
```

Runs two scripts, neither of which needs a test runner:

- `scripts/check-i18n.mjs` — catalogue invariants: a key no locale invented, no
  empty strings, no locale missing a shell key, no locale declared but absent,
  correct locale resolution (`zh-Hant-HK` → Traditional, not Simplified), and no
  drift between the RTL list and the copy hardcoded in `index.html`'s pre-paint
  script.
- `scripts/check-untranslated.mjs` — scans the JSX for user-facing text that
  never reaches `t()`, both in text nodes and in rendered props (`title`,
  `label`, `placeholder`, `aria-label`…). This exists because the first pass at
  i18n translated the navigation and stopped, and nothing caught it: the app
  built, the tests passed, and every page still rendered in English. Identifiers
  that must stay verbatim live in an explicit `ALLOWED` list, so skipping one is
  a visible decision.
