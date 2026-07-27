import Card from './Card'

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' }

/**
 * columns accepts either a plain string or { label, align, width, hideBelow }.
 * Alignment lives on the column so the header cell and every body cell in that
 * column always agree — the usual cause of "the numbers don't line up".
 */
function normalizeColumn(column) {
  return typeof column === 'string' ? { label: column, align: 'left' } : { align: 'left', ...column }
}

const HIDE_BELOW = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
}

export function Table({ columns, children, className = '' }) {
  const normalized = columns.map(normalizeColumn)

  return (
    <Card padded={false} className={`overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <colgroup>
            {normalized.map((column, index) => (
              <col key={column.label || index} style={column.width ? { width: column.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surfaceMuted">
              {normalized.map((column, index) => (
                <th
                  key={column.label || index}
                  scope="col"
                  className={`whitespace-nowrap px-5 py-3 text-2xs font-semibold uppercase tracking-label text-muted ${
                    ALIGN[column.align]
                  } ${column.hideBelow ? HIDE_BELOW[column.hideBelow] : ''}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </Card>
  )
}

export function Row({ onClick, children, className = '' }) {
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
      role={interactive ? 'link' : undefined}
      className={`group border-b border-border/70 transition-colors last:border-b-0 ${
        interactive ? 'cursor-pointer hover:bg-accentSoft/70 focus-visible:bg-accentSoft/70' : ''
      } ${className}`}
    >
      {children}
    </tr>
  )
}

export function Cell({ children, align = 'left', hideBelow, className = '' }) {
  return (
    <td
      className={`px-5 py-3.5 align-middle ${ALIGN[align]} ${
        hideBelow ? HIDE_BELOW[hideBelow] : ''
      } ${className}`}
    >
      {children}
    </td>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="border-b border-border bg-surfaceMuted px-5 py-3.5">
        <div className="h-3 w-28 animate-pulse rounded bg-border" />
      </div>
      <div className="divide-y divide-border/70">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-6 px-5 py-4">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="h-3.5 animate-pulse rounded bg-surfaceSunken"
                style={{
                  flex: colIndex === 0 ? '0 0 12rem' : '1 1 0',
                  animationDelay: `${(rowIndex * cols + colIndex) * 40}ms`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}

export function EmptyState({ icon: Icon, title, description, action, tone = 'accent' }) {
  const iconTone = {
    accent: 'border-accent/25 bg-accentSoft text-accent',
    bad: 'border-bad/25 bg-badSoft text-bad',
  }[tone]

  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      {Icon && (
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${iconTone}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
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
