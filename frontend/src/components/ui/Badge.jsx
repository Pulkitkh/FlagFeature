/*
 * Each tone's edge is now its own palette step rather than the text colour at
 * 25% opacity. An opacity guess drifts: on a dark surface `border-good/25`
 * lands somewhere between the fill and the page depending on what is behind
 * it, so the same badge had a different edge on every background.
 */
const TONES = {
  neutral: { classes: 'border-border bg-surfaceMuted text-muted', dot: 'bg-muted' },
  accent: { classes: 'border-accentMuted bg-accentSoft text-accentDark', dot: 'bg-accent' },
  good: { classes: 'border-goodBorder bg-goodSoft text-good', dot: 'bg-good' },
  warn: { classes: 'border-warnBorder bg-warnSoft text-warn', dot: 'bg-warn' },
  bad: { classes: 'border-badBorder bg-badSoft text-bad', dot: 'bg-bad' },
  ink: { classes: 'border-ink bg-ink text-surface', dot: 'bg-surface' },
}

/**
 * `mono` is for badges whose content is an API value rather than prose — a
 * count, a key, a state code. Those get the identifier treatment (medium
 * weight, opened tracking, tabular figures) so they read as literal values.
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
        mono ? 'identifier tnum' : ''
      } ${t.classes} ${className}`}
    >
      {dot && <span className={`signal-dot ${live ? 'signal-dot--live' : ''} ${t.dot}`} />}
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  )
}
