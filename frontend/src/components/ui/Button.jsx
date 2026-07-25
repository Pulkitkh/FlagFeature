import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary: 'border border-accentDark bg-accent text-white shadow-hairline hover:bg-accentDark disabled:hover:bg-accent',
  secondary: 'border border-border bg-surface text-ink shadow-hairline hover:border-borderStrong hover:bg-surfaceMuted',
  danger: 'border border-bad/25 bg-badSoft text-bad hover:bg-bad hover:text-white hover:border-bad',
  success: 'border border-good/25 bg-goodSoft text-good hover:bg-good hover:text-white hover:border-good',
  ghost: 'border border-transparent text-muted hover:bg-surfaceMuted hover:text-ink',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
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
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        Icon && <Icon className="h-4 w-4" />
      )}
      {children}
    </button>
  )
}
