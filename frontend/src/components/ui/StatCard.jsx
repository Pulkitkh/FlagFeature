import { motion } from 'framer-motion'

const TONE_ICON_BG = {
  neutral: 'from-slate-100 to-slate-50 text-slate-600',
  accent: 'from-indigo-500 to-violet-500 text-white',
  good: 'from-emerald-500 to-teal-500 text-white',
  warn: 'from-amber-400 to-orange-500 text-white',
  bad: 'from-rose-500 to-pink-500 text-white',
}

const TONE_CARD = {
  neutral: 'from-white/95 to-slate-50/85',
  accent: 'from-indigo-50/95 via-white/95 to-violet-50/90',
  good: 'from-emerald-50/95 via-white/95 to-teal-50/90',
  warn: 'from-amber-50/95 via-white/95 to-orange-50/90',
  bad: 'from-rose-50/95 via-white/95 to-pink-50/90',
}

export default function StatCard({ label, value, icon: Icon, tone = 'neutral', index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.18 } }}
      className={`group relative overflow-hidden rounded-2xl border border-white/90 bg-gradient-to-br p-5 shadow-card ${TONE_CARD[tone]}`}
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/55 blur-2xl transition-transform duration-300 group-hover:scale-125" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        {Icon && (
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-soft ${TONE_ICON_BG[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted">Overview across your workspace</p>
    </motion.div>
  )
}
