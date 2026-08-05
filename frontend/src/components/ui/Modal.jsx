import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useT } from '../../context/LanguageContext'

export default function Modal({ open, onClose, title, description, children, className = '' }) {
  const panelRef = useRef(null)
  const t = useT()

  // Escape closes, and the page behind stops scrolling while the dialog is up.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus lands inside the dialog rather than staying on the page behind it.
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-30 flex animate-fade-in items-center justify-center overflow-y-auto bg-ink/50 px-4 py-8 backdrop-blur-sm"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md animate-rise-in rounded-xl border border-border bg-surface p-6 shadow-floating focus:outline-none ${className}`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-lg font-semibold leading-tight tracking-tight text-ink">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="-me-1 -mt-1 shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-hoverBg hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
