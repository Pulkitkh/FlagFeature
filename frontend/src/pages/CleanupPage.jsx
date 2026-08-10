import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Check,
  Download,
  RotateCcw,
  Search,
  Sparkles,
  Undo2,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useT } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import Navbar from '../components/Navbar'
import {
  Badge,
  Button,
  Card,
  Dropdown,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Section,
  StatCard,
  Switch,
  Table,
  Cell as TableCell,
  LeadCell,
  Row,
  TableSkeleton,
} from '../components/ui'

const STALE_OPTIONS = [
  { value: '0', labelKey: 'staleAny' },
  { value: '7', labelKey: 'stale7' },
  { value: '30', labelKey: 'stale30' },
  { value: '60', labelKey: 'stale60' },
  { value: '90', labelKey: 'stale90' },
]

const SORT_OPTIONS = [
  { value: 'idle', labelKey: 'cleanupSortIdle' },
  { value: 'evaluations', labelKey: 'cleanupSortEvaluations' },
  { value: 'key', labelKey: 'cleanupSortKey' },
]

/**
 * Recharts takes colours as props, not classes, so they are chosen in JS rather
 * than from the CSS variables the rest of the interface uses.
 *
 * `on` and `off` are slots 1 and 2 of the validated data-viz palette — they
 * encode identity (which kind of dead flag this is), not status, so they must
 * not borrow the good/bad colours. `traffic` is slot 7, the same violet the
 * per-flag evaluation chart already plots with: evaluations are one colour
 * everywhere in this product. Every step passes `validate_palette.js` against
 * its own surface in both modes.
 */
const CHART_COLORS = {
  light: { on: '#2a78d6', off: '#eb6834', traffic: '#4a3aa7', grid: '#e8e5e1', axis: '#6c6674' },
  dark: { on: '#3987e5', off: '#d95926', traffic: '#9085e9', grid: '#33303c', axis: '#a09bad' },
}

// Beyond this the bars get too thin to read and the labels collide; the table
// below still lists everything.
const CHART_LIMIT = 12

const STATE_META = {
  on: { tone: 'good', labelKey: 'cleanupFullyRolledOut' },
  off: { tone: 'neutral', labelKey: 'cleanupSwitchedOff' },
}

/** Long keys would push the category axis into the plot area. */
function shortenKey(key) {
  return key.length > 22 ? `${key.slice(0, 21)}…` : key
}

/**
 * The API reports idle time in whole days, which is the right granularity for
 * the question it was built to answer but rounds everything on a young project
 * to zero — a chart of zero-length bars. `stale_since` is a timestamp, so the
 * real interval is recoverable; this picks the largest unit that still gives
 * the shortest-idle candidate a visible bar.
 */
const MINUTE = 60000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function idleMs(item, now) {
  return Math.max(0, now - new Date(item.stale_since).getTime())
}

function unitFor(maxMs) {
  if (maxMs < 2 * HOUR) return { key: 'minutes', divisor: MINUTE, labelKey: 'cleanupUnitMinutes' }
  if (maxMs < 2 * DAY) return { key: 'hours', divisor: HOUR, labelKey: 'cleanupUnitHours' }
  return { key: 'days', divisor: DAY, labelKey: 'cleanupUnitDays' }
}

/** The table shows the largest unit that isn't zero, so "4d" beats "5760m". */
function idleLabel(ms, t) {
  if (ms >= DAY) return t('cleanupIdleDays', { days: Math.floor(ms / DAY) })
  if (ms >= HOUR) return t('cleanupIdleHours', { value: Math.floor(ms / HOUR) })
  return t('cleanupIdleMinutes', { value: Math.round(ms / MINUTE) })
}

const IDLE_TOOLTIP_KEY = {
  minutes: 'cleanupTooltipIdleMinutes',
  hours: 'cleanupTooltipIdleHours',
}

function ChartTooltip({ active, payload, t, measure, unit }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-floating">
      <p className="font-mono text-[11px] text-muted">{row.key}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
        {measure === 'idle'
          ? unit.key === 'days'
            ? t('cleanupTooltipIdle', { days: row.idle })
            : t(IDLE_TOOLTIP_KEY[unit.key], { value: row.idle })
          : t('cleanupTooltipEvaluations', { count: row.evaluations })}
      </p>
    </div>
  )
}

/**
 * A horizontal bar per candidate. Horizontal because the category labels are
 * flag keys — long, and unreadable rotated — and because ranking is the whole
 * point of both charts.
 */
function CandidateChart({ rows, measure, colors, t, colorFor, unit }) {
  const height = Math.max(140, rows.length * 34 + 24)

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={rows}
          margin={{ top: 4, right: 52, bottom: 4, left: 0 }}
          barCategoryGap={8}
        >
          {/* Vertical rules only: horizontal ones would just underline the
              category labels without helping compare lengths. */}
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: colors.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: colors.grid }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={168}
            tick={{ fill: colors.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: colors.grid, fillOpacity: 0.4 }}
            content={<ChartTooltip t={t} measure={measure} unit={unit} />}
          />
          <Bar
            dataKey={measure === 'idle' ? 'idle' : 'evaluations'}
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            // The unit is chosen from the longest-idle candidate, so a flag
            // changed minutes ago rounds to zero against a four-day backlog.
            // A 2px stub keeps it on the chart; the label states the real
            // interval, so nothing is overstated.
            minPointSize={2}
            isAnimationActive={false}
          >
            {rows.map((row) => (
              <Cell key={row.key} fill={colorFor(row)} />
            ))}
            {/* The value sits at the end of every bar, so the two states stay
                distinguishable without relying on the hue alone. */}
            <LabelList
              dataKey={measure === 'idle' ? 'idleText' : 'evaluations'}
              position="right"
              fill={colors.axis}
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Two swatches with words attached — identity is never carried by hue alone. */
function StateLegend({ colors, t }) {
  return (
    <div className="flex items-center gap-4">
      {[
        { key: 'on', color: colors.on, labelKey: 'cleanupFullyRolledOut' },
        { key: 'off', color: colors.off, labelKey: 'cleanupSwitchedOff' },
      ].map(({ key, color, labelKey }) => (
        <span key={key} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
          {t(labelKey)}
        </span>
      ))}
    </div>
  )
}

/**
 * The full cleanup view: what is dead, how long it has been dead, how much
 * traffic it still absorbs, and the controls to sign each one off.
 */
export default function CleanupPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { theme } = useTheme()
  const { language } = useLanguage()
  const t = useT()
  const colors = CHART_COLORS[theme] || CHART_COLORS.light

  const [staleDays, setStaleDays] = useState('0')
  const [includeReviewed, setIncludeReviewed] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [confirmingAll, setConfirmingAll] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [sortBy, setSortBy] = useState('idle')

  const load = useCallback(() => {
    setLoading(true)
    api
      .getCleanupSuggestions({ staleDays: Number(staleDays), includeReviewed })
      .then((data) => {
        setSuggestions(data.suggestions)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [staleDays, includeReviewed])

  useEffect(() => {
    load()
  }, [load])

  async function markReviewed(flagKey) {
    setBusyKey(flagKey)
    try {
      await api.reviewFlagCleanup(flagKey, t('reviewedNote'))
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyKey(null)
    }
  }

  async function undoReview(flagKey) {
    setBusyKey(flagKey)
    try {
      await api.unreviewFlagCleanup(flagKey)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyKey(null)
    }
  }

  // Sequential rather than parallel: this is a write per flag against the same
  // table, and a burst of them buys nothing on a list this size.
  async function markAllReviewed() {
    setMarkingAll(true)
    try {
      for (const item of visible.filter((row) => !row.reviewed)) {
        await api.reviewFlagCleanup(item.flag_key, t('reviewedNote'))
      }
      setConfirmingAll(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setMarkingAll(false)
    }
  }

  const teams = useMemo(() => {
    const found = new Set()
    suggestions.forEach((item) => found.add(item.owner_team || ''))
    return [...found].sort()
  }, [suggestions])

  const visible = useMemo(() => {
    let result = suggestions

    if (search.trim()) {
      const query = search.trim().toLowerCase()
      result = result.filter(
        (item) =>
          item.flag_key.toLowerCase().includes(query) ||
          (item.owner_team || '').toLowerCase().includes(query)
      )
    }
    if (stateFilter !== 'all') {
      result = result.filter((item) => item.state === stateFilter)
    }
    if (teamFilter !== 'all') {
      result = result.filter((item) => (item.owner_team || '') === teamFilter)
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'evaluations') return b.evaluations - a.evaluations
      if (sortBy === 'key') return a.flag_key.localeCompare(b.flag_key)
      return b.stale_days - a.stale_days
    })
  }, [suggestions, search, stateFilter, teamFilter, sortBy])

  const stats = useMemo(
    () => ({
      total: visible.length,
      rolledOut: visible.filter((item) => item.state === 'on').length,
      switchedOff: visible.filter((item) => item.state === 'off').length,
      evaluations: visible.reduce((sum, item) => sum + item.evaluations, 0),
    }),
    [visible]
  )

  // `now` is pinned to the last load rather than read per render, so the bars
  // don't creep while the page sits open.
  const measured = useMemo(() => {
    const now = Date.now()
    return visible.map((item) => ({ item, ms: idleMs(item, now) }))
  }, [visible])

  const unit = useMemo(
    () => unitFor(measured.reduce((max, row) => Math.max(max, row.ms), 0)),
    [measured]
  )

  const toChartRow = useCallback(
    ({ item, ms }) => ({
      key: item.flag_key,
      label: shortenKey(item.flag_key),
      idle: Math.round(ms / unit.divisor),
      idleText: idleLabel(ms, t),
      evaluations: item.evaluations,
      state: item.state,
    }),
    [unit, t]
  )

  // Charts rank, so they take the top slice by whichever measure they plot —
  // independent of the table's sort, which the reader controls separately.
  const backlogRows = useMemo(
    () => [...measured].sort((a, b) => b.ms - a.ms).slice(0, CHART_LIMIT).map(toChartRow),
    [measured, toChartRow]
  )

  const trafficRows = useMemo(
    () =>
      [...measured]
        .sort((a, b) => b.item.evaluations - a.item.evaluations)
        .slice(0, CHART_LIMIT)
        .map(toChartRow),
    [measured, toChartRow]
  )

  const idleByKey = useMemo(
    () => new Map(measured.map(({ item, ms }) => [item.flag_key, ms])),
    [measured]
  )

  function exportCsv() {
    const header = ['flag_key', 'state', 'reason', 'owner_team', 'stale_days', 'stale_since', 'evaluations', 'reviewed', 'reviewed_by']
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const body = visible.map((item) =>
      [
        item.flag_key,
        item.state,
        item.reason,
        item.owner_team,
        item.stale_days,
        item.stale_since,
        item.evaluations,
        item.reviewed,
        item.reviewed_by,
      ]
        .map(escape)
        .join(',')
    )

    const blob = new Blob([[header.join(','), ...body].join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `flagforge-cleanup-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const filtersActive =
    Boolean(search.trim()) || stateFilter !== 'all' || teamFilter !== 'all'
  const unreviewedCount = visible.filter((item) => !item.reviewed).length

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Navbar title={t('navCleanup')} breadcrumb="FlagForge" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-content">
          <PageHeader
            title={t('cleanupPageTitle')}
            description={t('cleanupPageSubtitle')}
            action={
              <>
                <Button
                  variant="secondary"
                  icon={Download}
                  onClick={exportCsv}
                  disabled={visible.length === 0}
                >
                  {t('cleanupExport')}
                </Button>
                <Button variant="secondary" icon={RotateCcw} onClick={load} loading={loading}>
                  {t('refresh')}
                </Button>
              </>
            }
            meta={
              !loading && (
                <span className="tnum">
                  {t('cleanupShowingCount', { shown: visible.length, total: suggestions.length })}
                </span>
              )
            }
          />

          <Card className="mb-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('cleanupSearchPlaceholder')}
                  aria-label={t('search')}
                  className="ps-9"
                />
              </div>
              <Dropdown
                value={staleDays}
                onChange={setStaleDays}
                className="lg:w-44"
                options={STALE_OPTIONS.map(({ value, labelKey }) => ({
                  value,
                  label: t(labelKey),
                }))}
              />
              <Dropdown
                value={stateFilter}
                onChange={setStateFilter}
                className="lg:w-44"
                options={[
                  { value: 'all', label: t('cleanupFilterAllStates') },
                  { value: 'on', label: t('cleanupFullyRolledOut') },
                  { value: 'off', label: t('cleanupSwitchedOff') },
                ]}
              />
              <Dropdown
                value={teamFilter}
                onChange={setTeamFilter}
                className="lg:w-44"
                options={[
                  { value: 'all', label: t('cleanupFilterAllTeams') },
                  ...teams.map((team) => ({
                    value: team,
                    label: team || t('cleanupNoTeam'),
                  })),
                ]}
              />
              <Dropdown
                value={sortBy}
                onChange={setSortBy}
                className="lg:w-48"
                options={SORT_OPTIONS.map(({ value, labelKey }) => ({
                  value,
                  label: t(labelKey),
                }))}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <Switch
                checked={includeReviewed}
                onChange={setIncludeReviewed}
                label={t('cleanupShowReviewed')}
              />
              {isAdmin && unreviewedCount > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Check}
                  onClick={() => setConfirmingAll(true)}
                >
                  {t('cleanupMarkAll')}
                </Button>
              )}
            </div>
          </Card>

          {error && (
            <p className="mb-6 rounded-lg border border-bad/25 bg-badSoft px-3 py-2.5 text-sm text-bad">
              {error}
            </p>
          )}

          <Section>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label={t('cleanupStatCandidates')}
                value={stats.total}
                icon={Sparkles}
                tone="accent"
              />
              <StatCard
                label={t('cleanupStatRolledOut')}
                value={stats.rolledOut}
                icon={Check}
                tone="good"
              />
              <StatCard
                label={t('cleanupStatSwitchedOff')}
                value={stats.switchedOff}
                icon={Undo2}
                tone="neutral"
              />
              <StatCard
                label={t('cleanupStatEvaluations')}
                value={stats.evaluations.toLocaleString(language)}
                icon={Download}
                tone="warn"
              />
            </div>
          </Section>

          {loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title={filtersActive ? t('cleanupNoMatches') : t('cleanupTitle')}
              description={
                filtersActive
                  ? t('cleanupWidenFilters')
                  : t(staleDays === '0' ? 'cleanupEmptyAnyAge' : 'cleanupEmpty')
              }
              action={
                filtersActive && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('')
                      setStateFilter('all')
                      setTeamFilter('all')
                    }}
                  >
                    {t('clearFilters')}
                  </Button>
                )
              }
            />
          ) : (
            <>
              <div className="mb-9 grid gap-4 xl:grid-cols-2">
                <Card padded={false}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                    <div className="min-w-0">
                      <h2 className="text-[14px] font-semibold tracking-tight text-ink">
                        {t('cleanupBacklogTitle')}
                      </h2>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        {t('cleanupBacklogHint')}
                      </p>
                      <p className="mt-1.5 text-[11px] font-medium text-muted">
                        {t(unit.labelKey)}
                      </p>
                    </div>
                    <StateLegend colors={colors} t={t} />
                  </div>
                  <div className="p-4">
                    <CandidateChart
                      rows={backlogRows}
                      measure="idle"
                      colors={colors}
                      t={t}
                      unit={unit}
                      colorFor={(row) => (row.state === 'on' ? colors.on : colors.off)}
                    />
                    {visible.length > CHART_LIMIT && (
                      <p className="mt-2 text-[11px] text-muted">
                        {t('cleanupChartTruncated', {
                          count: CHART_LIMIT,
                          total: visible.length,
                        })}
                      </p>
                    )}
                  </div>
                </Card>

                <Card padded={false}>
                  <div className="border-b border-border p-4">
                    <h2 className="text-[14px] font-semibold tracking-tight text-ink">
                      {t('cleanupTrafficTitle')}
                    </h2>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">
                      {t('cleanupTrafficHint')}
                    </p>
                  </div>
                  <div className="p-4">
                    {/* One measure, one series — bar length carries the value,
                        so a second colour would encode nothing. */}
                    <CandidateChart
                      rows={trafficRows}
                      measure="evaluations"
                      colors={colors}
                      t={t}
                      unit={unit}
                      colorFor={() => colors.traffic}
                    />
                    {visible.length > CHART_LIMIT && (
                      <p className="mt-2 text-[11px] text-muted">
                        {t('cleanupChartTruncated', {
                          count: CHART_LIMIT,
                          total: visible.length,
                        })}
                      </p>
                    )}
                  </div>
                </Card>
              </div>

              <Table
                columns={[
                  t('cleanupColFlag'),
                  t('cleanupColState'),
                  t('cleanupColOwner'),
                  t('cleanupColIdle'),
                  { label: t('cleanupColEvaluations'), align: 'end' },
                  { label: '', align: 'end' },
                ]}
              >
                {visible.map((item) => {
                  const meta = STATE_META[item.state]
                  return (
                    <Row key={item.flag_key}>
                      <LeadCell>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/flags/${encodeURIComponent(item.flag_key)}`)
                          }
                          className="truncate font-mono text-sm font-semibold text-ink transition-colors hover:text-accent"
                        >
                          {item.flag_key}
                        </button>
                        <p className="mt-0.5 text-xs text-muted">
                          {/* `item.reason` is an API reason string, left as-is. */}
                          {item.reason}
                        </p>
                      </LeadCell>
                      <TableCell>
                        <Badge tone={meta ? meta.tone : 'neutral'}>
                          {meta ? t(meta.labelKey) : item.state}
                        </Badge>
                        {item.reviewed && (
                          <span
                            className="ms-1.5 inline-block"
                            title={
                              item.reviewed_by
                                ? t('cleanupReviewedBy', { actor: item.reviewed_by })
                                : undefined
                            }
                          >
                            <Badge tone="accent">{t('cleanupReviewedBadge')}</Badge>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted">
                        {item.owner_team || t('cleanupNoTeam')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-ink tnum">
                        {idleLabel(idleByKey.get(item.flag_key) ?? 0, t)}
                        <span className="mt-0.5 block text-xs text-muted">
                          {t('cleanupIdleSince', {
                            date: new Date(item.stale_since).toLocaleDateString(language),
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="text-end text-sm text-ink tnum">
                        {item.evaluations.toLocaleString(language)}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              navigate(`/flags/${encodeURIComponent(item.flag_key)}`)
                            }
                          >
                            {t('open')}
                          </Button>
                          {isAdmin &&
                            (item.reviewed ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={Undo2}
                                loading={busyKey === item.flag_key}
                                onClick={() => undoReview(item.flag_key)}
                              >
                                {t('cleanupUndoReview')}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                icon={Check}
                                loading={busyKey === item.flag_key}
                                onClick={() => markReviewed(item.flag_key)}
                              >
                                {t('markReviewed')}
                              </Button>
                            ))}
                        </div>
                      </TableCell>
                    </Row>
                  )
                })}
              </Table>
            </>
          )}
        </div>
      </div>

      <Modal
        open={confirmingAll}
        onClose={() => setConfirmingAll(false)}
        title={t('cleanupMarkAllTitle', { count: unreviewedCount })}
        description={t('cleanupMarkAllBody')}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmingAll(false)}>
            {t('cancel')}
          </Button>
          <Button icon={Check} loading={markingAll} onClick={markAllReviewed}>
            {t('cleanupMarkAll')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
