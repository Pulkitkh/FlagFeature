export function Field({ label, hint, error, required, children }) {
  return (
    <label className="mb-4 block last:mb-0">
      {label && (
        <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-ink">
          {label}
          {required && <span className="text-bad">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  )
}

const baseInputClasses =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-surfaceMuted'

export function Input({ className = '', mono = false, ...props }) {
  return <input className={`${baseInputClasses} ${mono ? 'font-mono' : ''} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${baseInputClasses} resize-none ${className}`} {...props} />
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${baseInputClasses} ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Switch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span
        className={`relative h-5 w-9 rounded-full border transition-colors ${
          checked ? 'border-accentDark bg-accent' : 'border-border bg-surfaceMuted'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-hairline transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
      {label && <span className="text-sm text-ink">{label}</span>}
    </button>
  )
}
