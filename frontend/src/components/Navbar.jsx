import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useT } from '../context/LanguageContext'
import EnvironmentSwitcher from './EnvironmentSwitcher'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'

export default function Navbar({ title, breadcrumb }) {
  const [health, setHealth] = useState(null)
  const t = useT()

  useEffect(() => {
    let cancelled = false
    api
      .health()
      .then((res) => !cancelled && setHealth(res))
      .catch(() => !cancelled && setHealth({ status: 'unreachable' }))
    return () => {
      cancelled = true
    }
  }, [])

  const isOk = health?.status === 'ok'
  const healthLabel = health === null ? t('apiChecking') : isOk ? t('apiConnected') : t('apiUnreachable')

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface/90 px-6 backdrop-blur-md">
      <div className="min-w-0">
        {breadcrumb && (
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {breadcrumb}
          </p>
        )}
        <h1 className="truncate font-display text-base font-semibold tracking-tight text-ink">
          {title}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div
          className="hidden items-center gap-1.5 rounded-md border border-border bg-surfaceMuted px-2.5 py-1.5 text-xs font-medium text-muted lg:flex"
          title={healthLabel}
        >
          <span
            className={`signal-dot ${
              health === null ? 'bg-muted' : isOk ? 'signal-dot--live bg-good' : 'bg-bad'
            }`}
          />
          {healthLabel}
        </div>
        <EnvironmentSwitcher />
        <LanguageSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
