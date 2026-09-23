"use client"

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

const SERIES_COLORS = [
  "#C89B3C",
  "#0A84FF",
  "#FF453A",
  "#34C759",
  "#BF5AF2",
  "#FF9F0A",
  "#5AC8FA",
  "#FF6482",
]

const PIE_COLORS = [
  "#C89B3C",
  "#0A84FF",
  "#FF453A",
  "#34C759",
  "#BF5AF2",
  "#FF9F0A",
  "#5AC8FA",
  "#FF6482",
]

const CHART_STYLE = {
  background: "transparent",
  gridColor: "rgba(200,155,60,0.1)",
  axisColor: "rgba(240,230,210,0.3)",
  textColor: "#8B7A5E",
}

interface BalanceTimelineProps {
  data: Record<string, string | number>[]
}

export function BalanceTimelineChart({ data }: BalanceTimelineProps) {
  if (!data.length) return null

  const seriesNames = Object.keys(data[0] ?? {}).filter((k) => k !== "date")

  return (
    <div className="rounded-lg border border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-gold-light)]/50">
        Balance Over Time
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_STYLE.gridColor}
          />
          <XAxis
            dataKey="date"
            stroke={CHART_STYLE.axisColor}
            tick={{ fill: CHART_STYLE.textColor, fontSize: 11 }}
            tickFormatter={(v: string) => {
              const d = new Date(v)
              return `${d.getMonth() + 1}/${d.getDate()}`
            }}
          />
          <YAxis
            stroke={CHART_STYLE.axisColor}
            tick={{ fill: CHART_STYLE.textColor, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0F1629",
              border: "1px solid rgba(200,155,60,0.3)",
              borderRadius: 8,
              color: "#F0E6D2",
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#F0E6D2" }}
          />
          {seriesNames.slice(0, 8).map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface BetOutcomesProps {
  data: { name: string; won: number; lost: number; refunded: number }[]
}

export function BetOutcomesChart({ data }: BetOutcomesProps) {
  if (!data.length) return null

  return (
    <div className="rounded-lg border border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-gold-light)]/50">
        Bet Outcomes
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} barGap={2}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_STYLE.gridColor}
          />
          <XAxis
            dataKey="name"
            stroke={CHART_STYLE.axisColor}
            tick={{ fill: CHART_STYLE.textColor, fontSize: 11 }}
          />
          <YAxis
            stroke={CHART_STYLE.axisColor}
            tick={{ fill: CHART_STYLE.textColor, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0F1629",
              border: "1px solid rgba(200,155,60,0.3)",
              borderRadius: 8,
              color: "#F0E6D2",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#F0E6D2" }} />
          <Bar dataKey="won" fill="#34C759" radius={[4, 4, 0, 0]} />
          <Bar dataKey="lost" fill="#FF453A" radius={[4, 4, 0, 0]} />
          <Bar dataKey="refunded" fill="#8B7A5E" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface SpendingBreakdownProps {
  data: { name: string; value: number }[]
}

export function SpendingBreakdownChart({ data }: SpendingBreakdownProps) {
  if (!data.length) return null

  return (
    <div className="rounded-lg border border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-gold-light)]/50">
        Where Points Went
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={PIE_COLORS[i % PIE_COLORS.length]}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#0F1629",
              border: "1px solid rgba(200,155,60,0.3)",
              borderRadius: 8,
              color: "#F0E6D2",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
