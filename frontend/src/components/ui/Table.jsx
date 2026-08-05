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
          {/* Sticky so the header stays readable while a long log scrolls. */}
          <thead className="sticky top-0 z-[1] bg-surfaceMuted">
            <tr className="border-b border-border">
              {columns.map((column, index) => {
                const { label, align, className = '' } = columnOf(column)
                return (
                  <th
                    key={label || `col-${index}`}
                    scope="col"
                    className={`whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted ${
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
      // Keyboard users get the same affordance as clicking the row.
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
      className={`border-b border-border/70 transition-colors duration-150 last:border-b-0 ${
        interactive
          ? 'cursor-pointer hover:bg-accentSoft/60 focus-visible:bg-accentSoft/60 focus-visible:outline-none'
          : ''
      }`}
    >
      {children}
    </tr>
  )
}

export function Cell({ children, className = '' }) {
  return <td className={`px-5 py-4 align-middle ${className}`}>{children}</td>
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
                className="h-4 flex-1 animate-pulse rounded bg-hoverBg"
                style={{
                  maxWidth: c === 0 ? '160px' : undefined,
                  // Staggered so it reads as loading rather than a broken grid.
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
    <Card className="flex animate-fade-in flex-col items-center gap-4 px-6 py-16 text-center">
      {Icon && (
        <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surfaceMuted">
          <Icon className="h-5 w-5 text-accent" />
          <span className="absolute inset-0 rounded-xl ring-4 ring-accentSoft/50" aria-hidden="true" />
        </div>
      )}
      <div className="max-w-sm">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </Card>
  )
}
