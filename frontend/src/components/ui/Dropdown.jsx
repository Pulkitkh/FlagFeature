import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

/**
 * A styled single-select that replaces the native <select>, whose open option
 * list can't be themed consistently across browsers. Supports full keyboard
 * navigation (arrows, Home/End, Enter, Escape) so it stays as usable as the
 * native control it replaces.
 *
 * options: [{ value, label, meta? }]
 */
export default function Dropdown({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  renderOption,
  renderValue,
  className = '',
  mono = false,
  disabled = false,
  id,
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef(null)
  const listRef = useRef(null)

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  useEffect(() => {
    if (!open) return

    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [open, selectedIndex])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  function commit(index) {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    setOpen(false)
  }

  function onKeyDown(event) {
    if (disabled) return

    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault()
        setOpen(true)
      }
      return
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        break
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, options.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        commit(activeIndex)
        break
      default:
        break
    }
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        onKeyDown={onKeyDown}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-left text-sm shadow-hairline outline-none transition-all disabled:cursor-not-allowed disabled:bg-surfaceMuted disabled:text-muted ${
          open
            ? 'border-accent ring-2 ring-accent/20'
            : 'border-border hover:border-borderStrong'
        }`}
      >
        <span
          className={`min-w-0 flex-1 truncate ${mono ? 'font-mono' : ''} ${
            selected ? 'text-ink' : 'text-muted'
          }`}
        >
          {selected ? (renderValue ? renderValue(selected) : selected.label) : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1.5 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lifted animate-fade-in"
        >
          {options.length === 0 && <p className="px-3 py-2.5 text-sm text-muted">No options</p>}
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isActive = index === activeIndex
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => commit(index)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  isSelected ? 'font-semibold text-accent' : 'text-ink'
                } ${isActive ? 'bg-accentSoft' : ''}`}
              >
                <span className={`min-w-0 flex-1 truncate ${mono ? 'font-mono' : ''}`}>
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
