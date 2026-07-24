import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flag, Layers, Clock, Zap, Sparkles, Users } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/flags', label: 'Flags', icon: Flag },
  { to: '/environments', label: 'Environments', icon: Layers },
  { to: '/groups', label: 'User Groups', icon: Users },
  { to: '/audit-log', label: 'Audit Log', icon: Clock },
]

export default function Sidebar() {
  return (
    <aside className="hidden w-72 shrink-0 flex-col p-4 lg:flex">
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/70 shadow-floating backdrop-blur-xl"
      >
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-indigo-100/75 via-violet-50 to-cyan-50" />
        <div className="relative flex items-center gap-3 px-5 pb-7 pt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-glow">
            <Zap className="h-5 w-5" fill="currentColor" strokeWidth={0} />
          </div>
          <div>
            <span className="block text-lg font-bold tracking-tight text-ink">FlagForge</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Release studio</span>
          </div>
        </div>

        <div className="relative mx-4 mb-6 rounded-2xl border border-white/80 bg-white/70 p-3.5 shadow-soft">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Product workspace</p>
              <p className="text-[11px] text-muted">Ship with confidence</p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            Manage releases
          </span>
        </div>

        <nav className="flex flex-col gap-0.5 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-500 font-semibold text-white shadow-glow'
                    : 'text-muted hover:bg-white hover:text-ink hover:shadow-soft'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? 'text-white' : 'text-muted group-hover:text-accent'
                    }`}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto p-4">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 p-4 text-white shadow-card">
            <p className="text-xs font-semibold">Milestone 1</p>
            <p className="mt-1 text-[11px] leading-relaxed text-indigo-200">Your release command center is ready.</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-300 to-violet-300" /></div>
          </div>
        </div>
      </motion.div>
    </aside>
  )
}
