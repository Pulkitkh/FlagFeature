import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, description, children, className = '' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-30 flex items-center justify-center bg-indigo-950/35 px-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-3xl border border-white/80 bg-white/95 p-6 shadow-floating ${className}`}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
