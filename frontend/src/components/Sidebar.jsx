import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../context/LanguageContext'
import { LogoTile } from './Logo'
import { navItemsFor } from './navItems'

/** The brand block, shared by the rail and the mobile drawer. */
export function SidebarBrand({ onNavigate }) {
  const t = useT()
  return (
    <NavLink
      to="/"
      onClick={onNavigate}
      className="flex items-center gap-2.5 border-b border-border px-5 py-[18px] transition-colors hover:bg-surfaceMuted"
    >
      <LogoTile className="h-8 w-8" />
      <span className="min-w-0">
        <span className="block font-display text-[15px] font-semibold leading-none tracking-[-0.02em] text-ink">
          FlagForge
        </span>
        <span className="mt-1 block text-[11px] font-medium text-muted">{t('tagline')}</span>
      </span>
    </NavLink>
  )
}

/**
 * The navigation list itself. `dense={false}` gives every row a 44px minimum
 * height for the drawer, where a finger is doing the pointing.
 */
export function SidebarNav({ onNavigate, dense = true }) {
  const { isAdmin } = useAuth()
  const t = useT()

  return (
    <nav className="flex flex-col px-2.5">
      {navItemsFor(isAdmin).map(({ to, labelKey, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 rounded-lg px-2.5 text-[13px] transition-colors duration-150 ${
              dense ? 'py-2' : 'min-h-[44px] py-2.5 text-sm'
            } ${
              isActive
                ? 'bg-accentSoft font-semibold text-accentDark'
                : 'font-medium text-muted hover:bg-surface hover:text-ink'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {/* The active marker is an accent bar, matching the primary
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
  )
}

export function SidebarFooter() {
  const t = useT()
  return (
    <div className="mt-auto p-3">
      <div className="rounded-lg border border-border bg-surfaceMuted p-3.5">
        <p className="flex items-center gap-2 text-[11px] font-semibold text-ink">
          <span className="signal-dot signal-dot--live bg-good" />
          {t('milestoneBadge')}
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{t('milestoneCopy')}</p>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const t = useT()

  return (
    // The gradient is the same violet-to-teal grade the page wash uses, run
    // vertically down the rail — so the navigation reads as part of the shell
    // rather than as a grey column bolted to the side of it.
    //
    // Hidden below `lg`, where MobileNav takes over. The two render the same
    // list from navItems.js, so neither can drift.
    <aside className="hidden w-[236px] shrink-0 flex-col border-e border-border bg-surfaceSunken bg-gradient-to-b from-accent/[0.09] via-transparent to-accentAlt/[0.07] lg:flex">
      <SidebarBrand />

      <div className="px-5 pb-2 pt-5">
        <span className="text-[11px] font-medium text-muted">{t('navManage')}</span>
      </div>

      <SidebarNav />
      <SidebarFooter />
    </aside>
  )
}
