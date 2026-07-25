export function PageHeader({ title, description, action, breadcrumb }) {
  return (
    <div className="mb-7 flex items-start justify-between gap-4">
      <div>
        {breadcrumb && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{breadcrumb}</p>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Section({ title, description, action, children, className = '' }) {
  return (
    <section className={`mb-6 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="text-xs text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
