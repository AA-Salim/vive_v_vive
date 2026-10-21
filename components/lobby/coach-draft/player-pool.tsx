"use client"

import { AnimatePresence, motion } from "motion/react"
import { CheckIcon } from "lucide-react"
import { FormDots, WinRate, winRateOf } from "@/components/lobby/player-stats"
import type { RosterPlayer } from "@/lib/lobby/types"
import { cn } from "@/lib/utils"

export type PoolSort = "rate" | "name"

export function sortPool(players: RosterPlayer[], sort: PoolSort): RosterPlayer[] {
  return [...players].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name)
    const rate = (p: RosterPlayer) => (p.wins + p.losses >= 5 ? (winRateOf(p) ?? 0) : -1)
    return rate(b) - rate(a) || b.games_played - a.games_played || a.name.localeCompare(b.name)
  })
}

interface PlayerPoolProps {
  players: RosterPlayer[]
  selectable: boolean
  chosenId: string | null
  meId: string | null
  onChoose: (player: RosterPlayer) => void
}

export function PlayerPool({ players, selectable, chosenId, meId, onChoose }: PlayerPoolProps) {
  if (players.length === 0) {
    return <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Everyone has been drafted.</p>
  }
  return (
    <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" aria-label="Players still available">
      <AnimatePresence initial={false} mode="popLayout">
        {players.map((player) => {
          const chosen = chosenId === player.id
          return (
            <motion.li
              key={player.id}
              layoutId={`coach-pick-${player.id}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <button
                type="button"
                disabled={!selectable}
                aria-pressed={selectable ? chosen : undefined}
                onClick={() => onChoose(player)}
                className={cn(
                  "flex min-h-14 w-full flex-col justify-center gap-1 rounded-lg border px-2.5 py-2 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  chosen
                    ? "border-[var(--color-gold)] bg-[var(--color-gold)]/15 shadow-[0_0_18px_-6px_var(--color-gold)]"
                    : selectable
                      ? "border-[var(--color-gold)]/25 bg-muted/30 hover:border-[var(--color-gold)]/60 hover:bg-muted/60"
                      : "cursor-default border-border bg-muted/20"
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {chosen && <CheckIcon className="size-3.5 shrink-0 text-[var(--color-gold)]" strokeWidth={3} aria-hidden />}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-gold-light)]">{player.name}</span>
                  {player.id === meId && <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--color-gold)]">You</span>}
                </span>
                <span className="flex items-center gap-2">
                  <WinRate player={player} />
                  <span className="text-[11px] tabular-nums text-muted-foreground">{player.games_played} g</span>
                  <FormDots form={player.form} className="ml-auto" />
                </span>
              </button>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}
