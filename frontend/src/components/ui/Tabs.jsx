/**
 * Segmented tab bar. The active tab is marked by an underline that sits on the
 * container's own bottom rule, so switching reads as moving along one surface
 * rather than as swapping two boxes.
 *
 * tabs: [{ id, label, icon?, count? }]
 */
export default function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`relative border-b border-border ${className}`} role="tablist">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon, count }) => {
          const isActive = id === active
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(id)}
              className={`relative -mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] font-semibold tracking-tight transition-colors ${
                isActive
                  ? 'border-accent text-ink'
                  : 'border-transparent text-muted hover:border-borderStrong hover:text-ink'
              }`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {label}
              {count != null && (
                <span
                  className={`rounded px-1.5 font-mono text-[10px] leading-4 tnum ${
                    isActive ? 'bg-accent text-bg' : 'bg-surfaceMuted text-muted'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
