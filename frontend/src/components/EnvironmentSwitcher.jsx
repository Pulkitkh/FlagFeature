import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useEnvironment } from '../context/EnvironmentContext'
import { useT } from '../context/LanguageContext'

const ENV_DOT_COLOR = { production: 'bg-bad', staging: 'bg-warn', development: 'bg-good' }

export default function EnvironmentSwitcher() {
  const { environments, selected, setSelectedKey, loading } = useEnvironment()
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (loading) return <div className="h-9 w-40 animate-pulse rounded-lg bg-hoverBg" />

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('fieldEnvironment')}
        className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${
          open
            ? 'border-accent bg-accentSoft text-accentDark'
            : 'border-border bg-surface text-ink shadow-hairline hover:bg-surfaceMuted'
        }`}
      >
        <span
          className={`signal-dot signal-dot--live ${ENV_DOT_COLOR[selected?.key] || 'bg-muted'}`}
        />
        <span className="max-w-[10rem] truncate">{selected?.name || t('noEnvironment')}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute end-0 z-20 mt-2 w-56 animate-fade-in overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-floating"
        >
          {environments.map((env) => {
            const isSelected = env.key === selected?.key
            return (
              <button
                key={env.key}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setSelectedKey(env.key)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-start text-sm transition-colors ${
                  isSelected ? 'bg-accentSoft text-accentDark' : 'text-ink hover:bg-surfaceMuted'
                }`}
              >
                <span className={`signal-dot ${ENV_DOT_COLOR[env.key] || 'bg-muted'}`} />
                <span className="min-w-0 flex-1 truncate">{env.name}</span>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
