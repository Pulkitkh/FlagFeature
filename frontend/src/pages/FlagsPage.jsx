import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Flag, CheckCircle2, XCircle, Clock, Search } from 'lucide-react'
import { api } from '../api/client'
import FlagTable from '../components/FlagTable'
import FlagForm from '../components/FlagForm'
import Navbar from '../components/Navbar'
import { PageHeader, Section, StatCard, Button, Input, Select } from '../components/ui'

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000

export default function FlagsPage() {
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
      <Navbar title="Flags" breadcrumb="FlagForge" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-content">
          <PageHeader
            title="Feature flags"
            description="Create flags and control them per environment without a deploy."
            action={
              <Button icon={Plus} onClick={() => setShowForm(true)}>
                Create flag
              </Button>
            }
          />

          <div className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4 shadow-hairline sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="signal-dot signal-dot--live bg-good" />
              <div>
                <p className="text-sm font-semibold text-ink">Evaluation engine online</p>
                <p className="text-xs text-muted">Targeting, rollouts, and overrides resolve live for every request.</p>
              </div>
            </div>
            <span className="rounded-md border border-border bg-surfaceMuted px-2.5 py-1 font-mono text-[11px] text-muted">
              {stats.total} flag{stats.total === 1 ? '' : 's'} tracked
            </span>
          </div>

          <Section>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total flags" value={stats.total} icon={Flag} tone="accent" />
              <StatCard label="Enabled" value={stats.enabled} icon={CheckCircle2} tone="good" />
              <StatCard label="Disabled" value={stats.disabled} icon={XCircle} tone="neutral" />
              <StatCard
                label="Recently updated"
                value={stats.recentlyUpdated}
                icon={Clock}
                tone="warn"
              />
            </div>
          </Section>

          <Section>
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-hairline sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by key, owner, or description…"
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="sm:w-40"
              >
                <option value="all">All statuses</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </Select>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sm:w-48"
              >
                <option value="key-asc">Key (A–Z)</option>
                <option value="key-desc">Key (Z–A)</option>
                <option value="updated-desc">Recently updated</option>
              </Select>
            </div>

            {!loading && !error && (
              <p className="mb-3 text-xs text-muted">
                {visibleFlags.length} of {flags.length} flag{flags.length === 1 ? '' : 's'}
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
