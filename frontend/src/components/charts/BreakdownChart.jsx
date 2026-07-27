import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartTooltip from './ChartTooltip'
import useChartPalette from './useChartPalette'

/**
 * Horizontal bars for comparing magnitude across a handful of named things.
 * Horizontal because the category names are long; one hue because length
 * already encodes the value — colour would be repeating the same information.
 *
 * data: [{ label, value }]
 */
export default function BreakdownChart({
  data,
  height = 200,
  valueLabel = 'Count',
  emptyHint,
  labelWidth = 104,
}) {
  const palette = useChartPalette()
  const peak = Math.max(1, ...data.map((row) => row.value))
  const hasAnyValue = data.some((row) => row.value > 0)

  if (!data.length || !hasAnyValue) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border bg-surfaceMuted px-4 text-center text-sm text-muted"
        style={{ height }}
      >
        {emptyHint || 'Nothing to show yet.'}
      </div>
    )
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 34, bottom: 4, left: 4 }}
          barCategoryGap={10}
        >
          {/* No gridlines: every bar is directly labelled, so they'd add ink
              without adding information. */}
          <XAxis type="number" hide domain={[0, Math.ceil(peak * 1.18)]} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={labelWidth}
            tick={{ fill: palette.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: palette.grid, fillOpacity: 0.45 }}
            content={<ChartTooltip formatValue={(value) => value} />}
          />
          <Bar dataKey="value" name={valueLabel} radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((row) => (
              <Cell key={row.label} fill={palette.series1} />
            ))}
            {/* Direct labels: ≤ 4 bars, so every value can be read without the tooltip. */}
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              fill={palette.muted}
              fontSize={11}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
