import { motion } from 'framer-motion'
import Card from './Card'

export function Table({ columns, children }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-gradient-to-r from-indigo-50/90 via-white to-violet-50/90">
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted"
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

export function Row({ onClick, children, index = 0 }) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: Math.min(index * 0.03, 0.3) }}
      onClick={onClick}
      className={`border-b border-border/70 last:border-b-0 transition-colors ${
        onClick ? 'cursor-pointer hover:bg-indigo-50/60' : ''
      }`}
    >
      {children}
    </motion.tr>
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
          <div key={r} className="flex gap-4 px-4 py-4">
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
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100">
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
