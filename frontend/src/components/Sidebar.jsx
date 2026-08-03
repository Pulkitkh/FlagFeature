import { NavLink } from 'react-router-dom'
import { Flag, Layers, Clock, Users, UserCog } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/flags', label: 'Flags', icon: Flag },
  { to: '/environments', label: 'Environments', icon: Layers },
  { to: '/groups', label: 'User groups', icon: Users },
  { to: '/audit-log', label: 'Audit log', icon: Clock },
]

export default function Sidebar() {
  const { isAdmin } = useAuth()
  // Managing accounts is admin-only, so a viewer isn't shown a door they
  // can't open. The route guards it too.
  const navItems = isAdmin
    ? [...NAV_ITEMS, { to: '/accounts', label: 'Accounts', icon: UserCog }]
    : NAV_ITEMS

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface p-3 lg:flex">
      <div className="flex flex-col h-full rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-2.5 px-4 pb-5 pt-5">
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink text-white">
            <Flag className="h-4 w-4" strokeWidth={2.25} />
            <span className="signal-dot signal-dot--live absolute -right-0.5 -top-0.5 bg-accent ring-2 ring-surface" />
          </span>
          <div>
            <span className="block font-display text-[15px] font-semibold leading-tight tracking-tight text-ink">FlagForge</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Release console</span>
          </div>
        </div>

        <div className="px-4 pb-2 pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Manage releases
          </span>
        </div>

        <nav className="flex flex-col gap-0.5 px-2.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${
                  isActive
                    ? 'bg-accentSoft font-semibold text-accentDark'
                    : 'text-muted hover:bg-surfaceMuted hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full transition-opacity ${isActive ? 'bg-accent opacity-100' : 'opacity-0'}`} />
                  <Icon className={`h-4 w-4 ${isActive ? 'text-accent' : 'text-muted group-hover:text-ink'}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto p-3">
          <div className="rounded-lg border border-border bg-surfaceMuted p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <span className="signal-dot signal-dot--live bg-good" />
              Milestone 3
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Audit diffs, analytics, cleanup, and the Python middleware are live.
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
