import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Flag, CheckCircle2, XCircle, Clock, Search } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useT } from '../context/LanguageContext'
import FlagTable from '../components/FlagTable'
import FlagForm from '../components/FlagForm'
import CleanupPanel from '../components/CleanupPanel'
import Navbar from '../components/Navbar'
import { PageHeader, Section, StatCard, Button, Input, Dropdown } from '../components/ui'

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000

export default function FlagsPage() {
  const { isAdmin } = useAuth()
  const t = useT()
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('key-asc')

  const load = useCallback(() => {
    setLoading(true)
    api
      .listFlags()
      .then((data) => {
        setFlags(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(payload) {
    setSubmitting(true)
    setFormError(null)
    try {
      await api.createFlag(payload)
      setShowForm(false)
      load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const stats = useMemo(() => {
    const now = Date.now()
    const enabled = flags.filter((f) => f.enabled).length
    const recentlyUpdated = flags.filter(
      (f) => now - new Date(f.updated_at).getTime() < RECENT_WINDOW_MS
    ).length
    return {
      total: flags.length,
      enabled,
      disabled: flags.length - enabled,
      recentlyUpdated,
    }
  }, [flags])

  const visibleFlags = useMemo(() => {
    let result = flags

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (f) =>
          f.key.toLowerCase().includes(q) ||
          (f.description || '').toLowerCase().includes(q) ||
          (f.owner_team || '').toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((f) => (statusFilter === 'enabled' ? f.enabled : !f.enabled))
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'key-asc') return a.key.localeCompare(b.key)
      if (sortBy === 'key-desc') return b.key.localeCompare(a.key)
      if (sortBy === 'updated-desc')
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      return 0
    })

    return result
  }, [flags, search, statusFilter, sortBy])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Navbar title={t('navFlags')} breadcrumb="FlagForge" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-content">
          <PageHeader
            title={t('flagsTitle')}
            description={t('flagsSubtitle')}
            action={
              isAdmin && (
                <Button icon={Plus} onClick={() => setShowForm(true)}>
                  {t('createFlag')}
                </Button>
              )
            }
          />

          <div className="mb-6 flex flex-col justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 sm:flex-row sm:items-center">
            <p className="flex items-center gap-2.5 font-mono text-[11px] text-muted">
              <span className="signal-dot signal-dot--live bg-good" />
              <span className="font-medium uppercase tracking-[0.12em] text-ink">
                {t('engineOnline')}
              </span>
              <span className="hidden text-borderStrong md:inline">/</span>
              <span className="hidden md:inline">{t('engineOnlineHint')}</span>
            </p>
            <span className="shrink-0 font-mono text-[11px] text-muted tnum">
              {t('flagsTracked', { count: stats.total })}
            </span>
          </div>

          <CleanupPanel />

          <Section index={1}>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label={t('statTotalFlags')} value={stats.total} icon={Flag} tone="accent" />
              <StatCard
                label={t('statEnabled')}
                value={stats.enabled}
                icon={CheckCircle2}
                tone="good"
              />
              <StatCard
                label={t('statDisabled')}
                value={stats.disabled}
                icon={XCircle}
                tone="neutral"
              />
              <StatCard
                label={t('statRecentlyUpdated')}
                value={stats.recentlyUpdated}
                icon={Clock}
                tone="warn"
              />
            </div>
          </Section>

          <Section index={2}>
            <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-surface p-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('searchFlagsPlaceholder')}
                  aria-label={t('search')}
                  className="ps-9"
                />
              </div>
              <Dropdown
                value={statusFilter}
                onChange={setStatusFilter}
                className="sm:w-44"
                options={[
                  { value: 'all', label: t('allStatuses') },
                  { value: 'enabled', label: t('enabled') },
                  { value: 'disabled', label: t('disabled') },
                ]}
              />
              <Dropdown
                value={sortBy}
                onChange={setSortBy}
                className="sm:w-52"
                options={[
                  { value: 'key-asc', label: t('sortKeyAsc') },
                  { value: 'key-desc', label: t('sortKeyDesc') },
                  { value: 'updated-desc', label: t('sortRecent') },
                ]}
              />
            </div>

            {!loading && !error && (
              <p className="mb-3 text-xs text-muted">
                {t('showingFlags', { shown: visibleFlags.length, total: flags.length })}
              </p>
            )}

            <FlagTable flags={visibleFlags} loading={loading} error={error} />
          </Section>
        </div>
      </div>

      {showForm && (
        <FlagForm
          onSubmit={handleCreate}
          onCancel={() => {
            setShowForm(false)
            setFormError(null)
          }}
          submitting={submitting}
          error={formError}
        />
      )}
    </div>
  )
}
