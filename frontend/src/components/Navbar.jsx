import { useEffect, useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { api } from '../api/client'
import EnvironmentSwitcher from './EnvironmentSwitcher'

export default function Navbar({ title, breadcrumb }) {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.health().then((res) => !cancelled && setHealth(res)).catch(() => !cancelled && setHealth({ status: 'unreachable' }))
    return () => { cancelled = true }
  }, [])

  const isOk = health?.status === 'ok'

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface/95 px-6 backdrop-blur">
      <div className="min-w-0">
        {breadcrumb && <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{breadcrumb}</p>}
        <h1 className="truncate font-display text-base font-semibold text-ink">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div
          className="hidden items-center gap-1.5 rounded-md border border-border bg-surfaceMuted px-2.5 py-1.5 font-mono text-xs text-muted sm:flex"
          title={health === null ? 'Checking API status' : isOk ? 'API connected' : 'API unreachable'}
        >
          {health === null ? (
            <span className="h-2 w-2 animate-pulse rounded-full bg-muted" />
          ) : isOk ? (
            <Wifi className="h-3.5 w-3.5 text-good" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-bad" />
          )}
          api: {health === null ? 'checking' : isOk ? 'ok' : 'unreachable'}
        </div>
        <EnvironmentSwitcher />
      </div>
    </header>
  )
}
