"use client"

import { CrownIcon } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import { LaneIcon } from "@/components/lane-icon"
import { TitleBadge } from "@/components/title-badge"
import { YouChip, championLabel } from "@/components/player-card"
import { ChampionAvatar } from "@/components/session/champion-avatar"
import { PlayerDetails } from "@/components/session/player-details"
import {
  LANE_ORDER,
  outcomeFor,
  slotShuffle,
  slotState,
  type BoardViewProps,
} from "@/components/session/board-types"
import { SIDE_NAME } from "@/components/session/copy"
import { LOCK_HELP } from "@/components/session/help"
import { ROLE_LABELS } from "@/lib/champions"
import type { RoomAssignment } from "@/lib/session/types"
import { cn } from "@/lib/utils"

function MatchupSide({
  assignment,
  mirrored,
  props,
}: {
  assignment: RoomAssignment | undefined
  mirrored?: boolean
  props: BoardViewProps
}) {
  if (!assignment) return <div />
  const state = slotState(props.frame, assignment.player_id)
  const shuffle = slotShuffle(props.frame, assignment.player_id)
  const revealed = state === "revealed" || state === "locking"
  const outcome = outcomeFor(props.winner, assignment.side)
  const title = props.titles.get(assignment.player_id)

  return (
    <PlayerDetails
      assignment={assignment}
      title={title}
      disabled={!revealed}
      canLock={props.canLock}
      lockPending={props.pendingLocks.has(assignment.id)}
      onToggleLock={props.onToggleLock ? () => props.onToggleLock?.(assignment.id) : undefined}
      outcome={outcome}
      triggerClassName={cn(
        "flex min-h-14 items-center gap-2 rounded-lg px-1.5 py-1.5 transition-opacity active:bg-muted/60",
        mirrored && "flex-row-reverse text-right",
        outcome === "lost" && "opacity-70"
      )}
    >
      <ChampionAvatar assignment={assignment} state={state} shuffleChampion={shuffle} size={44} showLock={props.draft} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate font-display text-sm leading-tight",
            revealed ? "text-foreground" : "text-muted-foreground",
            state === "shuffling" && "italic"
          )}
        >
          {championLabel(assignment, state, shuffle)}
        </span>
        <span className={cn("flex min-w-0 items-center gap-1 text-xs", mirrored && "flex-row-reverse")}>
          <span className={cn("truncate", revealed ? "text-[var(--color-gold-light)]/80" : "text-muted-foreground")}>
            {revealed ? assignment.players.name : "Rolling..."}
          </span>
          {revealed && props.meId === assignment.player_id && <YouChip />}
        </span>
        {revealed && title && (
          <span className={cn("mt-0.5 flex min-w-0", mirrored && "justify-end")}>
            <span className="inline-flex min-w-0 max-w-full [&>span]:truncate">
              <TitleBadge name={title.title} category={title.category} />
            </span>
          </span>
        )}
      </span>
    </PlayerDetails>
  )
}

export function LaneMatchups(props: BoardViewProps) {
  const { assignments, frame, winner, draft } = props
  const blue = new Map(assignments.filter((a) => a.side === "blue").map((a) => [a.lane, a]))
  const red = new Map(assignments.filter((a) => a.side === "red").map((a) => [a.lane, a]))

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em]">
        <span className="flex items-center gap-1 text-[var(--color-blue-team)]">
          {SIDE_NAME.blue}
          {winner === "blue" && <CrownIcon className="size-3 text-[var(--color-gold)]" aria-label="Winner" />}
          {draft && <InfoTip help={LOCK_HELP} align="start" className="-my-1" />}
        </span>
        <span className="text-muted-foreground">vs</span>
        <span className="flex items-center justify-end gap-1 text-[var(--color-red-team)]">
          {winner === "red" && <CrownIcon className="size-3 text-[var(--color-gold)]" aria-label="Winner" />}
          {SIDE_NAME.red}
        </span>
      </div>
      <ol className="divide-y divide-border">
        {LANE_ORDER.map((lane) => (
          <li
            key={lane}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_2.25rem_minmax(0,1fr)] items-center gap-1 px-1.5 transition-colors duration-300",
              frame?.activeLane === lane && "bg-[var(--color-gold)]/10"
            )}
          >
            <MatchupSide assignment={blue.get(lane)} props={props} />
            <span className="flex flex-col items-center gap-0.5 text-muted-foreground">
              <LaneIcon lane={lane} size={18} className={cn(frame?.activeLane === lane && "text-[var(--color-gold)]")} />
              <span className="text-[9px] font-semibold uppercase tracking-wider">{ROLE_LABELS[lane]}</span>
            </span>
            <MatchupSide assignment={red.get(lane)} mirrored props={props} />
          </li>
        ))}
      </ol>
    </div>
  )
}
