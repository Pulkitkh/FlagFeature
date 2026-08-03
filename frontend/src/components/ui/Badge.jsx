const TONES = {
  neutral: { classes: 'border-border bg-surfaceMuted text-muted', dot: 'bg-muted' },
  accent: { classes: 'border-accent/25 bg-accentSoft text-accentDark', dot: 'bg-accent' },
  good: { classes: 'border-good/20 bg-goodSoft text-good', dot: 'bg-good' },
  warn: { classes: 'border-warn/20 bg-warnSoft text-warn', dot: 'bg-warn' },
  bad: { classes: 'border-bad/20 bg-badSoft text-bad', dot: 'bg-bad' },
}

export default function Badge({ children, tone = 'neutral', icon: Icon, dot = false, live = false, className = '' }) {
  const t = TONES[tone] || TONES.neutral
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold tracking-tight ${t.classes} ${className}`}
    >
      {dot && <span className={`signal-dot ${live ? 'signal-dot--live' : ''} ${t.dot}`} />}
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  )
}
