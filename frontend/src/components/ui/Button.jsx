import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary:
    'border-transparent bg-accent text-white shadow-soft hover:bg-accentHover active:translate-y-px',
  secondary:
    'border-border bg-surface text-ink shadow-hairline hover:border-borderStrong hover:bg-surfaceMuted active:translate-y-px',
  subtle: 'border-transparent bg-surfaceMuted text-inkSubtle hover:bg-surfaceSunken hover:text-ink',
  danger:
    'border-bad/25 bg-badSoft text-bad hover:border-bad hover:bg-bad hover:text-white active:translate-y-px',
  success:
    'border-good/25 bg-goodSoft text-good hover:border-good hover:bg-good hover:text-white active:translate-y-px',
  ghost: 'border-transparent text-muted hover:bg-surfaceMuted hover:text-ink',
}

// Heights are fixed so a button always lines up with an input of the same size
// when they sit side by side in a toolbar.
const SIZES = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-sm',
}

const ICON_SIZES = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-4 w-4' }

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) {
  const iconSize = ICON_SIZES[size]

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg border font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className={`${iconSize} animate-spin`} aria-hidden="true" />
      ) : (
        Icon && <Icon className={iconSize} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight className={iconSize} aria-hidden="true" />}
    </button>
  )
}

/**
 * A router link that looks like a button. Wrapping a <button> in an <a> is
 * invalid HTML and breaks keyboard activation, so navigation uses this instead.
 */
export function ButtonLink({
  to,
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  className = '',
  ...props
}) {
  const iconSize = ICON_SIZES[size]

  return (
    <Link
      to={to}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg border font-semibold transition-all duration-150 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className={iconSize} aria-hidden="true" />}
      {children}
      {IconRight && <IconRight className={iconSize} aria-hidden="true" />}
    </Link>
  )
}

export function IconButton({
  icon: Icon,
  label,
  size = 'md',
  variant = 'ghost',
  className = '',
  ...props
}) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg border transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${box} ${className}`}
      {...props}
    >
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
    </button>
  )
}
