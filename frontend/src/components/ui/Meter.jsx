/**
 * A single ratio against a limit — the right form for "42 of 60 flags enabled".
 * A two-slice pie would be the wrong one.
 */
export default function Meter({ label, value, total, unit, tone = 'accent', caption }) {
  const safeTotal = total > 0 ? total : 0
  const percent = safeTotal ? Math.round((value / safeTotal) * 100) : 0

  const fill = {
    accent: 'bg-accent',
    good: 'bg-good',
    warn: 'bg-warn',
    bad: 'bg-bad',
  }[tone]

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="font-mono text-sm font-semibold text-ink">
          {unit ? `${value}${unit}` : `${value} / ${safeTotal}`}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surfaceSunken"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={safeTotal || 100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${fill}`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      {caption && <p className="mt-1.5 text-xs text-muted">{caption}</p>}
    </div>
  )
}
