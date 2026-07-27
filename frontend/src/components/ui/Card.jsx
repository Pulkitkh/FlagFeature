export default function Card({
  children,
  className = '',
  padded = true,
  interactive = false,
  ...props
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface shadow-hairline transition-shadow ${
        padded ? 'p-5' : ''
      } ${interactive ? 'hover:border-borderStrong hover:shadow-card' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Header strip for a card whose body is unpadded (tables, lists). Keeps the
 * title block and its action on one baseline instead of drifting apart when
 * the description wraps.
 */
export function CardHeader({ title, description, icon: Icon, action, className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surfaceMuted text-accent">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
