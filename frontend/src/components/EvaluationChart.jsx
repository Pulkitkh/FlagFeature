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
import { useLanguage, useT } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { Badge, Button, Card } from './ui'

/**
 * Recharts colours are props, not classes, so they can't come from the CSS
 * variables the rest of the UI uses — they have to be chosen in JS. One hue
 * per theme, because a single series needs no colour encoding: bar length
 * already carries the value. Both violets are slot 7 of the validated data-viz
 * palette — the same hue the interface uses for selection, so the accent and
 * the series are one decision. Each step passes the validator against its own
 * surface (`validate_palette.js --mode light|dark`).
 */
const CHART_COLORS = {
  light: { series: '#4a3aa7', grid: '#e8e5e1', axis: '#6c6674' },
  dark: { series: '#9085e9', grid: '#33303c', axis: '#a09bad' },
}

const RANGES = [
  { days: 7, labelKey: 'chart7Days' },
  { days: 30, labelKey: 'chart30Days' },
]

function formatDay(iso, days, locale) {
  const date = new Date(`${iso}T00:00:00`)
  return days > 14
    ? date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
    : date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })
}

// Recharts clones this element with the hover props, so `locale` and `t` are
// passed in rather than read from context — the clone happens outside the
// provider's render tree.
function ChartTooltip({ active, payload, label, locale, t }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-floating">
      <p className="text-[11px] font-medium text-muted">
        {new Date(`${label}T00:00:00`).toLocaleDateString(locale, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
        {t('chartTooltip', { count: payload[0].value })}
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
  const t = useT()
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
            <h2 className="text-sm font-semibold text-ink">{t('evaluationVolume')}</h2>
            <p className="text-xs text-muted">
              {scoped
                ? t('chartOnlyEnvironment', { environment: environmentName || environmentKey })
                : t('chartAllEnvironments')}{' '}
              · {t('chartCountedOn')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {environmentKey && (
            <Button size="sm" variant={scoped ? 'primary' : 'secondary'} onClick={() => setScoped((s) => !s)}>
              {scoped ? environmentName || environmentKey : t('chartAllEnvs')}
            </Button>
          )}
          {RANGES.map((range) => (
            <Button
              key={range.days}
              size="sm"
              variant={days === range.days ? 'primary' : 'secondary'}
              onClick={() => setDays(range.days)}
            >
              {t(range.labelKey)}
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
              <Badge tone="accent">{t('chartTotal', { count: data.total })}</Badge>
              <Badge tone="neutral">{t('chartPeak', { count: busiest })}</Badge>
              {data.total === 0 && (
                <span className="text-xs text-muted">{t('chartNoData')}</span>
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
                    content={<ChartTooltip locale={language} t={t} />}
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
