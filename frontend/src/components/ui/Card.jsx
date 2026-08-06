/**
 * `tone="raised"` is the default flat card. `tone="inset"` reads as a recessed
 * well — used for panels sitting inside another card, so nesting shows as depth
 * rather than as two identical boxes with a gap.
 */
const TONES = {
  raised: 'border-border bg-surface shadow-hairline',
  inset: 'border-border bg-surfaceMuted',
  outline: 'border-dashed border-borderStrong bg-transparent',
}

export default function Card({
  children,
  className = '',
  padded = true,
  tone = 'raised',
  ...props
}) {
  return (
    <div
      className={`rounded-xl border ${TONES[tone] || TONES.raised} ${padded ? 'p-4' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
