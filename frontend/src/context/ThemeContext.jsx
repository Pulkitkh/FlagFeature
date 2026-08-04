import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'flagforge.theme'
const ThemeContext = createContext(null)

/**
 * 'light' and 'dark' pin the theme; 'system' follows the OS and keeps
 * following it, so a user who changes their machine to dark at sunset sees the
 * console change too without touching this menu.
 */
export const THEME_CHOICES = ['light', 'dark', 'system']

function prefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function readStoredChoice() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return THEME_CHOICES.includes(stored) ? stored : 'system'
  } catch {
    // Private browsing can throw on localStorage; the default is fine.
    return 'system'
  }
}

export function ThemeProvider({ children }) {
  const [choice, setChoice] = useState(readStoredChoice)
  const [systemIsDark, setSystemIsDark] = useState(prefersDark)

  // Track the OS setting even while pinned, so switching back to 'system'
  // resolves correctly straight away.
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return

    const onChange = (event) => setSystemIsDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolved = choice === 'system' ? (systemIsDark ? 'dark' : 'light') : choice

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])

  const setTheme = useCallback((next) => {
    if (!THEME_CHOICES.includes(next)) return
    setChoice(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not persisting is survivable; the theme still applies for this session.
    }
  }, [])

  // What the toggle button does: flip to the opposite of what's on screen.
  const toggleTheme = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setTheme])

  const value = useMemo(
    () => ({ choice, theme: resolved, isDark: resolved === 'dark', setTheme, toggleTheme }),
    [choice, resolved, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider')
  return context
}
