import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useT } from '../../context/LanguageContext'

/**
 * A styled single-select dropdown that replaces the native <select>, whose
 * open option list can't be themed consistently across browsers.
 *
 * options: [{ value, label, meta? }]
 */
export default function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  renderOption,
  renderValue,
  className = '',
  mono = false,
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  // Falls back to the translated "Select…" when no caller-specific hint is given.
  const placeholderText = placeholder ?? t('selectPlaceholder')

  useEffect(() => {
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-start text-[13px] outline-none transition-colors ${
          open ? 'border-accent ring-2 ring-accentSoft' : 'border-border hover:border-borderStrong'
        }`}
      >
        <span className={`truncate ${mono ? 'font-mono' : ''} ${selected ? 'text-ink' : 'text-muted'}`}>
          {selected ? (renderValue ? renderValue(selected) : selected.label) : placeholderText}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute inset-x-0 z-20 mt-1.5 max-h-64 animate-fade-in overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-floating">
          {options.length === 0 && (
            <div className="px-3 py-2.5 text-sm text-muted">{t('noOptions')}</div>
          )}
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                  isSelected ? 'bg-accentSoft font-semibold text-accentDark' : 'text-ink hover:bg-surfaceMuted'
                }`}
              >
                <span className={`flex-1 truncate ${mono ? 'font-mono' : ''}`}>
                  {renderOption ? renderOption(option) : option.label}
                </span>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
