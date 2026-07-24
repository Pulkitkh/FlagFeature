import { useEffect, useState } from 'react'
import { Bell, Search, Wifi, WifiOff, User } from 'lucide-react'
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
    <header className="sticky top-0 z-10 mx-3 mt-3 flex h-16 items-center justify-between gap-4 rounded-2xl border border-white/80 bg-white/70 px-5 shadow-soft backdrop-blur-xl sm:mx-5">
      <div className="min-w-0">
        {breadcrumb && <p className="truncate text-[10px] font-bold uppercase tracking-[0.15em] text-muted">{breadcrumb}</p>}
        <h1 className="truncate text-base font-bold text-ink">{title}</h1>
      </div>

      <div className="hidden flex-1 max-w-sm items-center gap-2 rounded-xl border border-white/80 bg-white/80 px-3 py-2 shadow-soft md:flex">
        <Search className="h-3.5 w-3.5 text-muted" />
        <input placeholder="Search flags, environments..." className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70" onFocus={(e) => e.target.blur()} readOnly aria-label="Search (not yet functional)" />
        <kbd className="rounded-lg border border-border bg-hoverBg px-1.5 py-0.5 text-[10px] text-muted">⌘K</kbd>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden items-center gap-1.5 text-xs font-medium text-muted sm:flex" title={health === null ? 'Checking API status' : isOk ? 'API connected' : 'API unreachable'}>
          {health === null ? <span className="h-2 w-2 animate-pulse rounded-full bg-muted" /> : isOk ? <Wifi className="h-3.5 w-3.5 text-good" /> : <WifiOff className="h-3.5 w-3.5 text-bad" />}
          {health === null ? 'Checking...' : isOk ? 'Connected' : 'Unreachable'}
        </div>
        <EnvironmentSwitcher />
        <button aria-label="Notifications" className="relative hidden h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-muted shadow-soft transition hover:-translate-y-0.5 hover:text-accent sm:flex">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-soft"><User className="h-4 w-4" /></div>
      </div>
    </header>
  )
}
