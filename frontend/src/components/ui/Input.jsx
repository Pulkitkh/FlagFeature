import { useId } from 'react'

const baseInputClasses =
  'w-full rounded-lg border border-border bg-surface text-sm text-ink shadow-hairline outline-none transition-all placeholder:text-muted/70 hover:border-borderStrong focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-surfaceMuted disabled:text-muted'

/**
 * Label + control + hint/error, wired together by id so clicking the label
 * focuses the control and screen readers announce the hint.
 */
export function Field({ label, hint, error, children, htmlFor }) {
  const generatedId = useId()
  const id = htmlFor || generatedId

  return (
    <div className="min-w-0">
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-2xs font-semibold uppercase tracking-label text-muted"
        >
          {label}
        </label>
      )}
      {typeof children === 'function' ? children(id) : children}
      {hint && !error && <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-bad">{error}</p>}
    </div>
  )
}

export function Input({ className = '', mono = false, ...props }) {
  return (
    <input
      className={`${baseInputClasses} h-10 px-3 ${mono ? 'font-mono' : ''} ${className}`}
      {...props}
    />
  )
}

export function Textarea({ className = '', mono = false, ...props }) {
  return (
    <textarea
      className={`${baseInputClasses} resize-y px-3 py-2.5 leading-relaxed ${
        mono ? 'font-mono' : ''
      } ${className}`}
      {...props}
    />
  )
}

export function Switch({ checked, onChange, label, description, disabled = false }) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : 'Toggle'}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'border-accent bg-accent' : 'border-border bg-surfaceSunken'
        }`}
      >
        <span
          className="inline-block h-4 w-4 transform rounded-full bg-white shadow-hairline transition-transform"
          style={{ transform: checked ? 'translateX(24px)' : 'translateX(4px)' }}
        />
      </button>
      {(label || description) && (
        <div className="min-w-0">
          {label && <p className="text-sm font-medium text-ink">{label}</p>}
          {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
        </div>
      )}
    </div>
  )
}
