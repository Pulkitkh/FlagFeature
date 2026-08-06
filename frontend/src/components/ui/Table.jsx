import Card from './Card'

/**
 * `columns` entries may be a string or `{ label, align, className }` — the
 * object form exists so a trailing actions column can be end-aligned without
 * every caller repeating the class names.
 */
function columnOf(column) {
  return typeof column === 'string' ? { label: column } : column
}

export function Table({ columns, children }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-sm">
          {/* Sticky so the header stays readable while a long list scrolls. */}
          <thead className="sticky top-0 z-[1] bg-surfaceMuted/95 backdrop-blur-sm">
            <tr className="border-b border-border">
              {columns.map((column, index) => {
                const { label, align, className = '' } = columnOf(column)
                return (
                  <th
                    key={label || `col-${index}`}
                    scope="col"
                    className={`whitespace-nowrap px-5 py-2.5 text-[11px] font-medium text-muted ${
                      align === 'end' ? 'text-end' : 'text-start'
                    } ${className}`}
                  >
                    {label}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </Card>
  )
}

export function Row({ onClick, children }) {
  const interactive = Boolean(onClick)
  return (
    <tr
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick(event)
              }
            }
          : undefined
      }
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      // The hover state is a surface shift plus an accent edge on the leading
      // cell, so the row you're on is unambiguous without a heavy fill.
      className={`group border-b border-border/70 transition-colors duration-150 last:border-b-0 ${
        interactive
          ? 'cursor-pointer hover:bg-surfaceMuted focus-visible:bg-surfaceMuted focus-visible:outline-none'
          : ''
      }`}
    >
      {children}
    </tr>
  )
}

export function Cell({ children, className = '' }) {
  return <td className={`px-5 py-3.5 align-middle ${className}`}>{children}</td>
}

/** The first cell in an interactive row: carries the hover accent edge. */
export function LeadCell({ children, className = '' }) {
  return (
    <td className={`relative px-5 py-3.5 align-middle ${className}`}>
      <span className="absolute inset-y-0 start-0 w-0.5 scale-y-0 bg-accent transition-transform duration-150 group-hover:scale-y-100" />
      {children}
    </td>
  )
}

export function TableSkeleton({ rows = 4, cols = 4 }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="divide-y divide-border">
        {[...Array(rows)].map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-4">
            {[...Array(cols)].map((_, c) => (
              <div
                key={c}
                className="h-3 flex-1 animate-pulse rounded-sm bg-hoverBg"
                style={{
                  maxWidth: c === 0 ? '160px' : undefined,
                  animationDelay: `${(r * cols + c) * 40}ms`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <Card
      tone="outline"
      className="flex animate-fade-in flex-col items-center gap-4 px-6 py-16 text-center"
    >
      {Icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface">
          <Icon className="h-4.5 w-4.5 text-muted" />
        </div>
      )}
      <div className="max-w-sm">
        <p className="font-display text-[15px] font-semibold tracking-tight text-ink">{title}</p>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </Card>
  )
}

/**
 * Next/previous pager. Rendering a slice keeps a long audit log from turning
 * the page into an endless scroll — the count line stays honest about where
 * you are in the whole set.
 */
export function Pager({ page, pageCount, total, from, to, onPrevious, onNext, labels }) {
  if (pageCount <= 1) return null

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5">
      <p className="text-[12px] text-muted tnum">
        {labels.range} · {labels.pageOf}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrevious}
          disabled={page === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:bg-surfaceMuted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface"
        >
          {labels.previous}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= pageCount - 1}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:bg-surfaceMuted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface"
        >
          {labels.next}
        </button>
      </div>
    </div>
  )
}
