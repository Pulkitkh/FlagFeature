import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, Flag, Plus, Search, X, XCircle } from 'lucide-react'
import AppLayout from '../components/AppLayout'
import FlagForm from '../components/FlagForm'
import FlagTable from '../components/FlagTable'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { Button, Dropdown, Input, PageHeader, Section, StatCard } from '../components/ui'

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
]

const SORT_OPTIONS = [
  { value: 'key-asc', label: 'Key (A–Z)' },
  { value: 'key-desc', label: 'Key (Z–A)' },
  { value: 'updated-desc', label: 'Recently updated' },
]

export default function FlagsPage() {
  const toast = useToast()
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
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
      toast.success('Flag created', { description: `${payload.key} is ready to configure.` })
      load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const stats = useMemo(() => {
    const now = Date.now()
    const enabled = flags.filter((flag) => flag.enabled).length
    return {
      total: flags.length,
      enabled,
      disabled: flags.length - enabled,
      recentlyUpdated: flags.filter(
        (flag) => now - new Date(flag.updated_at).getTime() < RECENT_WINDOW_MS
      ).length,
    }
  }, [flags])

  const visibleFlags = useMemo(() => {
    let result = flags

    const query = search.trim().toLowerCase()
    if (query) {
      result = result.filter(
        (flag) =>
          flag.key.toLowerCase().includes(query) ||
          (flag.description || '').toLowerCase().includes(query) ||
          (flag.owner_team || '').toLowerCase().includes(query)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((flag) =>
        statusFilter === 'enabled' ? flag.enabled : !flag.enabled
      )
    }

    if (typeFilter !== 'all') {
      result = result.filter((flag) => flag.type === typeFilter)
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'key-asc') return a.key.localeCompare(b.key)
      if (sortBy === 'key-desc') return b.key.localeCompare(a.key)
      if (sortBy === 'updated-desc')
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      return 0
    })
  }, [flags, search, statusFilter, typeFilter, sortBy])

  const filtersActive = Boolean(search.trim()) || statusFilter !== 'all' || typeFilter !== 'all'

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setTypeFilter('all')
  }

  return (
    <AppLayout title="Flags" breadcrumb="FlagForge">
      <PageHeader
        eyebrow="Manage releases"
        title="Feature flags"
        description="Create flags and control them per environment without a deploy. Click any flag to set targeting rules and roll it out gradually."
        action={
          <Button icon={Plus} onClick={() => setShowForm(true)}>
            Create flag
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total flags"
          value={stats.total}
          icon={Flag}
          tone="accent"
          loading={loading}
          hint="Across every environment"
        />
        <StatCard
          label="Enabled"
          value={stats.enabled}
          icon={CheckCircle2}
          tone="good"
          loading={loading}
          hint="Global switch is on"
        />
        <StatCard
          label="Disabled"
          value={stats.disabled}
          icon={XCircle}
          tone="neutral"
          loading={loading}
          hint="Kill switch engaged"
        />
        <StatCard
          label="Updated today"
          value={stats.recentlyUpdated}
          icon={Clock}
          tone="warn"
          loading={loading}
          hint="In the last 24 hours"
        />
      </div>

      <Section>
        {/* One toolbar row: search grows, the selects keep a fixed width so the
            controls stay aligned instead of resizing with the results. */}
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-hairline lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by key, owner, or description…"
              aria-label="Search flags"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:items-center">
            <Dropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
              className="lg:w-40"
            />
            <Dropdown
              value={typeFilter}
              onChange={setTypeFilter}
              options={TYPE_OPTIONS}
              className="lg:w-36"
            />
            <Dropdown
              value={sortBy}
              onChange={setSortBy}
              options={SORT_OPTIONS}
              className="col-span-2 sm:col-span-1 lg:w-48"
            />
          </div>
        </div>

        {!loading && !error && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              Showing <span className="font-semibold text-ink">{visibleFlags.length}</span> of{' '}
              {flags.length} flag{flags.length === 1 ? '' : 's'}
            </p>
            {filtersActive && (
              <Button size="sm" variant="ghost" icon={X} onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}

        <FlagTable
          flags={visibleFlags}
          loading={loading}
          error={error}
          onCreate={
            filtersActive ? (
              <Button size="sm" variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button size="sm" icon={Plus} onClick={() => setShowForm(true)}>
                Create flag
              </Button>
            )
          }
        />
      </Section>

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
    </AppLayout>
  )
}
