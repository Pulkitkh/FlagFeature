/**
 * Catalogue invariants, checked without a test runner.
 *
 * Translation files rot quietly: a key gets renamed in English and forty
 * locales keep the old one, which then silently falls back forever. Nothing
 * here needs a browser or a dependency, so it can run as `npm run check:i18n`.
 *
 * Exits non-zero on the first category of problem it finds.
 */
import { LANGUAGES, DEFAULT_LANGUAGE, resolveLanguage, directionFor } from '../src/i18n/languages.js'
import translations, { en, catalogFor } from '../src/i18n/translations.js'

const problems = []

// --- The language list itself ---
const codes = LANGUAGES.map((entry) => entry.code)
const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index)
if (duplicates.length) problems.push(`duplicate language codes: ${duplicates.join(', ')}`)

if (!codes.includes(DEFAULT_LANGUAGE)) {
  problems.push(`DEFAULT_LANGUAGE "${DEFAULT_LANGUAGE}" is not in LANGUAGES`)
}

for (const entry of LANGUAGES) {
  if (!entry.label || !entry.english || !entry.region) {
    problems.push(`${entry.code}: needs label, english, and region`)
  }
  if (entry.dir && entry.dir !== 'rtl') {
    problems.push(`${entry.code}: dir must be "rtl" when set, got "${entry.dir}"`)
  }
}

// The brief was 30–40 languages; falling under that is a regression worth failing on.
if (LANGUAGES.length < 30) {
  problems.push(`only ${LANGUAGES.length} languages defined, expected at least 30`)
}

// --- Every translation belongs to a declared language, and vice versa ---
for (const code of Object.keys(translations)) {
  if (!codes.includes(code)) {
    problems.push(`translations has "${code}", which is not in LANGUAGES`)
  }
}

// --- No translation may invent a key English doesn't have ---
const englishKeys = new Set(Object.keys(en))
for (const [code, catalog] of Object.entries(translations)) {
  for (const key of Object.keys(catalog)) {
    if (!englishKeys.has(key)) {
      problems.push(`${code}: "${key}" does not exist in the English catalogue`)
    }
  }
  for (const [key, value] of Object.entries(catalog)) {
    if (typeof value !== 'string' || !value.trim()) {
      problems.push(`${code}: "${key}" is empty`)
    }
  }
}

// --- The shell must be translated everywhere, since it is what a user reads
//     before they can reach the language picker's own explanation. ---
const SHELL_KEYS = [
  'tagline',
  'navFlags',
  'navEnvironments',
  'navGroups',
  'navAudit',
  'navAccounts',
  'navManage',
  'signIn',
  'signOut',
  'getStarted',
  'language',
  'theme',
  'themeLight',
  'themeDark',
  'themeSystem',
  'heroTitle',
  'heroSubtitle',
  'loginTitle',
  'languageSearch',
]

for (const key of SHELL_KEYS) {
  if (!englishKeys.has(key)) problems.push(`SHELL_KEYS lists "${key}", which English does not define`)
}

for (const code of codes) {
  if (code === DEFAULT_LANGUAGE) continue
  const catalog = translations[code]
  if (!catalog) {
    problems.push(`${code}: declared in LANGUAGES but has no translations`)
    continue
  }
  const missing = SHELL_KEYS.filter((key) => !catalog[key])
  if (missing.length) problems.push(`${code}: shell keys missing — ${missing.join(', ')}`)
}

// --- Fallback behaviour ---
for (const code of codes) {
  const catalog = catalogFor(code)
  const untranslated = [...englishKeys].filter((key) => !catalog[key])
  if (untranslated.length) {
    problems.push(`${code}: catalogFor() left these undefined — ${untranslated.join(', ')}`)
  }
}

// --- Locale resolution ---
const RESOLUTIONS = [
  ['en-GB', 'en'],
  ['hi-IN', 'hi'],
  ['pt-BR', 'pt'],
  ['zh-TW', 'zh-TW'],
  ['zh-Hant-HK', 'zh-TW'],
  ['zh-CN', 'zh'],
  ['xx-YY', null],
]
for (const [locale, expected] of RESOLUTIONS) {
  const actual = resolveLanguage(locale)
  if (actual !== expected) {
    problems.push(`resolveLanguage("${locale}") gave "${actual}", expected "${expected}"`)
  }
}

for (const code of ['ar', 'ur', 'fa', 'he']) {
  if (directionFor(code) !== 'rtl') problems.push(`${code} should be right-to-left`)
}
if (directionFor('hi') !== 'ltr') problems.push('hi should be left-to-right')

// The pre-paint script in index.html hardcodes the RTL list, because it runs
// before any module loads. If the two ever disagree, RTL pages flash the wrong
// way round on load.
const declaredRtl = LANGUAGES.filter((entry) => entry.dir === 'rtl')
  .map((entry) => entry.code)
  .sort()
const preloadRtl = ['ar', 'fa', 'he', 'ur']
if (declaredRtl.join(',') !== preloadRtl.join(',')) {
  problems.push(
    `RTL languages are [${declaredRtl}] but index.html's pre-paint script lists [${preloadRtl}] — update both`
  )
}

if (problems.length) {
  console.error(`i18n check failed (${problems.length}):`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

const translated = codes.length - 1
console.log(
  `i18n ok — ${codes.length} languages (${translated} translated + English), ` +
    `${englishKeys.size} keys, ${SHELL_KEYS.length} required in every locale.`
)
