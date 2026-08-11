import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useT } from '../context/LanguageContext'
import EnvironmentSwitcher from './EnvironmentSwitcher'
import LanguageSwitcher from './LanguageSwitcher'
import MobileNav from './MobileNav'
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
    // `pt-[env(safe-area-inset-top)]` keeps the row clear of a notch when the
    // page is opened full-bleed on iOS. It is zero everywhere else.
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface/85 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <MobileNav />
        {/* The path reads as one line rather than a stacked title — a console
            tells you where you are in a single glance. */}
        <p className="min-w-0 truncate text-[12px] text-muted">
          {breadcrumb && <span className="hidden sm:inline">{breadcrumb}</span>}
          {breadcrumb && <span className="mx-2 hidden text-borderStrong sm:inline">/</span>}
          <span className="font-medium text-ink">{title}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
        {/* Language and theme are set-once preferences, not per-page controls.
            At 320px the five controls together are wider than the screen and
            crush the menu button, so on a phone these two move into the drawer
            (see MobileNav) and the environment switcher keeps the header. */}
        <span className="hidden items-center gap-1.5 sm:flex sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </span>
        <UserMenu />
      </div>
    </header>
  )
}
