const baseInputClasses =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted/60 hover:border-borderStrong focus:border-accent focus:ring-2 focus:ring-accentSoft disabled:cursor-not-allowed disabled:bg-surfaceMuted disabled:text-muted'

/**
 * Field labels are monospace and uppercase to match the section markers — in a
 * console, the label is instrument nomenclature and the value is the reading.
 */
export function Field({ label, hint, error, children, action }) {
  return (
    <label className="block">
      {(label || action) && (
        <span className="mb-1.5 flex items-center justify-between gap-2">
          {label && (
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
              {label}
            </span>
          )}
          {action}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1.5 block text-[11px] text-muted">{hint}</span>}
      {error && <span className="mt-1.5 block text-[11px] text-bad">{error}</span>}
    </label>
  )
}

export function Input({ className = '', mono = false, ...props }) {
  return (
    <input className={`${baseInputClasses} ${mono ? 'font-mono' : ''} ${className}`} {...props} />
  )
}

export function Textarea({ className = '', mono = false, ...props }) {
  return (
    <textarea
      className={`${baseInputClasses} resize-none leading-relaxed ${mono ? 'font-mono' : ''} ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${baseInputClasses} ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="flex w-fit cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
          checked ? 'bg-ink' : 'bg-borderStrong'
        }`}
      >
        {/* Positioned rather than translated so RTL slides it the right way. */}
        <span
          className={`absolute inline-block h-3.5 w-3.5 rounded-full bg-surface shadow-hairline transition-[inset-inline-start] duration-200 ${
            checked ? 'start-[1.125rem]' : 'start-1'
          }`}
        />
      </button>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>}
      </span>
    </label>
  )
}
