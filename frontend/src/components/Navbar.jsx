import { useEffect, useState } from 'react'
import { Menu, Moon, Sun } from 'lucide-react'
import { api } from '../api/client'
import { useTheme } from '../context/ThemeContext'
import EnvironmentSwitcher from './EnvironmentSwitcher'
import { IconButton } from './ui/Button'

const HEALTH_POLL_MS = 30000

function HealthPill({ health }) {
  const isOk = health?.status === 'ok'
  const label = health === null ? 'Checking…' : isOk ? 'API connected' : 'API unreachable'
  const detail =
    health === null
      ? 'Checking API status'
      : `Database ${health.database || 'unknown'} · Redis ${health.redis || 'unknown'}`

  return (
    <div
      title={detail}
      className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-surfaceMuted px-3 text-xs font-medium text-muted md:flex"
    >
      <span
        className={`signal-dot ${
          health === null ? 'bg-muted' : isOk ? 'signal-dot--live bg-good' : 'bg-bad'
        }`}
        aria-hidden="true"
      />
      {label}
    </div>
  )
}

export default function Navbar({ title, breadcrumb, onOpenNav }) {
  const [health, setHealth] = useState(null)
  const { theme, toggle } = useTheme()

  useEffect(() => {
    let cancelled = false

    function check() {
      api
        .health()
        .then((res) => !cancelled && setHealth(res))
        .catch(() => !cancelled && setHealth({ status: 'unreachable' }))
    }

    check()
    // Keeps the badge honest if the backend restarts mid-session.
    const timer = setInterval(check, HEALTH_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur-md sm:px-6">
      <IconButton
        icon={Menu}
        label="Open navigation"
        variant="secondary"
        onClick={onOpenNav}
        className="lg:hidden"
      />

      <div className="min-w-0 flex-1">
        {breadcrumb && (
          <p className="truncate text-2xs font-semibold uppercase tracking-label text-muted">
            {breadcrumb}
          </p>
        )}
        <h1 className="truncate font-display text-base font-semibold tracking-tight text-ink">
          {title}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <HealthPill health={health} />
        <IconButton
          icon={theme === 'dark' ? Sun : Moon}
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          variant="secondary"
          onClick={toggle}
        />
        <EnvironmentSwitcher />
      </div>
    </header>
  )
}
