import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, description, children, className = '' }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-floating ${className}`}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            {title && <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted hover:bg-hoverBg hover:text-ink transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
