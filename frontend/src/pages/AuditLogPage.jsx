import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, FileDiff, RotateCcw, Search } from 'lucide-react'
import Navbar from '../components/Navbar'
import AuditDiffModal, { ACTION_KEY, ENTITY_KEY } from '../components/AuditDiffModal'
import { useT } from '../context/LanguageContext'
import { api } from '../api/client'
import { useEnvironment } from '../context/EnvironmentContext'
import {
  Badge,
  Button,
  Card,
  Cell,
  Dropdown,
  EmptyState,
  Field,
  Input,
  LeadCell,
  PageHeader,
  Pager,
  Row,
  Table,
  TableSkeleton,
} from '../components/ui'

// A page that fits on screen without the scrollbar shrinking to a sliver. The
// API returns the whole matching set, so paging happens here rather than as a
// round trip per page.
const PAGE_SIZE_OPTIONS = [10, 15, 25, 50]

const ACTION_TONE = {
  created: 'good',
  updated: 'accent',
  enabled: 'good',
  disabled: 'warn',
  toggled: 'warn',
  deleted: 'bad',
}

// Values are the API's enum strings and never translate; only the labels do.
const ACTION_VALUES = ['created', 'updated', 'enabled', 'disabled', 'toggled', 'deleted']
const ENTITY_VALUES = [
  'flag',
  'targeting_rule',
  'environment_override',
  'user_group_membership',
  'environment',
  'user',
]

const EMPTY_FILTERS = {
  actor: '',
  entity_key: '',
  entity_type: '',
  action: '',
  start: '',
  end: '',
}

export default function AuditLogPage() {
  const { selected: selectedEnv, environments } = useEnvironment()
  const t = useT()

  const [entries, setEntries] = useState([])
  const [actors, setActors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  // Off by default so the log reads as a complete history; on, it follows the
  // environment switcher like every other page.
  const [scopeToEnvironment, setScopeToEnvironment] = useState(false)
  const [diffEntry, setDiffEntry] = useState(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(15)

  const load = useCallback(() => {
    setLoading(true)
    const query = { ...filters }
    // Date inputs give a plain YYYY-MM-DD; make "end" inclusive of that day.
    if (query.end) query.end = `${query.end}T23:59:59`
    if (scopeToEnvironment && selectedEnv) query.environment_key = selectedEnv.key

    api
      .getAuditLog(query)
      .then((data) => {
        setEntries(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [filters, scopeToEnvironment, selectedEnv])

  useEffect(() => {
    load()
  }, [load])

  // Any change to the filters means the old page number points at a different
  // slice of a different list — start again from the top.
  useEffect(() => {
    setPage(0)
  }, [filters, scopeToEnvironment, pageSize])

  useEffect(() => {
    api.getAuditActors().then(setActors).catch(() => setActors([]))
  }, [])

  const actorOptions = useMemo(
    () => [
      { value: '', label: t('allActors') },
      ...actors.map((actor) => ({ value: actor, label: actor })),
    ],
    [actors, t]
  )

  const actionOptions = useMemo(
    () => [
      { value: '', label: t('allActions') },
      ...ACTION_VALUES.map((value) => ({ value, label: t(ACTION_KEY[value]) })),
    ],
    [t]
  )

  const entityOptions = useMemo(
    () => [
      { value: '', label: t('allTypes') },
      ...ENTITY_VALUES.map((value) => ({ value, label: t(ENTITY_KEY[value]) })),
    ],
    [t]
  )

  const columns = [
    t('colTimestamp'),
    t('fieldActor'),
    t('colEntity'),
    t('fieldAction'),
    t('colChange'),
    { label: '', align: 'end' },
  ]

  const filtersActive = useMemo(
    () => Object.values(filters).some(Boolean) || scopeToEnvironment,
    [filters, scopeToEnvironment]
  )

  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visible = entries.slice(safePage * pageSize, safePage * pageSize + pageSize)

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS)
    setScopeToEnvironment(false)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Navbar title={t('auditTitle')} breadcrumb="FlagForge" />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-content">
          <PageHeader
            title={t('auditTitle')}
            description={t('auditSubtitle')}
            action={
              <Button variant="secondary" icon={RotateCcw} onClick={load} loading={loading}>
                {t('refresh')}
              </Button>
            }
          />

          <Card className="mb-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label={t('fieldActor')}>
                <Dropdown
                  value={filters.actor}
                  onChange={(value) => setFilter('actor', value)}
                  options={actorOptions}
                />
              </Field>

              <Field label={t('entityKeyLabel')}>
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    mono
                    className="ps-9"
                    value={filters.entity_key}
                    onChange={(e) => setFilter('entity_key', e.target.value)}
                    placeholder="new-checkout-flow"
                  />
                </div>
              </Field>

              <Field label={t('fieldAction')}>
                <Dropdown
                  value={filters.action}
                  onChange={(value) => setFilter('action', value)}
                  options={actionOptions}
                />
              </Field>

              <Field label={t('entityTypeLabel')}>
                <Dropdown
                  value={filters.entity_type}
                  onChange={(value) => setFilter('entity_type', value)}
                  options={entityOptions}
                />
              </Field>

              <Field label={t('dateFrom')}>
                <Input
                  type="date"
                  value={filters.start}
                  onChange={(e) => setFilter('start', e.target.value)}
                />
              </Field>

              <Field label={t('dateTo')}>
                <Input
                  type="date"
                  value={filters.end}
                  onChange={(e) => setFilter('end', e.target.value)}
                />
              </Field>

              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={scopeToEnvironment}
                    onChange={(e) => setScopeToEnvironment(e.target.checked)}
                    className="h-5 w-5 rounded border-border accent-accent fine:h-4 fine:w-4"
                  />
                  <span>
                    {t('onlyEnvironment', {
                      environment: selectedEnv?.name || t('currentEnvironment'),
                    })}
                    <span className="block text-xs text-muted">
                      {t('environmentsTracked', { count: environments.length })}
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex items-end justify-end">
                {filtersActive && (
                  <Button variant="ghost" onClick={resetFilters}>
                    {t('clearFilters')}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : error ? (
            <EmptyState icon={Activity} title={t('auditLoadError')} description={error} />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Activity}
              title={filtersActive ? t('auditNoMatches') : t('auditNothingLogged')}
              description={filtersActive ? t('auditWidenRange') : t('auditWillAppear')}
              action={
                filtersActive && (
                  <Button variant="secondary" onClick={resetFilters}>
                    {t('clearFilters')}
                  </Button>
                )
              }
            />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted">
                  {filtersActive
                    ? t('auditEntryCountFiltered', { count: entries.length })
                    : t('auditEntryCount', { count: entries.length })}
                </p>
                <label className="flex items-center gap-2 text-[11px] font-medium text-muted">
                  {t('rowsPerPage')}
                  <select
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                    className="h-9 rounded-md border border-border bg-surface px-2 text-[12px] tnum text-ink outline-none focus:border-accent fine:h-7"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <Table columns={columns}>
                {visible.map((entry) => (
                  <Row key={entry.id}>
                    <LeadCell className="whitespace-nowrap identifier text-[11px] text-muted tnum">
                      {new Date(entry.timestamp).toLocaleString()}
                    </LeadCell>
                    <Cell className="text-sm text-ink">{entry.actor}</Cell>
                    <Cell>
                      <span className="block truncate identifier text-sm text-ink">
                        {entry.entity_key || `${entry.entity_type}#${entry.entity_id}`}
                      </span>
                      <span className="text-xs text-muted">
                        {ENTITY_KEY[entry.entity_type]
                          ? t(ENTITY_KEY[entry.entity_type])
                          : entry.entity_type}
                        {entry.environment_key ? ` · ${entry.environment_key}` : ''}
                      </span>
                    </Cell>
                    <Cell>
                      <Badge tone={ACTION_TONE[entry.action] || 'neutral'}>
                        {ACTION_KEY[entry.action] ? t(ACTION_KEY[entry.action]) : entry.action}
                      </Badge>
                    </Cell>
                    {/* Capped so the diff button stays on screen at 1440px —
                        the full summary is in the title and the diff modal. */}
                    <Cell className="max-w-[250px]">
                      <span className="block truncate identifier text-xs text-muted" title={entry.summary}>
                        {entry.summary || '—'}
                      </span>
                    </Cell>
                    <Cell className="text-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={FileDiff}
                        className="whitespace-nowrap"
                        onClick={() => setDiffEntry(entry)}
                      >
                        {t('viewDiff')}
                      </Button>
                    </Cell>
                  </Row>
                ))}
              </Table>

              <Pager
                page={safePage}
                pageCount={pageCount}
                onPrevious={() => setPage((current) => Math.max(0, current - 1))}
                onNext={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                labels={{
                  previous: t('pagerPrevious'),
                  next: t('pagerNext'),
                  range: t('pagerRange', {
                    from: safePage * pageSize + 1,
                    to: Math.min(entries.length, (safePage + 1) * pageSize),
                    total: entries.length,
                  }),
                  pageOf: t('pagerPageOf', { page: safePage + 1, pages: pageCount }),
                }}
              />
            </>
          )}
        </div>
      </div>

      <AuditDiffModal entry={diffEntry} onClose={() => setDiffEntry(null)} />
    </div>
  )
}
