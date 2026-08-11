import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight, GitCompareArrows, RotateCcw, TrendingUp } from 'lucide-react'
import { api } from '../api/client'
import { useT } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { Badge, Button, Card, Dropdown, EmptyState, Section } from './ui'

/**
 * Recharts takes colours as props rather than classes, so these are picked in
 * JS. They are slots 1, 3 and 7 of the same validated data-viz palette the
 * cleanup and evaluation charts already plot with — three environments get
 * three hues that are distinguishable to the common forms of colour blindness,
 * and every series is also labelled, so hue is never the only carrier.
 */
const SERIES_COLORS = {
  light: ['#2a78d6', '#0e7480', '#4a3aa7', '#b0521a', '#7a2f8f'],
  dark: ['#3987e5', '#5ac5c7', '#9085e9', '#e2a342', '#c07ad0'],
}

const AXIS = {
  // `grid` is a hairline; `rest` is the fill for the inactive half of a
  // stacked bar, which needs to be a visible neutral rather than a rule.
  light: { grid: '#e8e5e1', axis: '#6c6674', rest: '#cfcad9' },
  dark: { grid: '#33303c', axis: '#a09bad', rest: '#4b4560' },
}

const RANGE_OPTIONS = [
  { value: '7', labelKey: 'range7' },
  { value: '14', labelKey: 'range14' },
  { value: '30', labelKey: 'range30' },
]

function ChartTooltip({ active, payload, label, t, totalKey = 'totalEvaluations' }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum, row) => sum + (row.value || 0), 0)
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-floating">
      <p className="text-[11px] text-muted">{label}</p>
      {payload.map((row) => (
        <p key={row.dataKey} className="mt-1 flex items-center gap-2 text-[12px] text-ink">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
          <span className="flex-1">{row.name}</span>
          <span className="tnum font-semibold">{row.value?.toLocaleString()}</span>
        </p>
      ))}
      {payload.length > 1 && (
        <p className="mt-1.5 border-t border-border pt-1.5 text-[11px] text-muted">
          {t(totalKey, { count: total.toLocaleString() })}
        </p>
      )}
    </div>
  )
}

/**
 * The Environments page used to be three cards of static facts. This is the
 * part that makes it a place you go to answer a question: where is traffic
 * actually landing, how far through a rollout is each environment, and what
 * resolves differently between two of them.
 */
export default function EnvironmentInsights({ environments, flags }) {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const t = useT()
  const palette = SERIES_COLORS[theme] || SERIES_COLORS.light
  const axis = AXIS[theme] || AXIS.light

  const [days, setDays] = useState('14')
  const [traffic, setTraffic] = useState([])
  const [composition, setComposition] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Comparison picker defaults to the two furthest-apart environments, which
  // is nearly always the pair worth looking at.
  const [leftKey, setLeftKey] = useState('')
  const [rightKey, setRightKey] = useState('')
  const [diff, setDiff] = useState(null)
  const [diffLoading, setDiffLoading] = useState(false)

  useEffect(() => {
    if (environments.length < 2 || leftKey || rightKey) return
    setLeftKey(environments[0].key)
    setRightKey(environments[environments.length - 1].key)
  }, [environments, leftKey, rightKey])

  /**
   * Traffic is per flag per environment on the API, so a per-environment total
   * means summing across flags. The requests fan out in parallel and a failure
   * on one flag contributes zero rather than taking the whole chart down.
   */
  const loadTraffic = useCallback(() => {
    if (!environments.length || !flags.length) return
    setLoading(true)
    setError(null)

    Promise.all(
      environments.map((env) =>
        Promise.all(
          flags.map((flag) =>
            api
              .getFlagAnalytics(flag.key, { days: Number(days), environmentKey: env.key })
              .catch(() => null)
          )
        ).then((results) => ({ env, results: results.filter(Boolean) }))
      )
    )
      .then((perEnv) => {
        // Pivot from [env][flag][day] into one row per day with a column per
        // environment, which is the shape a multi-series chart wants.
        const byDate = new Map()
        for (const { env, results } of perEnv) {
          for (const result of results) {
            for (const point of result.series || []) {
              const row = byDate.get(point.date) || { date: point.date }
              row[env.key] = (row[env.key] || 0) + point.evaluations
              byDate.set(point.date, row)
            }
          }
        }
        const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
        // Fill gaps so a quiet environment draws a zero rather than breaking
        // the line into disconnected fragments.
        for (const row of rows) for (const env of environments) row[env.key] ??= 0
        setTraffic(rows)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [environments, flags, days])

  useEffect(() => {
    loadTraffic()
  }, [loadTraffic])

  /** How each environment's flags currently resolve — the rollout picture. */
  useEffect(() => {
    if (!environments.length || !flags.length) return
    Promise.all(
      environments.map((env) =>
        Promise.all(
          flags.map((flag) =>
            api
              .evaluateFlag({ flag_key: flag.key, environment_key: env.key })
              .then((r) => ({ key: flag.key, value: r.value }))
              .catch(() => null)
          )
        ).then((results) => {
          const live = results.filter(Boolean)
          const on = live.filter((r) => r.value === true || r.value === 'true').length
          return {
            key: env.key,
            name: env.name,
            on,
            off: live.length - on,
            total: live.length,
          }
        })
      )
    ).then(setComposition)
  }, [environments, flags])

  /** Which flags resolve differently between the two chosen environments. */
  const compare = useCallback(() => {
    if (!leftKey || !rightKey || leftKey === rightKey) return
    setDiffLoading(true)
    Promise.all(
      flags.map((flag) =>
        Promise.all([
          api.evaluateFlag({ flag_key: flag.key, environment_key: leftKey }).catch(() => null),
          api.evaluateFlag({ flag_key: flag.key, environment_key: rightKey }).catch(() => null),
        ]).then(([left, right]) => ({
          key: flag.key,
          left: left?.value,
          right: right?.value,
          leftReason: left?.reason,
          rightReason: right?.reason,
        }))
      )
    )
      .then((rows) => setDiff(rows.filter((r) => JSON.stringify(r.left) !== JSON.stringify(r.right))))
      .finally(() => setDiffLoading(false))
  }, [flags, leftKey, rightKey])

  useEffect(() => {
    compare()
  }, [compare])

  const envOptions = useMemo(
    () => environments.map((env) => ({ value: env.key, label: env.name })),
    [environments]
  )

  const busiest = useMemo(() => {
    if (!composition.length || !traffic.length) return null
    const totals = environments.map((env) => ({
      env,
      total: traffic.reduce((sum, row) => sum + (row[env.key] || 0), 0),
    }))
    return totals.sort((a, b) => b.total - a.total)[0]
  }, [composition, traffic, environments])

  return (
    <>
      <Section
        title={t('envTrafficTitle')}
        description={t('envTrafficSubtitle')}
        action={
          <div className="flex items-center gap-2">
            <Dropdown
              value={days}
              onChange={setDays}
              className="w-36"
              options={RANGE_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
            />
            <Button variant="secondary" icon={RotateCcw} onClick={loadTraffic} loading={loading}>
              {t('refresh')}
            </Button>
          </div>
        }
      >
        <Card>
          {error ? (
            <p className="rounded-lg border border-badBorder bg-badSoft px-3 py-2.5 text-sm text-bad">
              {error}
            </p>
          ) : loading ? (
            <div className="h-[260px] animate-pulse rounded-xl bg-hoverBg" />
          ) : traffic.length === 0 ? (
            <EmptyState icon={TrendingUp} title={t('envNoTraffic')} description={t('envNoTrafficHint')} />
          ) : (
            <>
              {busiest && busiest.total > 0 && (
                <p className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                  <TrendingUp className="h-3.5 w-3.5 text-accent" />
                  {t('envBusiest', {
                    environment: busiest.env.name,
                    count: busiest.total.toLocaleString(),
                  })}
                </p>
              )}
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={traffic} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                    <defs>
                      {environments.map((env, index) => (
                        <linearGradient key={env.key} id={`fill-${env.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor={palette[index % palette.length]}
                            stopOpacity={0.28}
                          />
                          <stop
                            offset="100%"
                            stopColor={palette[index % palette.length]}
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid stroke={axis.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: axis.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: axis.grid }}
                      // Only every other label on a long range, or they collide.
                      interval={traffic.length > 16 ? 3 : traffic.length > 8 ? 1 : 0}
                      tickFormatter={(d) => d.slice(5)}
                    />
                    <YAxis
                      tick={{ fill: axis.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                    />
                    <Tooltip content={<ChartTooltip t={t} />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      iconType="circle"
                      iconSize={8}
                    />
                    {environments.map((env, index) => (
                      <Area
                        key={env.key}
                        type="monotone"
                        dataKey={env.key}
                        name={env.name}
                        stroke={palette[index % palette.length]}
                        fill={`url(#fill-${env.key})`}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        isAnimationActive={false}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>
      </Section>

      <Section title={t('envRolloutTitle')} description={t('envRolloutSubtitle')}>
        <Card>
          {composition.length === 0 ? (
            <div className="h-[180px] animate-pulse rounded-xl bg-hoverBg" />
          ) : (
            <div style={{ height: Math.max(160, composition.length * 52 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={composition}
                  margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
                  barCategoryGap={14}
                >
                  <CartesianGrid stroke={axis.grid} strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: axis.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: axis.grid }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={104}
                    tick={{ fill: axis.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: axis.grid, fillOpacity: 0.35 }}
                    content={<ChartTooltip t={t} totalKey="totalFlags" />}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={8} />
                  {/* Stacked, because the question is "what share of this
                      environment's flags are live", not two separate counts. */}
                  <Bar
                    dataKey="on"
                    name={t('envResolvingOn')}
                    stackId="a"
                    fill={palette[1]}
                    radius={[0, 0, 0, 0]}
                    maxBarSize={26}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="off"
                    name={t('envResolvingOff')}
                    stackId="a"
                    fill={axis.rest}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={26}
                    isAnimationActive={false}
                  >
                    {composition.map((row) => (
                      <Cell key={row.key} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </Section>

      <Section title={t('envCompareTitle')} description={t('envCompareSubtitle')}>
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-[11px] font-medium text-muted">
                {t('envCompareLeft')}
              </label>
              <Dropdown value={leftKey} onChange={setLeftKey} options={envOptions} />
            </div>
            <span className="hidden pb-2.5 text-muted sm:block">
              <GitCompareArrows className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <label className="mb-1.5 block text-[11px] font-medium text-muted">
                {t('envCompareRight')}
              </label>
              <Dropdown value={rightKey} onChange={setRightKey} options={envOptions} />
            </div>
          </div>

          <div className="mt-5">
            {leftKey === rightKey ? (
              <p className="rounded-lg border border-dashed border-border bg-surfaceMuted px-4 py-5 text-center text-sm text-muted">
                {t('envComparePickTwo')}
              </p>
            ) : diffLoading || diff === null ? (
              <div className="h-24 animate-pulse rounded-xl bg-hoverBg" />
            ) : diff.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-goodBorder bg-goodSoft px-4 py-4">
                <span className="signal-dot bg-good" />
                <p className="text-sm text-good">{t('envCompareIdentical')}</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {diff.map((row) => (
                  <li
                    key={row.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surfaceMuted px-4 py-3 transition-colors duration-base hover:border-borderStrong"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/flags/${encodeURIComponent(row.key)}`)}
                      className="tap-pad identifier relative truncate text-sm text-ink transition-colors duration-base hover:text-accent"
                    >
                      {row.key}
                    </button>
                    <span className="flex items-center gap-2 text-[12px]">
                      <Badge tone={row.left ? 'good' : 'neutral'} mono>
                        {String(row.left)}
                      </Badge>
                      <ArrowRight className="rtl-flip h-3.5 w-3.5 text-muted" />
                      <Badge tone={row.right ? 'good' : 'neutral'} mono>
                        {String(row.right)}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </Section>
    </>
  )
}
