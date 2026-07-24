import { motion } from 'framer-motion'

export function PageHeader({ title, description, action, breadcrumb }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mb-7 flex items-start justify-between gap-4"
    >
      <div>
        {breadcrumb && (
          <p className="mb-1 text-xs font-medium text-muted">{breadcrumb}</p>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </motion.div>
  )
}

export function Section({ title, description, action, children, className = '' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`mb-6 ${className}`}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="text-xs text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </motion.section>
  )
}
