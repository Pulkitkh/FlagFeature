import { Loader2 } from 'lucide-react'

/**
 * Primary is the accent, not ink. A black button is the safe choice and it is
 * also the flattest thing on the page — putting the palette on the one
 * committed action is what makes a screen look designed rather than defaulted.
 *
 * The label is `text-bg` rather than `text-white`: the accent inverts between
 * themes (deep violet on light, pale violet on dark), and white on the pale
 * step fails contrast.
 */
const VARIANTS = {
  primary:
    'border border-accentDark bg-accent text-bg shadow-soft hover:bg-accentDark disabled:hover:bg-accent',
  secondary:
    'border border-border bg-surface text-ink hover:border-borderStrong hover:bg-surfaceMuted',
  accent:
    'border border-accentDark bg-accent text-bg hover:bg-accentHover active:bg-accentDark disabled:hover:bg-accent',
  danger: 'border border-bad/30 bg-badSoft text-bad hover:bg-bad hover:text-white hover:border-bad',
  success:
    'border border-good/30 bg-goodSoft text-good hover:bg-good hover:text-white hover:border-good',
  ghost: 'border border-transparent text-muted hover:bg-surfaceMuted hover:text-ink',
}

// Heights step down at `sm` and above: a thumb needs more than a cursor does,
// so the compact sizes only get to be compact once there is a pointer.
const SIZES = {
  sm: 'h-9 px-3 text-xs fine:h-8',
  md: 'h-10 px-4 text-[13px] fine:h-9',
  lg: 'h-11 px-5 text-sm',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold tracking-tight transition-all duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        Icon && <Icon className="h-3.5 w-3.5" />
      )}
      {children}
    </button>
  )
}
