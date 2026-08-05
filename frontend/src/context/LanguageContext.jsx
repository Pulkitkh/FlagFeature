import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LANGUAGE,
  directionFor,
  findLanguage,
  resolveLanguage,
} from '../i18n/languages'
import { catalogFor } from '../i18n/translations'

const STORAGE_KEY = 'flagforge.language'
const LanguageContext = createContext(null)

/**
 * A stored choice wins; otherwise the browser's preferred languages are tried
 * in order, so a Hindi-first browser lands on Hindi without anyone picking it.
 */
function initialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && findLanguage(stored)) return stored
  } catch {
    // localStorage can throw in private browsing; fall through to detection.
  }

  for (const locale of navigator.languages || [navigator.language]) {
    const match = resolveLanguage(locale)
    if (match) return match
  }
  return DEFAULT_LANGUAGE
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(initialLanguage)

  const catalog = useMemo(() => catalogFor(language), [language])
  const direction = directionFor(language)

  // Screen readers and the browser's own text handling (hyphenation, quotes,
  // "translate this page") all key off these attributes, not off React state.
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = direction
  }, [language, direction])

  const setLanguage = useCallback((code) => {
    if (!findLanguage(code)) return
    setLanguageState(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // Same as above — the choice still applies for this session.
    }
  }, [])

  /**
   * Look up a string, substituting any `{placeholders}` from `values`.
   *
   * Missing keys fall back to English inside `catalogFor`, and a key that
   * exists in no catalogue returns itself — visible in the UI, which is what
   * you want while adding strings.
   *
   * Placeholders exist so a sentence stays one translatable unit: word order
   * differs between languages, and a translator can't reorder fragments that
   * were concatenated in JSX.
   */
  const t = useCallback(
    (key, values) => {
      const template = catalog[key] ?? key
      if (!values) return template
      return template.replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
      )
    },
    [catalog]
  )

  const value = useMemo(
    () => ({ language, setLanguage, t, direction, isRtl: direction === 'rtl' }),
    [language, setLanguage, t, direction]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside a LanguageProvider')
  return context
}

/** Shorthand for the common case of only needing the lookup function. */
export function useT() {
  return useLanguage().t
}
