import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const WIDTHS = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className = '',
}) {
  const panelRef = useRef(null)

  // Escape closes, and the page behind stops scrolling while the dialog is up.
  useEffect(() => {
    if (!open) return

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose?.()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    // Move focus into the dialog so keyboard users aren't left behind it.
    const focusTarget = panelRef.current?.querySelector(
      'input, textarea, select, button:not([aria-label="Close"])'
    )
    focusTarget?.focus({ preventScroll: true })

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm animate-fade-in sm:items-center"
    >
      <div
        ref={panelRef}
        className={`w-full ${WIDTHS[size]} overflow-hidden rounded-2xl border border-border bg-surface shadow-floating animate-dialog-in ${className}`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h2>
            )}
            {description && <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surfaceMuted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 pb-6">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-border bg-surfaceMuted px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
