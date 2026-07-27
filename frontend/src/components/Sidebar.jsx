import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Clock, Flag, LayoutDashboard, Layers, Users, X, Zap } from 'lucide-react'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Manage releases',
    items: [
      { to: '/flags', label: 'Flags', icon: Flag },
      { to: '/environments', label: 'Environments', icon: Layers },
      { to: '/groups', label: 'User groups', icon: Users },
    ],
  },
  {
    label: 'History',
    items: [{ to: '/audit-log', label: 'Audit log', icon: Clock }],
  },
]

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white shadow-soft">
        <Flag className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        <span
          className="signal-dot signal-dot--live absolute -right-0.5 -top-0.5 bg-good ring-2 ring-surface"
          aria-hidden="true"
        />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[15px] font-semibold leading-tight tracking-tight text-ink">
          FlagForge
        </span>
        <span className="block text-2xs font-semibold uppercase tracking-label text-muted">
          Release console
        </span>
      </span>
    </div>
  )
}

function NavItems({ onNavigate }) {
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-2">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-label text-muted">
            {section.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-accentSoft font-semibold text-accent'
                      : 'text-muted hover:bg-surfaceMuted hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent transition-opacity ${
                        isActive ? 'opacity-100' : 'opacity-0'
                      }`}
                      aria-hidden="true"
                    />
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-accent' : 'text-muted group-hover:text-ink'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

function Footer() {
  return (
    <div className="p-3">
      <div className="rounded-lg border border-border bg-surfaceMuted p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Zap className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          Evaluation API
        </p>
        <p className="mt-1 text-2xs leading-relaxed text-muted">
          Targeting, rollouts, and Redis-cached evaluation are live on{' '}
          <code className="font-mono text-accent">POST /evaluate</code>.
        </p>
      </div>
    </div>
  )
}

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  // Escape closes the mobile drawer, matching the modal's behaviour.
  useEffect(() => {
    if (!mobileOpen) return
    function onKeyDown(event) {
      if (event.key === 'Escape') onCloseMobile()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen, onCloseMobile])

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden w-sidebar shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="px-5 py-5">
          <Brand />
        </div>
        <NavItems />
        <Footer />
      </aside>

      {/* Mobile drawer — the nav used to disappear entirely below lg. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm animate-fade-in"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative flex h-full w-sidebar max-w-[85vw] flex-col border-r border-border bg-surface shadow-floating animate-fade-in"
          >
            <div className="flex items-center justify-between px-5 py-5">
              <Brand />
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation"
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surfaceMuted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavItems onNavigate={onCloseMobile} />
            <Footer />
          </aside>
        </div>
      )}
    </>
  )
}
