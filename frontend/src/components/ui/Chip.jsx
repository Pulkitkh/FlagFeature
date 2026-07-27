import { X } from 'lucide-react'

/**
 * A removable token — one targeted user ID, one group key. Rendering the
 * remove affordance as a nested element (rather than making the whole chip a
 * button) means clicking the label doesn't silently delete the entry.
 */
export default function Chip({ children, onRemove, tone = 'accent', mono = true, title }) {
  const tones = {
    accent: 'border-accent/25 bg-accentSoft text-accent',
    good: 'border-good/25 bg-goodSoft text-good',
    neutral: 'border-border bg-surfaceMuted text-inkSubtle',
  }

  return (
    <span
      title={title}
      className={`inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border px-2 text-xs font-semibold ${
        tones[tone]
      }`}
    >
      <span className={`truncate ${mono ? 'font-mono' : ''}`}>{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${typeof children === 'string' ? children : 'item'}`}
          className="-mr-0.5 shrink-0 rounded p-0.5 opacity-60 transition-all hover:bg-bad/15 hover:text-bad hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
