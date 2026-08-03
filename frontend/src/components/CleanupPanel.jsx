import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Sparkles, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { Badge, Button, Card, Dropdown } from './ui'

const STALE_OPTIONS = [
  { value: '7', label: 'Stale 7+ days' },
  { value: '30', label: 'Stale 30+ days' },
  { value: '60', label: 'Stale 60+ days' },
  { value: '90', label: 'Stale 90+ days' },
]

const STATE_META = {
  on: { tone: 'good', label: 'Fully rolled out' },
  off: { tone: 'neutral', label: 'Switched off' },
}

/**
 * Flags that resolve the same way for everyone, everywhere, and have done for
 * a while — the ones safe to delete from the codebase.
 */
export default function CleanupPanel() {
  const navigate = useNavigate()
  const [staleDays, setStaleDays] = useState('30')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyKey, setBusyKey] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api
      .getCleanupSuggestions({ staleDays: Number(staleDays) })
      .then((data) => {
        setSuggestions(data.suggestions)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [staleDays])

  useEffect(() => {
    load()
  }, [load])

  async function markReviewed(flagKey) {
    setBusyKey(flagKey)
    try {
      await api.reviewFlagCleanup(flagKey, 'Reviewed from the dashboard')
      // Re-read rather than filtering locally, so the list matches the server.
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <Card padded={false} className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surfaceMuted text-warn">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Cleanup suggestions</h2>
            <p className="text-xs text-muted">
              Flags that behave the same for everyone in every environment — safe to delete from
              the code
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dropdown
            value={staleDays}
            onChange={setStaleDays}
            options={STALE_OPTIONS}
            className="w-44"
          />
          <Badge tone={suggestions.length ? 'warn' : 'good'}>
            {loading ? '—' : suggestions.length}
          </Badge>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="h-20 animate-pulse rounded-xl bg-hoverBg" />
        ) : error ? (
          <p className="text-sm text-bad">{error}</p>
        ) : suggestions.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-surfaceMuted px-4 py-5">
            <Check className="h-4 w-4 shrink-0 text-good" />
            <p className="text-sm text-muted">
              Nothing to clean up. Every flag is either still doing real work or was changed
              recently.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((item) => {
              const meta = STATE_META[item.state] || { tone: 'neutral', label: item.state }
              return (
                <li
                  key={item.flag_key}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surfaceMuted p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/flags/${encodeURIComponent(item.flag_key)}`)}
                        className="truncate font-mono text-sm font-semibold text-ink hover:text-accent"
                      >
                        {item.flag_key}
                      </button>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {item.owner_team && <Badge tone="neutral">{item.owner_team}</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {item.reason} · unchanged for {item.stale_days} day
                      {item.stale_days === 1 ? '' : 's'} · {item.evaluations} evaluation
                      {item.evaluations === 1 ? '' : 's'} recorded
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Trash2}
                      onClick={() => navigate(`/flags/${encodeURIComponent(item.flag_key)}`)}
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      icon={Check}
                      loading={busyKey === item.flag_key}
                      onClick={() => markReviewed(item.flag_key)}
                    >
                      Mark reviewed
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )
}
