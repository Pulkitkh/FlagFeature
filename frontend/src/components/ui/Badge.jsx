const TONES = {
  neutral: { classes: 'border-border bg-surfaceMuted text-muted', dot: 'bg-muted' },
  accent: { classes: 'border-accent/25 bg-accentSoft text-accentDark', dot: 'bg-accent' },
  good: { classes: 'border-good/25 bg-goodSoft text-good', dot: 'bg-good' },
  warn: { classes: 'border-warn/25 bg-warnSoft text-warn', dot: 'bg-warn' },
  bad: { classes: 'border-bad/25 bg-badSoft text-bad', dot: 'bg-bad' },
  ink: { classes: 'border-ink bg-ink text-surface', dot: 'bg-surface' },
}

/**
 * `mono` is for badges whose content is an API value rather than prose — a
 * count, a key, a state code. Keeping those in the mono face is how the console
 * signals "this came from the server" without a second colour.
 */
export default function Badge({
  children,
  tone = 'neutral',
  icon: Icon,
  dot = false,
  live = false,
  mono = false,
  className = '',
}) {
  const t = TONES[tone] || TONES.neutral
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-5 tracking-tight ${
        mono ? 'font-mono tnum' : ''
      } ${t.classes} ${className}`}
    >
      {dot && <span className={`signal-dot ${live ? 'signal-dot--live' : ''} ${t.dot}`} />}
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  )
}
