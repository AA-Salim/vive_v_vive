"use client"

import { AnimatePresence, motion } from "motion/react"
import { GavelIcon, HourglassIcon, MapIcon } from "lucide-react"
import { SERPENTINE } from "@/lib/lobby/constants"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

const SIDE_NAME: Record<Side, string> = { blue: "Blue", red: "Red" }

interface TurnBannerProps {
  pickCount: number
  turnSide: Side | null
  isMyTurn: boolean
  coachName: (side: Side) => string
  lanesDone: Record<Side, number>
  mySide: Side | null
}

function upcoming(pickCount: number): string {
  const next = SERPENTINE.slice(pickCount + 1, pickCount + 3)
  if (next.length === 0) return "Last pick of the draft."
  if (next.length === 2 && next[0] === next[1]) return `Then ${SIDE_NAME[next[0]]} picks twice.`
  return `Then ${next.map((s) => SIDE_NAME[s]).join(", then ")}.`
}

export function TurnBanner({ pickCount, turnSide, isMyTurn, coachName, lanesDone, mySide }: TurnBannerProps) {
  const lanes = pickCount >= 10
  const key = lanes ? "lanes" : `${pickCount}:${isMyTurn}`
  const tone = lanes ? "gold" : turnSide

  let title: string
  let line: string
  if (lanes) {
    const ready = lanesDone.blue === 5 && lanesDone.red === 5
    title = ready ? "Both teams are set" : mySide && lanesDone[mySide] < 5 ? "Set your lanes" : "Coaches are setting lanes"
    line = ready
      ? "Lock the teams and fate deals the champions."
      : `Blue ${lanesDone.blue}/5 · Red ${lanesDone.red}/5. Tap a lane to assign it; tap a taken lane to swap.`
  } else if (isMyTurn && turnSide) {
    title = "Your pick"
    line = `Pick ${pickCount + 1} of 10 for ${SIDE_NAME[turnSide]}. ${upcoming(pickCount)}`
  } else if (turnSide) {
    title = `${coachName(turnSide)} is on the clock`
    line = `Pick ${pickCount + 1} of 10 for ${SIDE_NAME[turnSide]}. ${upcoming(pickCount)}`
  } else {
    title = "The draft"
    line = ""
  }

  const Icon = lanes ? MapIcon : isMyTurn ? GavelIcon : HourglassIcon

  return (
    <div aria-live="polite" className="relative">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className={cn(
            "relative flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3",
            tone === "blue" && "border-[var(--color-blue-team)]/45 bg-[var(--color-blue-team)]/10",
            tone === "red" && "border-[var(--color-red-team)]/45 bg-[var(--color-red-team)]/10",
            tone === "gold" && "border-[var(--color-gold)]/45 bg-[var(--color-gold)]/10",
            isMyTurn && "border-[var(--color-gold)] shadow-[0_0_32px_-8px_var(--color-gold)]"
          )}
        >
          {isMyTurn && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-to-r from-[var(--color-gold)]/0 via-[var(--color-gold)]/15 to-[var(--color-gold)]/0 motion-safe:animate-pulse"
            />
          )}
          <span
            className={cn(
              "relative flex size-10 shrink-0 items-center justify-center rounded-full",
              isMyTurn ? "bg-[var(--color-gold)] text-[var(--color-navy)]" : "bg-muted text-[var(--color-gold)]"
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="relative min-w-0">
            <span
              className={cn(
                "block font-display leading-tight font-semibold",
                isMyTurn ? "text-2xl text-[var(--color-gold)] sm:text-3xl" : "text-lg text-foreground sm:text-xl"
              )}
            >
              {title}
            </span>
            {line && <span className="block text-xs text-muted-foreground sm:text-sm">{line}</span>}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
