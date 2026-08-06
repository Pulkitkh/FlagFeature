import { NavLink } from 'react-router-dom'
import { Flag, Layers, Clock, Users, UserCog } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../context/LanguageContext'

const NAV_ITEMS = [
  { to: '/flags', labelKey: 'navFlags', icon: Flag },
  { to: '/environments', labelKey: 'navEnvironments', icon: Layers },
  { to: '/groups', labelKey: 'navGroups', icon: Users },
  { to: '/audit-log', labelKey: 'navAudit', icon: Clock },
]

export default function Sidebar() {
  const { isAdmin } = useAuth()
  const t = useT()
  // Managing accounts is admin-only, so a viewer isn't shown a door they
  // can't open. The route guards it too.
  const navItems = isAdmin
    ? [...NAV_ITEMS, { to: '/accounts', labelKey: 'navAccounts', icon: UserCog }]
    : NAV_ITEMS

  return (
    <aside className="hidden w-[236px] shrink-0 flex-col border-e border-border bg-surfaceSunken lg:flex">
      <NavLink
        to="/"
        className="flex items-center gap-2.5 border-b border-border px-5 py-[18px] transition-colors hover:bg-surfaceMuted"
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink text-surface">
          <Flag className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span className="signal-dot signal-dot--live absolute -end-1 -top-1 bg-accent ring-2 ring-surface" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[15px] font-semibold leading-none tracking-[-0.02em] text-ink">
            FlagForge
          </span>
          <span className="mt-1 block text-[11px] font-medium text-muted">
            {t('tagline')}
          </span>
        </span>
      </NavLink>

      <div className="px-5 pb-2 pt-5">
        <span className="text-[11px] font-medium text-muted">
          {t('navManage')}
        </span>
      </div>

      <nav className="flex flex-col px-2.5">
        {navItems.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150 ${
                isActive
                  ? 'bg-accentSoft font-semibold text-accentDark'
                  : 'font-medium text-muted hover:bg-surface hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* The active marker is a solid ink bar, matching the primary
                    button — one "you are here" language across the console. */}
                <span
                  className={`absolute start-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-e-full bg-accent transition-transform duration-150 ${
                    isActive ? 'scale-y-100' : 'scale-y-0'
                  }`}
                />
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-accent' : 'text-muted group-hover:text-ink'}`}
                />
                <span className="flex-1 truncate">{t(labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto p-3">
        <div className="rounded-lg border border-border bg-surfaceMuted p-3.5">
          <p className="flex items-center gap-2 text-[11px] font-semibold text-ink">
            <span className="signal-dot signal-dot--live bg-good" />
            {t('milestoneBadge')}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{t('milestoneCopy')}</p>
        </div>
      </div>
    </aside>
  )
}
