const TONES = {
  neutral: { icon: 'border-border bg-surfaceMuted text-muted', value: 'text-ink' },
  accent: { icon: 'border-accent/25 bg-accentSoft text-accent', value: 'text-ink' },
  good: { icon: 'border-good/25 bg-goodSoft text-good', value: 'text-ink' },
  warn: { icon: 'border-warn/25 bg-warnSoft text-warn', value: 'text-ink' },
  bad: { icon: 'border-bad/25 bg-badSoft text-bad', value: 'text-ink' },
}

/**
 * A headline number. `h-full` plus a pinned footer keeps every tile in a row
 * the same height and their values on the same baseline, whatever the label
 * length.
 */
export default function StatCard({ label, value, hint, icon: Icon, tone = 'neutral', loading = false }) {
  const t = TONES[tone] || TONES.neutral

  return (
    <div className="surface-sheen flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-hairline transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <span className="text-2xs font-semibold uppercase tracking-label text-muted">{label}</span>
        {Icon && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${t.icon}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-3 h-9 w-16 animate-pulse rounded-md bg-surfaceSunken" />
      ) : (
        <p
          className={`mt-2 font-display text-3xl font-semibold leading-none tracking-tight ${t.value}`}
        >
          {value}
        </p>
      )}

      <p className="mt-auto pt-2 text-xs text-muted">{hint || ' '}</p>
    </div>
  )
}
