import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Sparkles, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useT } from '../context/LanguageContext'
import { Badge, Button, Card, Dropdown } from './ui'

const STALE_OPTIONS = [
  { value: '7', labelKey: 'stale7' },
  { value: '30', labelKey: 'stale30' },
  { value: '60', labelKey: 'stale60' },
  { value: '90', labelKey: 'stale90' },
]

const STATE_META = {
  on: { tone: 'good', labelKey: 'cleanupFullyRolledOut' },
  off: { tone: 'neutral', labelKey: 'cleanupSwitchedOff' },
}

/**
 * Flags that resolve the same way for everyone, everywhere, and have done for
 * a while — the ones safe to delete from the codebase.
 */
export default function CleanupPanel() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const t = useT()
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
      await api.reviewFlagCleanup(flagKey, t('reviewedNote'))
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
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surfaceMuted text-warn">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div>
            <h2 className="font-display text-[14px] font-bold tracking-tight text-ink">
              {t('cleanupTitle')}
            </h2>
            <p className="text-[11px] leading-relaxed text-muted">{t('cleanupHint')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dropdown
            value={staleDays}
            onChange={setStaleDays}
            options={STALE_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
            className="w-48"
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
          <p className="rounded-lg border border-bad/25 bg-badSoft px-3 py-2.5 text-sm text-bad">
            {error}
          </p>
        ) : suggestions.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-surfaceMuted px-4 py-5">
            <Check className="h-4 w-4 shrink-0 text-good" />
            <p className="text-sm text-muted">{t('cleanupEmpty')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((item) => {
              const meta = STATE_META[item.state]
              return (
                <li
                  key={item.flag_key}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surfaceMuted p-4 transition-colors hover:border-borderStrong"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/flags/${encodeURIComponent(item.flag_key)}`)}
                        className="truncate font-mono text-sm font-semibold text-ink transition-colors hover:text-accent"
                      >
                        {item.flag_key}
                      </button>
                      <Badge tone={meta ? meta.tone : 'neutral'}>
                        {meta ? t(meta.labelKey) : item.state}
                      </Badge>
                      {item.owner_team && <Badge tone="neutral">{item.owner_team}</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {/* `item.reason` is an API reason code, left as-is. */}
                      {item.reason} ·{' '}
                      {t('cleanupMeta', {
                        days: item.stale_days,
                        evaluations: item.evaluations,
                      })}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Trash2}
                      onClick={() => navigate(`/flags/${encodeURIComponent(item.flag_key)}`)}
                    >
                      {t('open')}
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        icon={Check}
                        loading={busyKey === item.flag_key}
                        onClick={() => markReviewed(item.flag_key)}
                      >
                        {t('markReviewed')}
                      </Button>
                    )}
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
