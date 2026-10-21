"use client"

import { SERPENTINE } from "@/lib/lobby/constants"
import type { CoachDraftPickView } from "@/lib/lobby/types"
import { cn } from "@/lib/utils"

export function PickTrack({ picks }: { picks: CoachDraftPickView[] }) {
  const current = picks.length
  return (
    <ol className="flex items-center gap-1" aria-label={`Pick ${Math.min(current + 1, 10)} of 10`}>
      {SERPENTINE.map((side, i) => {
        const pick = picks[i]
        const isCurrent = i === current
        return (
          <li
            key={i}
            title={pick?.players?.name ? `${i + 1}. ${pick.players.name}` : `Pick ${i + 1}: ${side}`}
            className={cn(
              "relative flex h-6 min-w-0 flex-1 items-center justify-center rounded-md border text-[10px] font-semibold tabular-nums transition-colors sm:h-7",
              side === "blue" ? "border-[var(--color-blue-team)]/35" : "border-[var(--color-red-team)]/35",
              pick
                ? side === "blue"
                  ? "bg-[var(--color-blue-team)]/30 text-foreground"
                  : "bg-[var(--color-red-team)]/30 text-foreground"
                : "bg-transparent text-muted-foreground",
              isCurrent && "ring-2 ring-[var(--color-gold)] ring-offset-1 ring-offset-card motion-safe:animate-pulse"
            )}
          >
            <span aria-hidden>{i + 1}</span>
            <span className="sr-only">
              {pick?.players?.name ? `Pick ${i + 1}, ${side}: ${pick.players.name}` : `Pick ${i + 1}, ${side}${isCurrent ? ", on the clock" : ""}`}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
