"use client"

import { motion } from "motion/react"
import { CrownIcon } from "lucide-react"
import { PlayerCard } from "@/components/player-card"
import { byLane, outcomeFor, slotShuffle, slotState, type BoardViewProps } from "@/components/session/board-types"
import { SIDE_NAME } from "@/components/session/copy"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

interface TeamListProps extends BoardViewProps {
  side: Side
  mirrored?: boolean
}

export function TeamList({
  side,
  mirrored = false,
  assignments,
  frame,
  titles,
  winner,
  draft,
  canLock,
  pendingLocks,
  onToggleLock,
  animateLayout,
  meId,
}: TeamListProps) {
  const team = assignments.filter((a) => a.side === side).sort(byLane)
  const outcome = outcomeFor(winner, side)
  const color = side === "blue" ? "text-[var(--color-blue-team)]" : "text-[var(--color-red-team)]"

  return (
    <section aria-label={SIDE_NAME[side]} className="flex min-w-0 flex-col gap-2">
      <header className={cn("flex items-center gap-2 px-1", mirrored && "flex-row-reverse")}>
        <h2 className={cn("font-display text-sm font-semibold uppercase tracking-[0.22em]", color)}>{SIDE_NAME[side]}</h2>
        {outcome === "won" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-gold)]">
            <CrownIcon className="size-3" aria-hidden /> Victory
          </span>
        )}
        {outcome === "lost" && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Defeat</span>
        )}
        <span aria-hidden className={cn("h-px flex-1", side === "blue" ? "bg-[var(--color-blue-team)]/30" : "bg-[var(--color-red-team)]/30")} />
      </header>
      <ol className="flex flex-col gap-2">
        {team.map((a) => (
          <motion.li
            key={a.player_id}
            layout={animateLayout}
            layoutId={animateLayout ? `slot-${a.player_id}` : undefined}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <PlayerCard
              assignment={a}
              state={slotState(frame, a.player_id)}
              shuffleChampion={slotShuffle(frame, a.player_id)}
              title={titles.get(a.player_id) ?? null}
              mirrored={mirrored}
              outcome={outcome}
              highlighted={!!frame && frame.activeLane === a.lane}
              isMe={!!meId && a.player_id === meId}
              showLockState={draft}
              canLock={canLock}
              lockPending={pendingLocks.has(a.id)}
              onToggleLock={onToggleLock ? () => onToggleLock(a.id) : undefined}
            />
          </motion.li>
        ))}
      </ol>
    </section>
  )
}
