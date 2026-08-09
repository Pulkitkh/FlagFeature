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
    'border border-accentDark bg-accent text-bg hover:bg-accentDark disabled:hover:bg-accent',
  danger: 'border border-bad/30 bg-badSoft text-bad hover:bg-bad hover:text-white hover:border-bad',
  success:
    'border border-good/30 bg-goodSoft text-good hover:bg-good hover:text-white hover:border-good',
  ghost: 'border border-transparent text-muted hover:bg-surfaceMuted hover:text-ink',
}

const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-[13px]',
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
