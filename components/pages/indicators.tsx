"use client"

import { ArrowDownIcon, ArrowUpIcon, FlameIcon, SnowflakeIcon } from "lucide-react"
import { formatPercent, formatSigned } from "@/components/pages/format"
import { STREAK_MIN } from "@/lib/pages/constants"
import type { Outcome, Streak } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

export function toneOf(value: number): string {
  if (value > 0) return "text-emerald-300"
  if (value < 0) return "text-rose-300"
  return "text-muted-foreground"
}

export function rateTone(rate: number): string {
  if (rate >= 55) return "text-emerald-300"
  if (rate < 45) return "text-rose-300"
  return "text-[var(--color-gold-light)]"
}

export function FormDots({ form, className }: { form: Outcome[]; className?: string }) {
  if (form.length === 0) return <span className="text-xs text-muted-foreground">-</span>
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="sr-only">Last {form.length} games, newest first: {form.map((r) => (r === "W" ? "win" : "loss")).join(", ")}</span>
      {form.map((result, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "grid size-[18px] place-items-center rounded-[5px] text-[9px] leading-none font-bold",
            result === "W" ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30" : "bg-rose-400/12 text-rose-300 ring-1 ring-rose-400/25",
            i === 0 && "ring-2"
          )}
        >
          {result}
        </span>
      ))}
    </span>
  )
}

export function StreakChip({ streak, className }: { streak: Streak | null; className?: string }) {
  if (!streak || streak.count < STREAK_MIN) return null
  const hot = streak.outcome === "W"
  const Icon = hot ? FlameIcon : SnowflakeIcon
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold tabular-nums ring-1",
        hot ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25" : "bg-rose-400/10 text-rose-300 ring-rose-400/25",
        className
      )}
    >
      <Icon className="size-3" aria-hidden />
      {streak.count}
      {hot ? "W" : "L"}
      <span className="sr-only">{hot ? " win streak" : " loss streak"}</span>
    </span>
  )
}

export function WinRateMeter({ rate, games, className }: { rate: number; games?: number; className?: string }) {
  const width = Math.max(0, Math.min(100, rate))
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span className="relative h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--color-gold-light)]/10" aria-hidden>
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", rate >= 50 ? "bg-emerald-400/80" : "bg-rose-400/75")}
          style={{ width: `${width}%` }}
        />
        <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--color-navy)]" />
      </span>
      <span className={cn("text-sm font-semibold tabular-nums", rateTone(rate))}>{formatPercent(rate)}</span>
      {games !== undefined ? <span className="sr-only">over {games} games</span> : null}
    </span>
  )
}

export function RankShift({ rank, previous, className }: { rank: number; previous: number | null; className?: string }) {
  if (previous === null || previous === rank) return null
  const up = previous > rank
  const steps = Math.abs(previous - rank)
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums", up ? "text-emerald-300" : "text-rose-300", className)}
      title={`${up ? "Up" : "Down"} ${steps} since yesterday`}
    >
      {up ? <ArrowUpIcon className="size-3" aria-hidden /> : <ArrowDownIcon className="size-3" aria-hidden />}
      {steps}
      <span className="sr-only">{up ? " places up" : " places down"} in the last 24 hours</span>
    </span>
  )
}

export function Delta({ value, className, suffix }: { value: number; className?: string; suffix?: string }) {
  return (
    <span className={cn("tabular-nums", toneOf(value), className)}>
      {formatSigned(value)}
      {suffix}
    </span>
  )
}
