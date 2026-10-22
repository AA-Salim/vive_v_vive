"use client"

import { useMemo, useState } from "react"
import { useReducedMotion } from "motion/react"
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts"
import { PlayerSelect } from "@/components/pages/controls"
import { formatCompact, formatDayKey, formatNumber } from "@/components/pages/format"
import { Button } from "@/components/ui/button"
import type { ArchiveDetailResponse, ArchiveTimeline } from "@/lib/pages/types"
import { REASON_GROUPS } from "@/lib/reasons"
import { cn } from "@/lib/utils"

type Row = Record<string, number | string>

function RaceTooltip({ active, payload, focus, names }: TooltipContentProps & { focus: string; names: Map<string, string> }) {
  const row = payload?.[0]?.payload as Row | undefined
  if (!active || !row) return null
  const ranked = [...names.keys()].map((id) => ({ id, value: Number(row[id] ?? 0) })).sort((x, y) => y.value - x.value)
  const focusIndex = ranked.findIndex((r) => r.id === focus)
  return (
    <div className="min-w-44 rounded-lg border border-[var(--color-gold)]/30 bg-[var(--color-navy-light)] px-3 py-2 shadow-xl shadow-black/40">
      <p className="mb-1 text-[11px] text-muted-foreground">{formatDayKey(String(row.day))}</p>
      {focusIndex >= 0 ? (
        <p className="font-display text-base font-semibold text-[var(--color-gold)] tabular-nums">
          {formatNumber(ranked[focusIndex].value)} <span className="text-xs font-normal text-[var(--color-gold-light)]/80">#{focusIndex + 1} {names.get(focus)}</span>
        </p>
      ) : null}
      <ol className="mt-1 space-y-0.5 text-[11px]">
        {ranked.slice(0, 3).map((r, i) => (
          <li key={r.id} className="flex justify-between gap-3 text-[var(--color-gold-light)]/80">
            <span className="truncate">
              {i + 1}. {names.get(r.id)}
            </span>
            <span className="tabular-nums">{formatNumber(r.value)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function TreasuryRace({ timeline, defaultFocus }: { timeline: ArchiveTimeline; defaultFocus: string | null }) {
  const reduced = useReducedMotion()
  const [picked, setPicked] = useState<string | null>(null)
  const focus = picked ?? defaultFocus ?? timeline.series[0]?.userId ?? ""
  const names = useMemo(() => new Map(timeline.series.map((s) => [s.userId, s.name])), [timeline])
  const rows = useMemo<Row[]>(
    () =>
      timeline.days.map((day, i) => {
        const row: Row = { day }
        for (const s of timeline.series) row[s.userId] = s.values[i] ?? 0
        return row
      }),
    [timeline]
  )
  const options = useMemo(() => [...timeline.series].map((s) => ({ id: s.userId, name: s.name })).sort((x, y) => x.name.localeCompare(y.name)), [timeline])
  const focusSeries = timeline.series.find((s) => s.userId === focus)
  const lastDay = timeline.days[timeline.days.length - 1]
  const lastValue = focusSeries?.values[focusSeries.values.length - 1] ?? 0
  const peak = focusSeries ? Math.max(...focusSeries.values) : 0

  if (rows.length < 2 || !focusSeries) return <p className="py-8 text-center text-sm text-muted-foreground">Not enough days to draw the race.</p>

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-[var(--color-gold)]">{focusSeries.name}</span> in gold: peaked at {formatNumber(peak)}, finished at{" "}
          {formatNumber(lastValue)}. Everyone else in the shadows.
        </p>
        <PlayerSelect
          value={focus}
          onChange={setPicked}
          players={options}
          label="Highlight a noble"
          everyoneLabel="The champion"
          className="w-full sm:w-48"
        />
      </div>
      <div className="h-64 w-full sm:h-80" role="img" aria-label={`Balance of every noble over the act, with ${focusSeries.name} highlighted`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-gold-light)" strokeOpacity={0.07} />
            <XAxis
              dataKey="day"
              tickFormatter={(d: string) => formatDayKey(d)}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              width={44}
              domain={[(min: number) => Math.min(0, Math.floor(min / 100) * 100), "auto"]}
              tickFormatter={(v: number) => formatCompact(v)}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={(props) => <RaceTooltip {...props} focus={focus} names={names} />}
              cursor={{ stroke: "var(--color-gold-light)", strokeOpacity: 0.3, strokeWidth: 1 }}
              isAnimationActive={false}
            />
            {timeline.series
              .filter((s) => s.userId !== focus)
              .map((s) => (
                <Line
                  key={s.userId}
                  type="monotone"
                  dataKey={s.userId}
                  stroke="var(--color-gold-light)"
                  strokeOpacity={0.14}
                  strokeWidth={1}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ))}
            <Line
              key={`focus-${focus}`}
              type="monotone"
              dataKey={focus}
              stroke="var(--color-gold)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "var(--color-gold)", stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={!reduced}
              animationDuration={1000}
            />
            <ReferenceDot
              x={lastDay}
              y={lastValue}
              r={4}
              fill="var(--color-gold)"
              stroke="var(--card)"
              strokeWidth={2}
              label={{ value: formatNumber(lastValue), position: "top", fill: "var(--color-gold-light)", fontSize: 12, fontWeight: 600 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function WagerOutcomes({ bets }: { bets: ArchiveDetailResponse["bets"] }) {
  const [all, setAll] = useState(false)
  if (bets.length === 0) return <p className="text-sm text-muted-foreground">No wagers were placed this act.</p>
  const shown = all ? bets : bets.slice(0, 10)
  const max = Math.max(...bets.map((b) => b.won + b.lost + b.refunded))
  return (
    <div className="space-y-3">
      <ul className="space-y-2.5">
        {shown.map((b) => {
          const total = b.won + b.lost + b.refunded
          return (
            <li key={b.userId} className="min-w-0">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-[var(--color-gold-light)]/85">{b.name}</span>
                <span className="shrink-0 text-xs tabular-nums">
                  <span className="text-emerald-300">{b.won}W</span> <span className="text-rose-300">{b.lost}L</span>
                  {b.refunded > 0 ? <span className="text-muted-foreground"> {b.refunded}R</span> : null}
                </span>
              </div>
              <div className="mt-1 flex h-2 gap-0.5 overflow-hidden rounded-full" style={{ width: `${Math.max(8, (total / max) * 100)}%` }} aria-hidden>
                {b.won > 0 ? <span className="h-full rounded-l-full bg-emerald-400/70" style={{ flexGrow: b.won }} /> : null}
                {b.lost > 0 ? <span className={cn("h-full bg-rose-400/70", b.won === 0 && "rounded-l-full")} style={{ flexGrow: b.lost }} /> : null}
                {b.refunded > 0 ? <span className="h-full rounded-r-full bg-[var(--color-gold-light)]/25" style={{ flexGrow: b.refunded }} /> : null}
              </div>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-emerald-400/70" aria-hidden />
            Won
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-rose-400/70" aria-hidden />
            Lost
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-sm bg-[var(--color-gold-light)]/25" aria-hidden />
            Refunded
          </span>
        </p>
        {bets.length > 10 ? (
          <Button variant="ghost" className="h-10" onClick={() => setAll((v) => !v)} aria-expanded={all}>
            {all ? "Top 10 only" : `All ${bets.length} bettors`}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function SpendingBars({ spending }: { spending: ArchiveDetailResponse["spending"] }) {
  if (spending.length === 0) return <p className="text-sm text-muted-foreground">Not a coin was spent. A frugal act.</p>
  const total = spending.reduce((sum, s) => sum + s.total, 0)
  const max = Math.max(...spending.map((s) => s.total))
  return (
    <ul className="space-y-2.5">
      {spending.map((s) => {
        const Icon = REASON_GROUPS[s.group]?.icon
        return (
          <li key={s.group}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 text-[var(--color-gold-light)]/85">
                {Icon ? <Icon className="size-3.5 shrink-0 text-[var(--color-gold)]/70" aria-hidden /> : null}
                <span className="truncate">{s.label}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-[var(--color-gold-light)]/80">
                {formatNumber(s.total)} <span className="text-muted-foreground">· {Math.round((s.total / total) * 100)}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-gold-light)]/[0.06]" aria-hidden>
              <div className="h-full rounded-full bg-[var(--color-gold)]/70" style={{ width: `${Math.max(3, (s.total / max) * 100)}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
