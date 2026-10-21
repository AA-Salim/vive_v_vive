"use client"

import { AnimatePresence, motion } from "motion/react"
import { LaneIcon } from "@/components/lane-icon"
import { WinRate } from "@/components/lobby/player-stats"
import { ROLE_LABELS } from "@/lib/champions"
import { LANES, SERPENTINE } from "@/lib/lobby/constants"
import type { CoachDraftPickView, RosterPlayer } from "@/lib/lobby/types"
import type { Role, Side } from "@/lib/types"
import { cn } from "@/lib/utils"

const SIDE_LABEL: Record<Side, string> = { blue: "Blue side", red: "Red side" }

const TONE: Record<Side, { header: string; title: string; card: string; empty: string }> = {
  blue: {
    header: "border-[var(--color-blue-team)]/45",
    title: "text-[var(--color-blue-team)]",
    card: "border-[var(--color-blue-team)]/40 bg-[var(--color-blue-team)]/12",
    empty: "border-[var(--color-blue-team)]/30",
  },
  red: {
    header: "border-[var(--color-red-team)]/45",
    title: "text-[var(--color-red-team)]",
    card: "border-[var(--color-red-team)]/40 bg-[var(--color-red-team)]/12",
    empty: "border-[var(--color-red-team)]/30",
  },
}

function LanePicker({ pick, team, disabled, onLane }: { pick: CoachDraftPickView; team: CoachDraftPickView[]; disabled: boolean; onLane: (lane: Role) => void }) {
  return (
    <div role="group" aria-label={`Lane for ${pick.players?.name ?? "player"}`} className="flex gap-1">
      {LANES.map((lane) => {
        const mine = pick.lane === lane
        const holder = team.find((p) => p.lane === lane && p.id !== pick.id)
        return (
          <button
            key={lane}
            type="button"
            disabled={disabled}
            aria-pressed={mine}
            onClick={() => onLane(lane)}
            title={holder ? `${ROLE_LABELS[lane]}: swap with ${holder.players?.name ?? "teammate"}` : ROLE_LABELS[lane]}
            className={cn(
              "relative flex size-10 items-center justify-center rounded-lg border outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 lg:size-9",
              mine
                ? "border-[var(--color-gold)] bg-[var(--color-gold)] text-[var(--color-navy)]"
                : holder
                  ? "border-border bg-transparent text-muted-foreground/60 hover:text-foreground"
                  : "border-[var(--color-gold)]/30 bg-transparent text-[var(--color-gold-light)] hover:border-[var(--color-gold)]/70"
            )}
          >
            <LaneIcon lane={lane} size={16} title={null} />
            <span className="sr-only">
              {ROLE_LABELS[lane]}
              {holder ? `, swap with ${holder.players?.name ?? "teammate"}` : ""}
            </span>
          </button>
        )
      })}
    </div>
  )
}

interface TeamColumnProps {
  side: Side
  coachName: string
  picks: CoachDraftPickView[]
  rosterById: Map<string, RosterPlayer>
  lanesPhase: boolean
  canEditLanes: boolean
  lanePending: boolean
  meId: string | null
  latestPickId: string | null
  onLane: (playerId: string, lane: Role) => void
}

export function TeamColumn({ side, coachName, picks, rosterById, lanesPhase, canEditLanes, lanePending, meId, latestPickId, onLane }: TeamColumnProps) {
  const slots = SERPENTINE.map((s, i) => ({ side: s, number: i + 1 })).filter((slot) => slot.side === side)
  const tone = TONE[side]

  return (
    <section aria-label={`${SIDE_LABEL[side]}, coached by ${coachName}`} className="flex min-w-0 flex-col gap-2">
      <header className={cn("flex items-baseline justify-between gap-2 border-b pb-1.5", tone.header)}>
        <span className={cn("font-display text-sm font-semibold uppercase tracking-[0.16em]", tone.title)}>
          {side === "blue" ? "Blue" : "Red"}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">Coach {coachName}</span>
      </header>
      <ol className="flex flex-col gap-1.5">
        {slots.map((slot, index) => {
          const pick = picks[index]
          const stats = pick ? rosterById.get(pick.player_id) : undefined
          return (
            <li key={slot.number} className="min-w-0">
              <AnimatePresence mode="popLayout" initial={false}>
                {pick ? (
                  <motion.div
                    key={pick.player_id}
                    layoutId={`coach-pick-${pick.player_id}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: pick.id.startsWith("pending-") ? 0.65 : 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-lg border px-2.5 py-2",
                      tone.card,
                      pick.id === latestPickId && "ring-1 ring-[var(--color-gold)]/60"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-4 shrink-0 text-[10px] tabular-nums text-muted-foreground">{slot.number}</span>
                      {pick.lane && !canEditLanes && <LaneIcon lane={pick.lane} size={14} className="shrink-0 text-[var(--color-gold-light)]" />}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {pick.players?.name ?? stats?.name ?? "Unknown"}
                        {pick.player_id === meId && <span className="ml-1 text-[10px] font-semibold uppercase text-[var(--color-gold)]">You</span>}
                      </span>
                      {stats && <WinRate player={stats} className="shrink-0" />}
                    </div>
                    {lanesPhase && canEditLanes && (
                      <LanePicker pick={pick} team={picks} disabled={lanePending} onLane={(lane) => onLane(pick.player_id, lane)} />
                    )}
                    {lanesPhase && !canEditLanes && !pick.lane && <span className="text-[11px] text-muted-foreground">Lane pending</span>}
                  </motion.div>
                ) : (
                  <motion.div
                    key={`empty-${slot.number}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn("flex h-10 items-center gap-2 rounded-lg border border-dashed px-2.5 text-xs text-muted-foreground", tone.empty)}
                  >
                    <span className="w-4 tabular-nums">{slot.number}</span>
                    <span>Open</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
