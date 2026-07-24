const TONES = {
  neutral: 'border border-slate-200 bg-slate-100/80 text-slate-600',
  accent: 'border border-indigo-200 bg-indigo-50 text-accent',
  good: 'border border-emerald-200 bg-emerald-50 text-good',
  warn: 'border border-amber-200 bg-amber-50 text-warn',
  bad: 'border border-rose-200 bg-rose-50 text-bad',
}

export default function Badge({ children, tone = 'neutral', icon: Icon, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]} ${className}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  )
}
