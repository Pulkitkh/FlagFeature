const TONE_ACCENT = {
  neutral: 'bg-muted',
  accent: 'bg-accent',
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
}

const TONE_TEXT = {
  neutral: 'text-ink',
  accent: 'text-accent',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
}

const TONE_ICON = {
  neutral: 'border-border bg-surfaceMuted text-muted',
  accent: 'border-accent/20 bg-accentSoft text-accent',
  good: 'border-good/20 bg-goodSoft text-good',
  warn: 'border-warn/20 bg-warnSoft text-warn',
  bad: 'border-bad/20 bg-badSoft text-bad',
}

export default function StatCard({ label, value, icon: Icon, tone = 'neutral', hint }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-hairline transition-shadow duration-200 hover:shadow-soft">
      {/* `start-0` rather than `left-0` so the accent bar moves to the right
          edge under RTL instead of cutting across the text. */}
      <span className={`absolute inset-y-0 start-0 w-1 ${TONE_ACCENT[tone]}`} />

      <div className="flex items-start justify-between gap-3 ps-2">
        <span className="text-[11px] font-semibold uppercase leading-4 tracking-[0.1em] text-muted">
          {label}
        </span>
        {Icon && (
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-transform duration-200 group-hover:scale-105 ${TONE_ICON[tone]}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {/* tabular-nums keeps a row of counters from jittering as values change. */}
      <p
        className={`mt-2 ps-2 font-display text-3xl font-semibold tabular-nums tracking-tight ${TONE_TEXT[tone]}`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 ps-2 text-xs text-muted">{hint}</p>}
    </div>
  )
}
