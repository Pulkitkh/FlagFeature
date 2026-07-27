import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, PlusCircle, RefreshCw, ToggleLeft, Trash2 } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import { api } from '../api/client'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dropdown,
  EmptyState,
  PageHeader,
  TableSkeleton,
} from '../components/ui'

const ACTION_META = {
  created: { tone: 'good', icon: PlusCircle, label: 'created', iconClass: 'text-good' },
  updated: { tone: 'accent', icon: RefreshCw, label: 'updated', iconClass: 'text-accent' },
  toggled: { tone: 'warn', icon: ToggleLeft, label: 'toggled', iconClass: 'text-warn' },
  deleted: { tone: 'bad', icon: Trash2, label: 'deleted', iconClass: 'text-bad' },
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'toggled', label: 'Toggled' },
  { value: 'deleted', label: 'Deleted' },
]

function relativeTime(dateStr) {
  const date = new Date(dateStr)
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000)

  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`
  if (diffSec < 2592000) return `${Math.round(diffSec / 86400)}d ago`
  return date.toLocaleDateString()
}

function summarize(entry) {
  const details = entry.details || {}
  const parts = []

  if ('enabled' in details) parts.push(`enabled → ${JSON.stringify(details.enabled)}`)
  if ('default_value' in details) parts.push(`default → ${JSON.stringify(details.default_value)}`)
  if (Array.isArray(details.user_ids) && details.user_ids.length)
    parts.push(`${details.user_ids.length} targeted user(s)`)
  if (Array.isArray(details.group_keys) && details.group_keys.length)
    parts.push(`groups: ${details.group_keys.join(', ')}`)
  if (details.percentage !== undefined && details.percentage !== null)
    parts.push(`rollout ${details.percentage}%`)
  if (details.value !== undefined && details.value !== null)
    parts.push(`value → ${JSON.stringify(details.value)}`)

  return parts.join(' · ')
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  const load = useCallback(() => {
    setLoading(true)
    api
      .getAuditLog()
      .then((data) => {
        setEntries(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(
    () => (filter === 'all' ? entries : entries.filter((entry) => entry.action === filter)),
    [entries, filter]
  )

  return (
    <AppLayout title="Audit log" breadcrumb="FlagForge">
      <PageHeader
        eyebrow="History"
        title="Audit log"
        description="Every create, update, delete and environment toggle, newest first — so you can always answer “who changed what, and when?”."
        action={
          <>
            <Dropdown
              value={filter}
              onChange={setFilter}
              options={FILTER_OPTIONS}
              className="w-40"
            />
            <Button variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>
              Refresh
            </Button>
          </>
        }
      />

      {loading ? (
        <TableSkeleton rows={6} cols={3} />
      ) : error ? (
        <EmptyState icon={Activity} tone="bad" title="Couldn't load activity" description={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={filter === 'all' ? 'Nothing logged yet' : `No “${filter}” events`}
          description={
            filter === 'all'
              ? 'Every flag create, update and toggle will show up here.'
              : 'Try a different action filter.'
          }
        />
      ) : (
        <Card padded={false}>
          <CardHeader
            icon={Activity}
            title="Release activity ledger"
            action={<Badge tone="neutral">{visible.length} entries</Badge>}
          />
          <ul className="divide-y divide-border">
            {visible.map((entry) => {
              const meta = ACTION_META[entry.action] || {
                tone: 'neutral',
                icon: Activity,
                label: entry.action,
                iconClass: 'text-muted',
              }
              const Icon = meta.icon
              const summary = summarize(entry)

              return (
                <li key={entry.id} className="flex items-start gap-3.5 px-5 py-4">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surfaceMuted ${meta.iconClass}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={meta.tone} size="sm">
                        {meta.label}
                      </Badge>
                      <span className="truncate font-mono text-sm text-ink">
                        {entry.entity_type}
                        <span className="text-muted">#{entry.entity_id}</span>
                      </span>
                    </div>
                    {summary && (
                      <p className="mt-1 break-words font-mono text-xs text-muted">{summary}</p>
                    )}
                    <p className="mt-1 text-xs text-muted">by {entry.actor}</p>
                  </div>

                  <span
                    className="shrink-0 whitespace-nowrap font-mono text-xs text-muted"
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
    </AppLayout>
  )
}
