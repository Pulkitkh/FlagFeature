import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, THEME_CHOICES } from '../context/ThemeContext'
import { useT } from '../context/LanguageContext'

const ICONS = { light: Sun, dark: Moon, system: Monitor }
const LABEL_KEYS = { light: 'themeLight', dark: 'themeDark', system: 'themeSystem' }

/**
 * Two controls in one: the wide half flips light↔dark, which is what a theme
 * button is expected to do, and the narrow half opens the menu — the only
 * place "follow the system" can live, since it isn't one of two states.
 */
export default function ThemeToggle({ className = '' }) {
  const { choice, theme, setTheme, toggleTheme } = useTheme()
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const Icon = theme === 'dark' ? Moon : Sun

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-surface">
        <button
          type="button"
          onClick={toggleTheme}
          title={`${t('theme')}: ${t(LABEL_KEYS[choice])}`}
          aria-label={theme === 'dark' ? t('themeLight') : t('themeDark')}
          className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:bg-surfaceMuted hover:text-ink"
        >
          <Icon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((isOpen) => !isOpen)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t('theme')}
          className={`flex h-9 w-8 items-center justify-center border-s border-border fine:w-6 text-muted transition-colors hover:bg-surfaceMuted hover:text-ink ${
            open ? 'bg-surfaceMuted text-ink' : ''
          }`}
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="absolute end-0 z-40 mt-2 w-44 animate-fade-in overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-floating"
        >
          {THEME_CHOICES.map((option) => {
            const OptionIcon = ICONS[option]
            const selected = choice === option
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setTheme(option)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm transition-colors ${
                  selected ? 'bg-accentSoft text-accentDark' : 'text-ink hover:bg-surfaceMuted'
                }`}
              >
                <OptionIcon className="h-4 w-4 shrink-0 text-muted" />
                <span className="flex-1">{t(LABEL_KEYS[option])}</span>
                {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
