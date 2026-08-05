/**
 * Finds user-facing text that never reaches `t()`.
 *
 * This exists because the first pass at i18n translated the navigation and
 * stopped, and nothing caught it — the app built, the tests passed, and every
 * page still rendered in English. A missing translation is invisible to a
 * compiler, so it needs its own check.
 *
 * Two things are flagged:
 *   1. JSX text nodes  — `<p>Save changes</p>`
 *   2. String literals in props that render as text — title, label,
 *      placeholder, description, hint, aria-label…
 *
 * Deliberately not flagged: technical identifiers the UI must show verbatim
 * (`POST /evaluate`, `boolean`, `alice@example.com`), because translating them
 * would make the console misreport what the API stores. Those live in ALLOWED
 * below, so adding one is a visible decision rather than a silent skip.
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = new URL('../src', import.meta.url).pathname

// Files whose strings are data or scaffolding rather than interface copy.
const SKIP_FILES = [
  /\/i18n\//,
  /\/api\/client\.js$/,
  /\/main\.jsx$/,
  /\/App\.jsx$/,
  /context\/(Auth|Environment|Theme|Language)Context\.jsx$/,
]

// Text that is an identifier, a code sample, or a placeholder showing literal
// API syntax. Matched against the trimmed string.
const ALLOWED = [
  /^[\s\p{P}\p{S}\d]*$/u, // punctuation, digits, arrows, dashes
  /^FlagForge$/,
  /^(true|false|null|boolean|string|number)$/,
  /^v?\d/, // version numbers
  /^[a-z0-9_]+(\.[a-z0-9_]+)*$/, // snake_case / dotted identifiers
  /^[a-z0-9-]+(,\s*[a-z0-9-]+)*$/, // kebab-case lists: "new-checkout-flow"
  /^[\w.+-]+@[\w-]+\.[a-z]{2,}/i, // e-mail examples
  /^(POST|GET|PUT|PATCH|DELETE)\s/, // HTTP samples
  /^\//, // paths: /evaluate
  /^[A-Za-z_]+\s*\/\s*[A-Za-z_]+$/, // "FlagForge / Flags" breadcrumbs
  /^\d+%$/,
  /^evaluate\.http$/,
  /^(qa|growth|production|staging|development)$/,
  /^(beta_users|internal_team|premium_plan)/,
  // Sample values in placeholders: a person's name and an environment name,
  // shown as examples of what to type rather than as instructions.
  /^(Priya Shah|QA)$/,
]

// A JSX text node that contains these is really a JS expression that happened
// to sit between a `>` and a `<` on the same line.
const CODE_SHAPED = /[(){}[\];]|=>|\+\+|&&|\|\|/

// Props whose string values are rendered to the user.
const TEXT_PROPS = new Set([
  'title',
  'label',
  'description',
  'placeholder',
  'hint',
  'aria-label',
  'breadcrumb',
  'emptyLabel',
])

function isAllowed(text) {
  return ALLOWED.some((pattern) => pattern.test(text))
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.jsx?$/.test(path)) out.push(path)
  }
  return out
}

/** Strip comments and template literals so their contents aren't scanned. */
function stripNoise(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`]*`/g, (m) => m.replace(/[^\n]/g, ' '))
}

const findings = []

for (const path of walk(ROOT)) {
  const rel = relative(ROOT, path)
  if (SKIP_FILES.some((pattern) => pattern.test(path))) continue

  const source = stripNoise(readFileSync(path, 'utf8'))
  const lines = source.split('\n')

  lines.forEach((line, index) => {
    // 1. JSX text nodes: `>Some words<` on one line, or a line that is only
    //    prose sitting between tags.
    for (const match of line.matchAll(/>([^<>{}\n]{2,})</g)) {
      const text = match[1].trim()
      if (text && /\p{L}{2,}/u.test(text) && !CODE_SHAPED.test(text) && !isAllowed(text)) {
        findings.push({ rel, line: index + 1, text, kind: 'jsx-text' })
      }
    }

    // 1b. Prose on its own line between tags — the shape that let the
    //     sidebar's milestone copy stay English through the first pass.
    const alone = line.trim()
    if (
      alone &&
      !alone.startsWith('<') &&
      !alone.startsWith('{') &&
      !alone.startsWith('*') &&
      !alone.includes('=') &&
      !CODE_SHAPED.test(alone) &&
      /\p{L}{2,}/u.test(alone) &&
      !isAllowed(alone) &&
      // Only inside JSX: the previous non-blank line must end a tag.
      /(>|^\s*<[\w.]+)\s*$/.test(lines[index - 1] ?? '')
    ) {
      findings.push({ rel, line: index + 1, text: alone, kind: 'jsx-text' })
    }

    // 2. Rendered props holding a plain string literal.
    for (const match of line.matchAll(/\b([\w-]+)=["']([^"']{2,})["']/g)) {
      const [, prop, text] = match
      if (!TEXT_PROPS.has(prop)) continue
      if (/\p{L}{2,}/u.test(text) && !isAllowed(text.trim())) {
        findings.push({ rel, line: index + 1, text: `${prop}="${text}"`, kind: 'prop' })
      }
    }
  })
}

if (findings.length) {
  console.error(`untranslated strings (${findings.length}):`)
  for (const { rel, line, text, kind } of findings) {
    console.error(`  ${rel}:${line}  [${kind}]  ${text}`)
  }
  console.error('\nRoute each through t(), or add it to ALLOWED if it is an identifier.')
  process.exit(1)
}

console.log('no untranslated user-facing strings found')
