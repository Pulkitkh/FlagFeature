import { useEffect, useState } from 'react'
import { PlusCircle, RefreshCw, Trash2, ToggleLeft, Activity } from 'lucide-react'
import Navbar from '../components/Navbar'
import { api } from '../api/client'
import { Card, Badge, PageHeader, EmptyState, TableSkeleton } from '../components/ui'

const ACTION_META = {
  created: { tone: 'good', icon: PlusCircle, label: 'created' },
  updated: { tone: 'accent', icon: RefreshCw, label: 'updated' },
  toggled: { tone: 'warn', icon: ToggleLeft, label: 'toggled' },
  deleted: { tone: 'bad', icon: Trash2, label: 'deleted' },
}

const ICON_TONE_CLASSES = {
  good: 'bg-goodSoft text-good border-good/20',
  bad: 'bg-badSoft text-bad border-bad/20',
  warn: 'bg-warnSoft text-warn border-warn/20',
  accent: 'bg-accentSoft text-accentDark border-accent/20',
  neutral: 'bg-surfaceMuted text-muted border-border',
}

function relativeTime(dateStr) {
  const date = new Date(dateStr)
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHr = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 30) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .getAuditLog()
      .then(setEntries)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Navbar title="Audit Log" breadcrumb="FlagForge" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-content">
          <PageHeader
            title="Audit log"
            description="Every create, update, delete, and environment toggle, in order."
          />

          {loading ? (
            <TableSkeleton rows={6} cols={1} />
          ) : error ? (
            <EmptyState icon={Activity} title="Couldn't load activity" description={error} />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Nothing logged yet"
              description="Every flag create, update, and toggle will show up here."
            />
          ) : (
            <Card padded={false} className="overflow-hidden">
              <div className="border-b border-border bg-surfaceMuted px-5 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Release activity ledger
              </div>
              <ul className="relative px-5">
                <span className="absolute bottom-6 left-9 top-6 w-px bg-border" aria-hidden="true" />
                {entries.map((entry) => {
                  const meta = ACTION_META[entry.action] || {
                    tone: 'neutral',
                    icon: Activity,
                    label: entry.action,
                  }
                  const Icon = meta.icon
                  return (
                    <li key={entry.id} className="relative flex items-start gap-3 py-4">
                      <div
                        className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${ICON_TONE_CLASSES[meta.tone]}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 border-b border-border/70 pb-4 last:border-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <span className="font-mono text-sm text-ink">
                            {entry.entity_type}#{entry.entity_id}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">by {entry.actor}</p>
                      </div>
                      <span
                        className="shrink-0 font-mono text-xs text-muted"
                        title={new Date(entry.timestamp).toLocaleString()}
                      >
                        {relativeTime(entry.timestamp)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
