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

export default function StatCard({ label, value, icon: Icon, tone = 'neutral' }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-hairline">
      <span className={`absolute inset-y-0 left-0 w-1 ${TONE_ACCENT[tone]}`} />
      <div className="flex items-center justify-between pl-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</span>
        {Icon && <Icon className={`h-4 w-4 ${TONE_TEXT[tone]}`} />}
      </div>
      <p className={`mt-2 pl-2 font-display text-3xl font-semibold tracking-tight ${TONE_TEXT[tone]}`}>{value}</p>
    </div>
  )
}
