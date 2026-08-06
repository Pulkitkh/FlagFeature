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
  const healthLabel =
    health === null ? t('apiChecking') : isOk ? t('apiConnected') : t('apiUnreachable')

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/85 px-5 backdrop-blur-md">
      {/* The path reads as one monospace line rather than a stacked title —
          a console tells you where you are in a single glance. */}
      <p className="min-w-0 truncate text-[12px] text-muted">
        {breadcrumb && <span>{breadcrumb}</span>}
        {breadcrumb && <span className="mx-2 text-borderStrong">/</span>}
        <span className="font-medium text-ink">{title}</span>
      </p>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className="hidden items-center gap-1.5 text-[11px] font-medium text-muted xl:flex"
          title={healthLabel}
        >
          <span
            className={`signal-dot ${
              health === null ? 'bg-muted' : isOk ? 'signal-dot--live bg-good' : 'bg-bad'
            }`}
          />
          {healthLabel}
        </span>
        <span className="hidden h-5 w-px bg-border xl:block" />
        <EnvironmentSwitcher />
        <LanguageSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
