import { useId } from 'react'

/**
 * Page title block. The eyebrow is monospace and uppercase so the page's
 * identity reads as a label on an instrument rather than as a heading in a
 * document — it also gives the display face something to sit against.
 */
export function PageHeader({ title, description, action, breadcrumb, meta }) {
  return (
    <div className="mb-8 animate-rise-in">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {breadcrumb && (
            <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
              {breadcrumb}
            </p>
          )}
          <h1 className="font-display text-[27px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
            {title}
          </h1>
          {description && (
            <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
          )}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>

      {/* A hairline with an accent lead-in: the rule that separates the title
          from the page also points at where the content starts. */}
      <div className="mt-6 flex items-center gap-0">
        <span className="h-px w-10 bg-accent" />
        <span className="h-px flex-1 bg-border" />
      </div>

      {meta && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px] text-muted">
          {meta}
        </div>
      )}
    </div>
  )
}

/**
 * A numbered block. `index` renders as `[03]` in the margin — the numbering is
 * what makes a long page feel surveyed rather than endless.
 */
export function Section({ title, description, action, children, index, className = '' }) {
  const headingId = useId()

  return (
    <section
      className={`mb-9 ${className}`}
      aria-labelledby={title ? headingId : undefined}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2.5">
              {index != null && (
                <span className="index-marker shrink-0">
                  [{String(index).padStart(2, '0')}]
                </span>
              )}
              {title && (
                <h2
                  id={headingId}
                  className="font-display text-[15px] font-bold tracking-[-0.01em] text-ink"
                >
                  {title}
                </h2>
              )}
            </div>
            {description && (
              <p className={`mt-1 text-xs leading-relaxed text-muted ${index != null ? 'ps-8' : ''}`}>
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
