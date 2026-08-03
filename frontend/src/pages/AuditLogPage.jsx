import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, FileDiff, RotateCcw, Search } from 'lucide-react'
import Navbar from '../components/Navbar'
import AuditDiffModal from '../components/AuditDiffModal'
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
  PageHeader,
  Row,
  Table,
  TableSkeleton,
} from '../components/ui'

const ACTION_TONE = {
  created: 'good',
  updated: 'accent',
  enabled: 'good',
  disabled: 'warn',
  toggled: 'warn',
  deleted: 'bad',
}

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'toggled', label: 'Toggled' },
  { value: 'deleted', label: 'Deleted' },
]

const ENTITY_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'flag', label: 'Flag' },
  { value: 'targeting_rule', label: 'Targeting rule' },
  { value: 'environment_override', label: 'Environment override' },
  { value: 'user_group_membership', label: 'Group membership' },
  { value: 'environment', label: 'Environment' },
]

const COLUMNS = ['Timestamp', 'Actor', 'Flag / entity', 'Action', 'Change', '']

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

  const [entries, setEntries] = useState([])
  const [actors, setActors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  // Off by default so the log reads as a complete history; on, it follows the
  // environment switcher like every other page.
  const [scopeToEnvironment, setScopeToEnvironment] = useState(false)
  const [diffEntry, setDiffEntry] = useState(null)

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

  useEffect(() => {
    api.getAuditActors().then(setActors).catch(() => setActors([]))
  }, [])

  const actorOptions = useMemo(
    () => [{ value: '', label: 'All actors' }, ...actors.map((actor) => ({ value: actor, label: actor }))],
    [actors]
  )

  const filtersActive = useMemo(
    () => Object.values(filters).some(Boolean) || scopeToEnvironment,
    [filters, scopeToEnvironment]
  )

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS)
    setScopeToEnvironment(false)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Navbar title="Audit Log" breadcrumb="FlagForge" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-content">
          <PageHeader
            title="Audit log"
            description="Every create, update, enable, disable, and targeting change — who did it, when, and exactly what moved."
            action={
              <Button variant="secondary" icon={RotateCcw} onClick={load} loading={loading}>
                Refresh
              </Button>
            }
          />

          <Card className="mb-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Actor">
                <Dropdown
                  value={filters.actor}
                  onChange={(value) => setFilter('actor', value)}
                  options={actorOptions}
                />
              </Field>

              <Field label="Flag / entity key">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input
                    mono
                    className="pl-9"
                    value={filters.entity_key}
                    onChange={(e) => setFilter('entity_key', e.target.value)}
                    placeholder="new-checkout-flow"
                  />
                </div>
              </Field>

              <Field label="Action">
                <Dropdown
                  value={filters.action}
                  onChange={(value) => setFilter('action', value)}
                  options={ACTION_OPTIONS}
                />
              </Field>

              <Field label="Entity type">
                <Dropdown
                  value={filters.entity_type}
                  onChange={(value) => setFilter('entity_type', value)}
                  options={ENTITY_OPTIONS}
                />
              </Field>

              <Field label="From">
                <Input
                  type="date"
                  value={filters.start}
                  onChange={(e) => setFilter('start', e.target.value)}
                />
              </Field>

              <Field label="To">
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
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                  <span>
                    Only {selectedEnv?.name || 'current environment'}
                    <span className="block text-xs text-muted">
                      {environments.length} environment{environments.length === 1 ? '' : 's'} tracked
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex items-end justify-end">
                {filtersActive && (
                  <Button variant="ghost" onClick={resetFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : error ? (
            <EmptyState icon={Activity} title="Couldn't load activity" description={error} />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Activity}
              title={filtersActive ? 'No entries match these filters' : 'Nothing logged yet'}
              description={
                filtersActive
                  ? 'Try widening the date range or clearing a filter.'
                  : 'Every flag create, update, and toggle will show up here.'
              }
              action={
                filtersActive && (
                  <Button variant="secondary" onClick={resetFilters}>
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <>
              <p className="mb-3 text-xs text-muted">
                {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
                {filtersActive ? ' matching your filters' : ''}
              </p>

              <Table columns={COLUMNS}>
                {entries.map((entry) => (
                  <Row key={entry.id}>
                    <Cell className="whitespace-nowrap font-mono text-xs text-muted">
                      {new Date(entry.timestamp).toLocaleString()}
                    </Cell>
                    <Cell className="text-sm text-ink">{entry.actor}</Cell>
                    <Cell>
                      <span className="block truncate font-mono text-sm text-ink">
                        {entry.entity_key || `${entry.entity_type}#${entry.entity_id}`}
                      </span>
                      <span className="text-xs text-muted">
                        {entry.entity_type}
                        {entry.environment_key ? ` · ${entry.environment_key}` : ''}
                      </span>
                    </Cell>
                    <Cell>
                      <Badge tone={ACTION_TONE[entry.action] || 'neutral'}>{entry.action}</Badge>
                    </Cell>
                    <Cell className="max-w-xs">
                      <span className="block truncate font-mono text-xs text-muted" title={entry.summary}>
                        {entry.summary || '—'}
                      </span>
                    </Cell>
                    <Cell className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={FileDiff}
                        className="whitespace-nowrap"
                        onClick={() => setDiffEntry(entry)}
                      >
                        View diff
                      </Button>
                    </Cell>
                  </Row>
                ))}
              </Table>
            </>
          )}
        </div>
      </div>

      <AuditDiffModal entry={diffEntry} onClose={() => setDiffEntry(null)} />
    </div>
  )
}
