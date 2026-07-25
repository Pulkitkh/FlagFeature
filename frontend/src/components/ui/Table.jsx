import Card from './Card'

export function Table({ columns, children }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surfaceMuted">
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted"
                >
                  {col}
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

export function Row({ onClick, children }) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-border/70 last:border-b-0 transition-colors ${
        onClick ? 'cursor-pointer hover:bg-accentSoft/60' : ''
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
          <div key={r} className="flex gap-4 px-5 py-4">
            {[...Array(cols)].map((_, c) => (
              <div
                key={c}
                className="h-4 flex-1 animate-pulse rounded bg-hoverBg"
                style={{ maxWidth: c === 0 ? '160px' : undefined }}
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
    <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      {Icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surfaceMuted">
          <Icon className="h-5 w-5 text-accent" />
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </Card>
  )
}
