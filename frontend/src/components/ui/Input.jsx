const baseInputClasses =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink shadow-hairline outline-none placeholder:text-muted/70 transition-colors focus:border-accent focus:ring-2 focus:ring-accentSoft'

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  )
}

export function Input({ className = '', mono = false, ...props }) {
  return (
    <input className={`${baseInputClasses} ${mono ? 'font-mono' : ''} ${className}`} {...props} />
  )
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

export function Switch({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-border'
        }`}
      >
        <span
          className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(4px)' }}
        />
      </span>
      {label}
    </label>
  )
}
