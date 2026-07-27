import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const TONES = {
  success: { icon: CheckCircle2, accent: 'text-good', bar: 'bg-good' },
  error: { icon: AlertCircle, accent: 'text-bad', bar: 'bg-bad' },
  info: { icon: Info, accent: 'text-accent', bar: 'bg-accent' },
}

const DISMISS_AFTER_MS = 4500

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())
  const nextId = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (message, { tone = 'info', description } = {}) => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, message, description, tone }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER_MS)
      )
      return id
    },
    [dismiss]
  )

  const value = useMemo(
    () => ({
      toast: push,
      success: (message, options) => push(message, { ...options, tone: 'success' }),
      error: (message, options) => push(message, { ...options, tone: 'error' }),
      dismiss,
    }),
    [push, dismiss]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => {
          const tone = TONES[toast.tone] || TONES.info
          const Icon = tone.icon
          return (
            <div
              key={toast.id}
              className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-border bg-surface p-3.5 pl-5 shadow-lifted animate-toast-in"
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden="true" />
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.accent}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{toast.message}</p>
                {toast.description && (
                  <p className="mt-0.5 break-words text-xs leading-relaxed text-muted">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-surfaceMuted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
