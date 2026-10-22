"use client"

import { useId, useMemo } from "react"
import { useReducedMotion } from "motion/react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"
import { formatCompact, formatDateTime, formatNumber, formatShortDay, formatSigned } from "@/components/pages/format"
import { toneOf } from "@/components/pages/indicators"
import type { BalancePoint } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

interface ChartPoint {
  t: number
  balance: number
  delta: number
  now?: boolean
}

function BalanceTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as ChartPoint | undefined
  if (!active || !point) return null
  return (
    <div className="rounded-lg border border-[var(--color-gold)]/30 bg-[var(--color-navy-light)] px-3 py-2 shadow-xl shadow-black/40">
      <p className="font-display text-base font-semibold text-[var(--color-gold-light)] tabular-nums">
        {formatNumber(point.balance)} <span className="text-xs font-normal text-muted-foreground">points</span>
      </p>
      <p className="text-[11px] text-muted-foreground">{point.now ? "Right now" : formatDateTime(new Date(point.t).toISOString())}</p>
      {point.delta !== 0 ? <p className={cn("text-xs font-semibold tabular-nums", toneOf(point.delta))}>{formatSigned(point.delta)} in that move</p> : null}
    </div>
  )
}

export function summarizeSeries(series: BalancePoint[]) {
  if (series.length === 0) return null
  let peak = series[0]
  let low = series[0]
  for (const p of series) {
    if (p.balance > peak.balance) peak = p
    if (p.balance < low.balance) low = p
  }
  return { start: series[0], end: series[series.length - 1], peak, low }
}

interface BalanceChartProps {
  series: BalancePoint[]
  // When the data was fetched: the curve is drawn flat from the last movement up to that moment.
  asOf: number
  className?: string
}

export function BalanceChart({ series, asOf, className }: BalanceChartProps) {
  const gradientId = useId().replace(/:/g, "")
  const reduced = useReducedMotion()

  const data = useMemo<ChartPoint[]>(() => {
    const points: ChartPoint[] = series.map((p) => ({ t: Date.parse(p.at), balance: p.balance, delta: p.delta }))
    const last = points[points.length - 1]
    if (last && asOf - last.t > 60_000) points.push({ t: asOf, balance: last.balance, delta: 0, now: true })
    return points
  }, [series, asOf])

  const summary = summarizeSeries(series)
  if (!summary || data.length < 2) return null
  const last = data[data.length - 1]
  const min = Math.min(...data.map((d) => d.balance))
  const label = `Balance moved from ${formatNumber(summary.start.balance)} to ${formatNumber(summary.end.balance)} points, peaking at ${formatNumber(summary.peak.balance)} on ${formatShortDay(summary.peak.at)}.`

  return (
    <div className={cn("h-60 w-full sm:h-72", className)} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-gold)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-gold-light)" strokeOpacity={0.07} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) => formatShortDay(t)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={36}
          />
          <YAxis
            width={44}
            tickFormatter={(v: number) => formatCompact(v)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[(dataMin: number) => Math.min(0, Math.floor(dataMin / 50) * 50), "auto"]}
          />
          {min < 0 ? (
            <ReferenceLine
              y={0}
              stroke="var(--color-red-team)"
              strokeOpacity={0.45}
              label={{ value: "Debt line", position: "insideBottomLeft", fill: "var(--muted-foreground)", fontSize: 10 }}
            />
          ) : null}
          <Tooltip
            content={(props) => <BalanceTooltip {...props} />}
            cursor={{ stroke: "var(--color-gold-light)", strokeOpacity: 0.3, strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Area
            type="stepAfter"
            dataKey="balance"
            stroke="var(--color-gold)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={!reduced}
            animationDuration={900}
            activeDot={{ r: 4, fill: "var(--color-gold)", stroke: "var(--card)", strokeWidth: 2 }}
          />
          <ReferenceDot
            x={last.t}
            y={last.balance}
            r={4}
            fill="var(--color-gold)"
            stroke="var(--card)"
            strokeWidth={2}
            label={{ value: formatNumber(last.balance), position: "top", fill: "var(--color-gold-light)", fontSize: 12, fontWeight: 600 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
