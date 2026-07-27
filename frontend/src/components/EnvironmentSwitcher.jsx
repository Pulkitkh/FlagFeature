import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Layers } from 'lucide-react'
import { useEnvironment } from '../context/EnvironmentContext'

// Production reads as the "hot" environment, development as the safe one.
export const ENV_TONE = {
  production: { dot: 'bg-bad', label: 'text-bad' },
  staging: { dot: 'bg-warn', label: 'text-warn' },
  development: { dot: 'bg-good', label: 'text-good' },
}

export function environmentDot(key) {
  return ENV_TONE[key]?.dot || 'bg-accent'
}

export default function EnvironmentSwitcher() {
  const { environments, selected, setSelectedKey, loading } = useEnvironment()
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

  if (loading) return <div className="h-9 w-36 animate-pulse rounded-lg bg-surfaceMuted" />

  if (environments.length === 0) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-border px-3 text-xs text-muted">
        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        No environments
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-9 items-center gap-2 rounded-lg border bg-surface pl-3 pr-2 text-sm font-semibold text-ink shadow-hairline transition-colors ${
          open ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:bg-surfaceMuted'
        }`}
      >
        <span
          className={`signal-dot signal-dot--live ${environmentDot(selected?.key)}`}
          aria-hidden="true"
        />
        <span className="max-w-[9rem] truncate">{selected?.name || 'Select'}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lifted animate-fade-in"
        >
          <p className="px-3 pb-1.5 pt-2 text-2xs font-semibold uppercase tracking-label text-muted">
            Active environment
          </p>
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
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-accentSoft"
              >
                <span className={`signal-dot ${environmentDot(env.key)}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{env.name}</span>
                  <span className="block truncate font-mono text-2xs text-muted">{env.key}</span>
                </span>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-accent" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
