import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary:
    'border border-white/20 bg-gradient-to-r from-accent via-indigo-500 to-violet-500 text-white shadow-glow hover:brightness-105 disabled:hover:brightness-100',
  secondary:
    'border border-white/80 bg-white/75 text-ink shadow-soft backdrop-blur hover:bg-white',
  danger:
    'border border-rose-200 bg-rose-50/85 text-bad hover:bg-rose-100',
  success:
    'border border-emerald-300/50 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-soft hover:brightness-105',
  ghost:
    'text-muted hover:bg-white/75 hover:text-ink',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        Icon && <Icon className="h-4 w-4" />
      )}
      {children}
    </motion.button>
  )
}
