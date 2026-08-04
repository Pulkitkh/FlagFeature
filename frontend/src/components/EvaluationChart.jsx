import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { Badge, Button, Card } from './ui'

/**
 * Recharts colours are props, not classes, so they can't come from the CSS
 * variables the rest of the UI uses — they have to be chosen in JS. One hue
 * per theme, because a single series needs no colour encoding: bar length
 * already carries the value. Both blues are from the validated data-viz
 * palette, the darker for light backgrounds and the lighter for dark ones.
 */
const CHART_COLORS = {
  light: { series: '#2a78d6', grid: '#e7ebf1', axis: '#667085' },
  dark: { series: '#3987e5', grid: '#2a3039', axis: '#98a1b0' },
}

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
]

function formatDay(iso, days, locale) {
  const date = new Date(`${iso}T00:00:00`)
  return days > 14
    ? date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
    : date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })
}

function ChartTooltip({ active, payload, label, locale }) {
  if (!active || !payload?.length) return null
  const value = payload[0].value
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-floating">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
        {new Date(`${label}T00:00:00`).toLocaleDateString(locale, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold text-ink">
        {value} evaluation{value === 1 ? '' : 's'}
      </p>
    </div>
  )
}

/**
 * How often this flag is actually evaluated. A flag nobody evaluates is a
 * candidate for deletion; one evaluated constantly is load-bearing.
 */
export default function EvaluationChart({ flagKey, environmentKey, environmentName }) {
  const { theme } = useTheme()
  const { language } = useLanguage()
  const colors = CHART_COLORS[theme] || CHART_COLORS.light
  const [days, setDays] = useState(7)
  const [scoped, setScoped] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!flagKey) return
    let cancelled = false

    setLoading(true)
    api
      .getFlagAnalytics(flagKey, {
        days,
        environmentKey: scoped ? environmentKey : undefined,
      })
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [flagKey, days, scoped, environmentKey])

  const series = data?.series ?? []
  const busiest = useMemo(
    () => series.reduce((peak, point) => Math.max(peak, point.evaluations), 0),
    [series]
  )

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surfaceMuted text-accent">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Evaluation volume</h2>
            <p className="text-xs text-muted">
              {scoped ? `${environmentName || environmentKey} only` : 'All environments'} · counted
              on every <code className="font-mono">/evaluate</code> call
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {environmentKey && (
            <Button size="sm" variant={scoped ? 'primary' : 'secondary'} onClick={() => setScoped((s) => !s)}>
              {scoped ? environmentName || environmentKey : 'All envs'}
            </Button>
          )}
          {RANGES.map((range) => (
            <Button
              key={range.days}
              size="sm"
              variant={days === range.days ? 'primary' : 'secondary'}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="h-56 animate-pulse rounded-xl bg-hoverBg" />
        ) : error ? (
          <p className="py-10 text-center text-sm text-bad">{error}</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="accent">{data.total} total</Badge>
              <Badge tone="neutral">peak {busiest}/day</Badge>
              {data.total === 0 && (
                <span className="text-xs text-muted">
                  No evaluations recorded yet — call <code className="font-mono">POST /evaluate</code>{' '}
                  or use the test panel below.
                </span>
              )}
            </div>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => formatDay(value, days, language)}
                    tick={{ fill: colors.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: colors.grid }}
                    minTickGap={16}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, (max) => Math.max(1, Math.ceil(max * 1.2))]}
                    tick={{ fill: colors.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    cursor={{ fill: colors.grid, fillOpacity: 0.5 }}
                    content={<ChartTooltip locale={language} />}
                  />
                  {/* Rounded top corners, square at the baseline. */}
                  <Bar dataKey="evaluations" fill={colors.series} radius={[4, 4, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
