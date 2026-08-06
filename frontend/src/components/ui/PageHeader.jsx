import { useId } from 'react'

/**
 * Page title block: an optional breadcrumb, the title in the serif, a short
 * description, and a meta line under the rule for whatever the page counts.
 */
export function PageHeader({ title, description, action, breadcrumb, meta }) {
  return (
    <div className="mb-8 animate-rise-in">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {breadcrumb && (
            <p className="mb-2 text-[12px] font-medium text-muted">
              {breadcrumb}
            </p>
          )}
          <h1 className="font-display text-[27px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            {title}
          </h1>
          {description && (
            <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
          )}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>

      {/* A hairline that starts in the accent, passes through the secondary
          hue and dissolves into the border: the rule separating the title from
          the page also carries the palette across it. */}
      <div className="mt-6 flex items-center gap-0">
        <span className="h-px w-28 bg-gradient-to-r from-accent via-accentAlt to-border" />
        <span className="h-px flex-1 bg-border" />
      </div>

      {meta && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-muted">
          {meta}
        </div>
      )}
    </div>
  )
}

/** A titled block within a page, with an optional action on the same line. */
export function Section({ title, description, action, children, className = '' }) {
  const headingId = useId()

  return (
    <section
      className={`mb-9 ${className}`}
      aria-labelledby={title ? headingId : undefined}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-[15px] font-semibold tracking-tight text-ink">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
