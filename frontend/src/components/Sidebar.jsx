import { NavLink } from 'react-router-dom'
import { Flag, Layers, Clock, Users } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/flags', label: 'Flags', icon: Flag },
  { to: '/environments', label: 'Environments', icon: Layers },
  { to: '/groups', label: 'User Groups', icon: Users },
  { to: '/audit-log', label: 'Audit Log', icon: Clock },
]

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-5">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-ink text-white">
          <Flag className="h-4 w-4" strokeWidth={2.25} />
          <span className="signal-dot signal-dot--live absolute -right-1 -top-1 bg-accent ring-2 ring-surface" />
        </div>
        <div className="leading-tight">
          <span className="block font-display text-[15px] font-semibold tracking-tight text-ink">FlagForge</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Release console</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        <span className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          Manage
        </span>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-accentSoft text-accentDark' : 'text-muted hover:bg-surfaceMuted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full transition-colors ${
                    isActive ? 'bg-accent' : 'bg-transparent'
                  }`}
                />
                <Icon className={`h-4 w-4 ${isActive ? 'text-accent' : 'text-muted group-hover:text-ink'}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <div className="rounded-lg border border-border bg-surfaceMuted p-3">
          <div className="flex items-center gap-2">
            <span className="signal-dot signal-dot--live bg-good" />
            <p className="text-xs font-semibold text-ink">Evaluation engine live</p>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            Targeting, rollouts, and overrides resolve through a single ranked chain.
          </p>
        </div>
      </div>
    </aside>
  )
}
