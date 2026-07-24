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
              <div className="border-b border-border/70 bg-gradient-to-r from-indigo-50 via-white to-violet-50 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Release activity</div>
              <ul className="divide-y divide-border/70">
                {entries.map((entry) => {
                  const meta = ACTION_META[entry.action] || {
                    tone: 'neutral',
                    icon: Activity,
                    label: entry.action,
                  }
                  const Icon = meta.icon
                  return (
                    <li key={entry.id} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-indigo-50/60">
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.tone === 'good' ? 'bg-emerald-100 text-good' : meta.tone === 'bad' ? 'bg-rose-100 text-bad' : meta.tone === 'warn' ? 'bg-amber-100 text-warn' : 'bg-indigo-100 text-accent'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <span className="font-mono text-sm text-ink">
                            {entry.entity_type}#{entry.entity_id}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">by {entry.actor}</p>
                      </div>
                      <span
                        className="shrink-0 text-xs text-muted"
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
