export function PageHeader({ title, description, action, breadcrumb }) {
  return (
    <div className="mb-7 flex animate-rise-in flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            {breadcrumb}
          </p>
        )}
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function Section({ title, description, action, children, className = '' }) {
  return (
    <section className={`mb-8 ${className}`}>
      {(title || action) && (
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
                {/* A short rule before the heading: cheap visual anchoring that
                    says a new block started, without spending a whole card on it. */}
                <span className="h-3.5 w-0.5 rounded-full bg-accent" aria-hidden="true" />
                {title}
              </h2>
            )}
            {description && <p className="mt-1 ps-3.5 text-xs text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
