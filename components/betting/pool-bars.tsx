"use client"

import { memo } from "react"
import { motion, useReducedMotion } from "motion/react"
import { TrophyIcon } from "lucide-react"
import { AnimatedNumber } from "@/components/betting/animated-number"
import { InfoTip } from "@/components/ui/info-tip"
import { oddsHelp } from "@/lib/betting/help"
import { cn } from "@/lib/utils"
import type { Side } from "@/lib/types"

interface PoolBarsProps {
  blue: number
  red: number
  blueMultiplier: number | null
  redMultiplier: number | null
  blueCount: number
  redCount: number
  winner?: Side | null
  mySide?: Side | null
}

const SIDE_STYLE = {
  blue: { label: "Blue", text: "text-[var(--color-blue-team)]", bar: "bg-[var(--color-blue-team)]" },
  red: { label: "Red", text: "text-[var(--color-red-team)]", bar: "bg-[var(--color-red-team)]" },
} as const

function SideStat({
  side,
  amount,
  mult,
  count,
  winner,
  mine,
}: {
  side: Side
  amount: number
  mult: number | null
  count: number
  winner: Side | null
  mine: boolean
}) {
  const style = SIDE_STYLE[side]
  const lost = winner != null && winner !== side
  return (
    <div className={cn("min-w-0 transition-opacity", side === "red" && "text-right", lost && "opacity-45")}>
      <div className={cn("flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]", style.text, side === "red" && "justify-end")}>
        {winner === side && <TrophyIcon className="size-3.5" aria-hidden />}
        {style.label}
        {mine && (
          <span className="rounded-sm bg-[var(--color-gold)]/15 px-1 py-px text-[9px] tracking-wider text-[var(--color-gold)]">You</span>
        )}
      </div>
      <div className={cn("font-display text-2xl font-semibold tabular-nums leading-tight sm:text-3xl", style.text)}>
        {mult == null ? (
          <span aria-label="no odds yet">x--</span>
        ) : (
          <AnimatedNumber value={mult} decimals={2} format={(v) => `x${v.toFixed(2)}`} />
        )}
      </div>
      <div className="text-xs tabular-nums text-muted-foreground">
        <AnimatedNumber value={amount} /> pts · {count} {count === 1 ? "bettor" : "bettors"}
      </div>
    </div>
  )
}

export const PoolBars = memo(function PoolBars({
  blue,
  red,
  blueMultiplier,
  redMultiplier,
  blueCount,
  redCount,
  winner = null,
  mySide = null,
}: PoolBarsProps) {
  const reduced = useReducedMotion()
  const total = blue + red
  const bluePct = total > 0 ? (blue / total) * 100 : 50
  const transition = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 120, damping: 20 }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <SideStat side="blue" amount={blue} mult={blueMultiplier} count={blueCount} winner={winner} mine={mySide === "blue"} />
        <div className="pb-0.5 text-center">
          <div className="flex items-center justify-center gap-0.5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Pool
            <InfoTip help={oddsHelp({ blue, red, blueMultiplier, redMultiplier })} className="-my-1" />
          </div>
          <AnimatedNumber value={total} className="font-display text-xl font-semibold tabular-nums text-[var(--color-gold)] sm:text-2xl" />
        </div>
        <SideStat side="red" amount={red} mult={redMultiplier} count={redCount} winner={winner} mine={mySide === "red"} />
      </div>

      <div
        role="img"
        aria-label={
          total > 0
            ? `Blue holds ${Math.round(bluePct)} percent of the pool, Red ${100 - Math.round(bluePct)} percent`
            : "No bets in the pool yet"
        }
        className="relative flex h-2.5 overflow-hidden rounded-full bg-[var(--color-navy)] ring-1 ring-[var(--color-gold)]/20"
      >
        <motion.div
          className={cn("h-full", SIDE_STYLE.blue.bar, total === 0 && "opacity-25")}
          initial={false}
          animate={{ width: `${bluePct}%` }}
          transition={transition}
        />
        <div className={cn("h-full flex-1", SIDE_STYLE.red.bar, total === 0 && "opacity-25")} />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-[var(--color-gold-light)]/40" aria-hidden />
      </div>
    </div>
  )
})
