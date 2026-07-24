import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEnvironment } from '../context/EnvironmentContext'

const ENV_DOT_COLOR = { production: 'bg-bad', staging: 'bg-warn', development: 'bg-good' }

export default function EnvironmentSwitcher() {
  const { environments, selected, setSelectedKey, loading } = useEnvironment()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => { const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close) }, [])
  if (loading) return <div className="h-9 w-40 animate-pulse rounded-xl bg-hoverBg" />

  return <div className="relative" ref={ref}>
    <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-sm font-semibold text-ink shadow-soft transition-all hover:-translate-y-0.5 hover:bg-white">
      <span className={`h-2 w-2 rounded-full ${ENV_DOT_COLOR[selected?.key] || 'bg-muted'}`} />{selected?.name || 'No environment'}<ChevronDown className="h-3.5 w-3.5 text-muted" />
    </button>
    <AnimatePresence>{open && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }} className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-floating backdrop-blur-xl">
      {environments.map((env) => <button key={env.key} onClick={() => { setSelectedKey(env.key); setOpen(false) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-indigo-50"><span className={`h-2 w-2 rounded-full ${ENV_DOT_COLOR[env.key] || 'bg-muted'}`} /><span className="flex-1">{env.name}</span>{env.key === selected?.key && <Check className="h-3.5 w-3.5 text-accent" />}</button>)}
    </motion.div>}</AnimatePresence>
  </div>
}
