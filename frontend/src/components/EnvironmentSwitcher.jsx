import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useEnvironment } from '../context/EnvironmentContext'

const ENV_DOT_COLOR = { production: 'bg-bad', staging: 'bg-warn', development: 'bg-good' }

export default function EnvironmentSwitcher() {
  const { environments, selected, setSelectedKey, loading } = useEnvironment()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (loading) return <div className="h-9 w-40 animate-pulse rounded-lg bg-hoverBg" />

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink shadow-hairline transition-colors hover:bg-surfaceMuted"
      >
        <span className={`signal-dot signal-dot--live ${ENV_DOT_COLOR[selected?.key] || 'bg-muted'}`} />
        {selected?.name || 'No environment'}
        <ChevronDown className="h-3.5 w-3.5 text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-floating">
          {environments.map((env) => (
            <button
              key={env.key}
              onClick={() => { setSelectedKey(env.key); setOpen(false) }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-accentSoft"
            >
              <span className={`signal-dot ${ENV_DOT_COLOR[env.key] || 'bg-muted'}`} />
              <span className="flex-1">{env.name}</span>
              {env.key === selected?.key && <Check className="h-3.5 w-3.5 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
