const TONE_TEXT = {
  neutral: 'text-ink',
  accent: 'text-accent',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
}

const TONE_RULE = {
  neutral: 'bg-borderStrong',
  accent: 'bg-accent',
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
}

/**
 * A readout rather than a card: the label sits on top in mono, the figure is
 * the loudest thing in the block, and a short coloured rule underneath carries
 * the tone. No icon chip — four of those in a row is noise, and the number is
 * what people are here to read.
 */
export default function StatCard({ label, value, icon: Icon, tone = 'neutral', hint }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-colors duration-200 hover:border-borderStrong">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium text-muted">
          {label}
        </span>
        {Icon && (
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted transition-colors group-hover:text-ink" />
        )}
      </div>

      <p
        className={`mt-3 text-[30px] font-semibold leading-none tracking-[-0.02em] tnum ${TONE_TEXT[tone]}`}
      >
        {value}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <span className={`h-0.5 w-6 rounded-full ${TONE_RULE[tone]}`} />
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
    </div>
  )
}
