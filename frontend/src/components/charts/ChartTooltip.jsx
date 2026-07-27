/**
 * Shared tooltip shell for every chart, so hover feels identical across the
 * dashboard. Recharts hands us the hovered payload; we render it on a surface
 * that follows the current theme rather than Recharts' white default.
 */
export default function ChartTooltip({ active, payload, label, formatValue, labelFormatter }) {
  if (!active || !payload?.length) return null

  return (
    <div className="pointer-events-none rounded-lg border border-border bg-surface px-3 py-2 shadow-lifted">
      <p className="text-2xs font-semibold uppercase tracking-label text-muted">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      <div className="mt-1.5 space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey ?? entry.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: entry.color || entry.fill }}
              aria-hidden="true"
            />
            <span className="text-xs text-muted">{entry.name}</span>
            <span className="ml-auto font-mono text-xs font-semibold text-ink">
              {formatValue ? formatValue(entry.value, entry) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
