"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { InfoTip } from "@/components/ui/info-tip"
import { ChampionArt } from "@/components/lobby/champion-pick/champion-art"
import { CHAMPION_HELP } from "@/components/lobby/champion-pick/help"
import { CHAMPION_PICK_ORDER, type ChampionPickView } from "@/lib/lobby/champion-pick"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

const SIDE_NAME: Record<Side, string> = { blue: "Blue", red: "Red" }

export function PickOrder({ picks, current, nameOf }: { picks: ChampionPickView[]; current: number | null; nameOf: (playerId: string) => string }) {
  const reduced = useReducedMotion()
  return (
    <div className="flex items-center gap-2">
      <ol className="flex min-w-0 flex-1 items-center gap-1" aria-label={current ? `Champion pick ${current} of 10` : "Champion picks"}>
        {CHAMPION_PICK_ORDER.map((side, i) => {
          const pick = picks[i]
          const isCurrent = current === i + 1
          return (
            <li
              key={i}
              title={pick ? `${i + 1}. ${pick.champion} for ${nameOf(pick.player_id)}` : `Pick ${i + 1}: ${SIDE_NAME[side]}`}
              className={cn(
                "relative flex aspect-square min-w-0 flex-1 items-center justify-center overflow-hidden rounded-md border text-[10px] font-semibold tabular-nums sm:max-w-11",
                side === "blue" ? "border-[var(--color-blue-team)]/45" : "border-[var(--color-red-team)]/45",
                !pick && (side === "blue" ? "bg-[var(--color-blue-team)]/[0.07]" : "bg-[var(--color-red-team)]/[0.07]"),
                !pick && "text-muted-foreground",
                isCurrent && "ring-2 ring-[var(--color-gold)] ring-offset-1 ring-offset-card motion-safe:animate-pulse"
              )}
            >
              <AnimatePresence initial={false}>
                {pick ? (
                  <motion.span
                    key={pick.champion}
                    className="absolute inset-0"
                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.6 }}
                    animate={{ opacity: pick.id.startsWith("pending-") ? 0.6 : 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                  >
                    <ChampionArt internal={pick.champion_internal} name={pick.champion} decorative />
                  </motion.span>
                ) : (
                  <span key="number" aria-hidden>
                    {i + 1}
                  </span>
                )}
              </AnimatePresence>
              <span className="sr-only">
                {pick
                  ? `Pick ${i + 1}, ${SIDE_NAME[side]}: ${pick.champion} for ${nameOf(pick.player_id)}${pick.auto ? ", picked by the clock" : ""}`
                  : `Pick ${i + 1}, ${SIDE_NAME[side]}${isCurrent ? ", on the clock" : ""}`}
              </span>
            </li>
          )
        })}
      </ol>
      <InfoTip help={CHAMPION_HELP.order} align="end" />
    </div>
  )
}
