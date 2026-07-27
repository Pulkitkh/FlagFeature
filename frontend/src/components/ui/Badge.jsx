const TONES = {
  neutral: { classes: 'border-border bg-surfaceMuted text-muted', dot: 'bg-muted' },
  accent: { classes: 'border-accent/25 bg-accentSoft text-accent', dot: 'bg-accent' },
  good: { classes: 'border-good/25 bg-goodSoft text-good', dot: 'bg-good' },
  warn: { classes: 'border-warn/25 bg-warnSoft text-warn', dot: 'bg-warn' },
  bad: { classes: 'border-bad/25 bg-badSoft text-bad', dot: 'bg-bad' },
}

const SIZES = {
  sm: 'h-5 gap-1 px-1.5 text-2xs',
  md: 'h-6 gap-1.5 px-2 text-xs',
}

export default function Badge({
  children,
  tone = 'neutral',
  size = 'md',
  icon: Icon,
  dot = false,
  live = false,
  className = '',
}) {
  const t = TONES[tone] || TONES.neutral
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md border font-semibold tracking-tight ${t.classes} ${SIZES[size]} ${className}`}
    >
      {dot && <span className={`signal-dot ${live ? 'signal-dot--live' : ''} ${t.dot}`} />}
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  )
}
