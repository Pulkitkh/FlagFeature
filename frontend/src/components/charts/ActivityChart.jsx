import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartTooltip from './ChartTooltip'
import useChartPalette from './useChartPalette'

const DAY_LABEL = { weekday: 'short', day: 'numeric' }
const FULL_LABEL = { weekday: 'long', month: 'short', day: 'numeric' }

function formatDay(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, DAY_LABEL)
}

function formatFullDay(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, FULL_LABEL)
}

/**
 * Change volume over time — one series, so the title names it and no legend
 * box is needed.
 */
export default function ActivityChart({ data, height = 240 }) {
  const palette = useChartPalette()
  const peak = Math.max(1, ...data.map((point) => point.changes))

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.series1} stopOpacity={0.28} />
              <stop offset="100%" stopColor={palette.series1} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDay}
            tick={{ fill: palette.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: palette.grid }}
            minTickGap={18}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, Math.ceil(peak * 1.25)]}
            tick={{ fill: palette.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: palette.border, strokeWidth: 1 }}
            content={
              <ChartTooltip
                labelFormatter={formatFullDay}
                formatValue={(value) => `${value} change${value === 1 ? '' : 's'}`}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="changes"
            name="Changes"
            stroke={palette.series1}
            strokeWidth={2}
            fill="url(#activity-fill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: palette.surface }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
