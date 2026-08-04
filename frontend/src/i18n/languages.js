/**
 * The languages the console can be displayed in.
 *
 * `label` is the language's own name (endonym) because a language picker is
 * the one menu a user reads *before* they can read the rest of the interface —
 * "हिन्दी" is findable by a Hindi speaker in a way "Hindi" is not. `english`
 * is kept alongside it so the search box matches either spelling, and
 * `region` groups the list so the Indian languages don't get lost among the
 * rest.
 *
 * `dir: 'rtl'` drives the `dir` attribute on <html>; Tailwind's logical
 * properties handle most of the flip, and `.rtl-flip` (see styles/index.css)
 * covers the few icons that encode a physical direction.
 */
export const LANGUAGES = [
  // ---- India ----
  { code: 'en', label: 'English', english: 'English', region: 'Global' },
  { code: 'hi', label: 'हिन्दी', english: 'Hindi', region: 'India' },
  { code: 'bn', label: 'বাংলা', english: 'Bengali', region: 'India' },
  { code: 'mr', label: 'मराठी', english: 'Marathi', region: 'India' },
  { code: 'te', label: 'తెలుగు', english: 'Telugu', region: 'India' },
  { code: 'ta', label: 'தமிழ்', english: 'Tamil', region: 'India' },
  { code: 'gu', label: 'ગુજરાતી', english: 'Gujarati', region: 'India' },
  { code: 'ur', label: 'اردو', english: 'Urdu', region: 'India', dir: 'rtl' },
  { code: 'kn', label: 'ಕನ್ನಡ', english: 'Kannada', region: 'India' },
  { code: 'or', label: 'ଓଡ଼ିଆ', english: 'Odia', region: 'India' },
  { code: 'ml', label: 'മലയാളം', english: 'Malayalam', region: 'India' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', english: 'Punjabi', region: 'India' },
  { code: 'as', label: 'অসমীয়া', english: 'Assamese', region: 'India' },
  { code: 'mai', label: 'मैथिली', english: 'Maithili', region: 'India' },
  { code: 'sa', label: 'संस्कृतम्', english: 'Sanskrit', region: 'India' },
  { code: 'ne', label: 'नेपाली', english: 'Nepali', region: 'India' },
  { code: 'si', label: 'සිංහල', english: 'Sinhala', region: 'India' },

  // ---- Rest of the world ----
  { code: 'es', label: 'Español', english: 'Spanish', region: 'World' },
  { code: 'fr', label: 'Français', english: 'French', region: 'World' },
  { code: 'de', label: 'Deutsch', english: 'German', region: 'World' },
  { code: 'pt', label: 'Português', english: 'Portuguese', region: 'World' },
  { code: 'it', label: 'Italiano', english: 'Italian', region: 'World' },
  { code: 'nl', label: 'Nederlands', english: 'Dutch', region: 'World' },
  { code: 'ru', label: 'Русский', english: 'Russian', region: 'World' },
  { code: 'uk', label: 'Українська', english: 'Ukrainian', region: 'World' },
  { code: 'pl', label: 'Polski', english: 'Polish', region: 'World' },
  { code: 'cs', label: 'Čeština', english: 'Czech', region: 'World' },
  { code: 'sv', label: 'Svenska', english: 'Swedish', region: 'World' },
  { code: 'hu', label: 'Magyar', english: 'Hungarian', region: 'World' },
  { code: 'ro', label: 'Română', english: 'Romanian', region: 'World' },
  { code: 'el', label: 'Ελληνικά', english: 'Greek', region: 'World' },
  { code: 'tr', label: 'Türkçe', english: 'Turkish', region: 'World' },
  { code: 'ar', label: 'العربية', english: 'Arabic', region: 'World', dir: 'rtl' },
  { code: 'fa', label: 'فارسی', english: 'Persian', region: 'World', dir: 'rtl' },
  { code: 'he', label: 'עברית', english: 'Hebrew', region: 'World', dir: 'rtl' },
  { code: 'zh', label: '简体中文', english: 'Chinese (Simplified)', region: 'World' },
  { code: 'zh-TW', label: '繁體中文', english: 'Chinese (Traditional)', region: 'World' },
  { code: 'ja', label: '日本語', english: 'Japanese', region: 'World' },
  { code: 'ko', label: '한국어', english: 'Korean', region: 'World' },
  { code: 'vi', label: 'Tiếng Việt', english: 'Vietnamese', region: 'World' },
  { code: 'th', label: 'ไทย', english: 'Thai', region: 'World' },
  { code: 'my', label: 'မြန်မာ', english: 'Burmese', region: 'World' },
  { code: 'id', label: 'Bahasa Indonesia', english: 'Indonesian', region: 'World' },
  { code: 'ms', label: 'Bahasa Melayu', english: 'Malay', region: 'World' },
  { code: 'fil', label: 'Filipino', english: 'Filipino', region: 'World' },
  { code: 'sw', label: 'Kiswahili', english: 'Swahili', region: 'World' },
]

export const DEFAULT_LANGUAGE = 'en'

const BY_CODE = new Map(LANGUAGES.map((language) => [language.code, language]))

export function findLanguage(code) {
  return BY_CODE.get(code) || null
}

/**
 * Best match for a browser locale: exact first ("zh-TW"), then the base
 * subtag ("pt-BR" → "pt"). Returns null when nothing matches so the caller
 * can decide what the fallback is.
 */
export function resolveLanguage(locale) {
  if (!locale) return null
  if (BY_CODE.has(locale)) return locale

  const base = locale.split('-')[0]

  // Checked before the plain base fallback: "zh-Hant-HK" would otherwise
  // collapse to "zh" and show a Traditional reader Simplified script.
  if (base === 'zh' && /hant|TW|HK|MO/i.test(locale)) return 'zh-TW'

  if (BY_CODE.has(base)) return base
  return null
}

export function directionFor(code) {
  return findLanguage(code)?.dir === 'rtl' ? 'rtl' : 'ltr'
}
