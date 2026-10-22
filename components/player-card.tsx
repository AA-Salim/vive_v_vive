"use client"

import Image from "next/image"
import { CrownIcon, LockIcon, LockOpenIcon, ShieldAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LaneIcon } from "@/components/lane-icon"
import { LoadoutChips } from "@/components/titles/loadout-chips"
import { PlayerName } from "@/components/titles/player-name"
import { FLAIR_EDGE } from "@/components/titles/title-visuals"
import { WantedBadge } from "@/components/bounties/wanted-badge"
import { ChampionAvatar } from "@/components/session/champion-avatar"
import { PlayerDetails } from "@/components/session/player-details"
import type { EquippedTitle } from "@/app/api/titles/equipped/route"
import { getChampionTileUrl, ROLE_LABELS, type Champion } from "@/lib/champions"
import { flairOf } from "@/lib/titles/flair"
import type { PlayerRevealState } from "@/lib/types"
import type { RoomAssignment } from "@/lib/session/types"
import { cn } from "@/lib/utils"

export interface PlayerCardProps {
  assignment: RoomAssignment
  state?: PlayerRevealState
  shuffleChampion?: Champion | null
  title?: EquippedTitle | null
  mirrored?: boolean
  outcome?: "won" | "lost" | null
  highlighted?: boolean
  isMe?: boolean
  showLockState?: boolean
  canLock?: boolean
  lockPending?: boolean
  onToggleLock?: () => void
}

export function YouChip() {
  return (
    <span className="shrink-0 rounded-sm bg-[var(--color-gold)] px-1 text-[9px] font-bold uppercase leading-4 tracking-wider text-[var(--color-navy)]">
      You
    </span>
  )
}

export function championLabel(assignment: RoomAssignment, state: PlayerRevealState, shuffleChampion?: Champion | null) {
  if (state === "revealed" || state === "locking") return assignment.champion
  if (state === "shuffling" && shuffleChampion) return shuffleChampion.name
  return "???"
}

export function PlayerCard({
  assignment,
  state = "revealed",
  shuffleChampion,
  title,
  mirrored = false,
  outcome = null,
  highlighted = false,
  isMe = false,
  showLockState = false,
  canLock = false,
  lockPending = false,
  onToggleLock,
}: PlayerCardProps) {
  const revealed = state === "revealed" || state === "locking"
  const accent = assignment.side === "blue" ? "bg-[var(--color-blue-team)]" : "bg-[var(--color-red-team)]"
  const flair = revealed ? flairOf(title) : null

  return (
    <div
      className={cn(
        "group/card relative isolate flex min-h-[84px] items-center overflow-hidden rounded-lg border border-border bg-card/90 transition-[border-color,opacity,filter,box-shadow] duration-300",
        mirrored && "flex-row-reverse",
        revealed && assignment.locked && showLockState && "border-[var(--color-gold)]/60",
        highlighted && "border-[var(--color-gold)]/70 shadow-[0_0_28px_-8px_var(--color-gold)]",
        outcome === "won" && "border-[var(--color-gold)]/50",
        outcome === "lost" && "opacity-70 grayscale-[35%]"
      )}
    >
      {revealed && (
        <Image
          src={getChampionTileUrl(assignment.champion_internal)}
          alt=""
          fill
          unoptimized
          sizes="320px"
          className={cn(
            "-z-10 object-cover object-[center_20%] opacity-30 transition-opacity duration-500",
            mirrored
              ? "[mask-image:linear-gradient(to_right,black,transparent_80%)]"
              : "[mask-image:linear-gradient(to_left,black,transparent_80%)]"
          )}
        />
      )}
      <span aria-hidden className={cn("absolute inset-y-0 w-1", mirrored ? "right-0" : "left-0", accent)} />
      {flair && (
        <span
          aria-hidden
          className={cn("pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent to-transparent", FLAIR_EDGE[flair.tone])}
        />
      )}

      <PlayerDetails
        assignment={assignment}
        title={title}
        disabled={!revealed}
        canLock={canLock}
        lockPending={lockPending}
        onToggleLock={onToggleLock}
        outcome={outcome}
        triggerClassName={cn(
          "flex flex-1 items-center gap-3 self-stretch py-2",
          mirrored ? "flex-row-reverse pr-4 pl-2 text-right" : "pl-4 pr-2"
        )}
      >
        <ChampionAvatar assignment={assignment} state={state} shuffleChampion={shuffleChampion} size={52} showLock={showLockState} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground",
              mirrored && "flex-row-reverse"
            )}
          >
            <LaneIcon lane={assignment.lane} size={12} title={null} />
            {ROLE_LABELS[assignment.lane]}
            {assignment.fearless_override && revealed && (
              <ShieldAlertIcon className="size-3 text-[var(--color-gold)]" aria-label="Fearless override" />
            )}
          </span>
          <span
            className={cn(
              "truncate font-display text-base leading-tight",
              revealed ? "text-foreground" : "text-muted-foreground",
              state === "shuffling" && "italic"
            )}
          >
            {championLabel(assignment, state, shuffleChampion)}
          </span>
          <span className={cn("flex min-w-0 items-center gap-1 text-xs", mirrored && "flex-row-reverse")}>
            {revealed ? (
              <>
                <PlayerName name={assignment.players.name} title={title ?? null} className="text-[var(--color-gold-light)]/80" />
                {isMe && <YouChip />}
                {outcome === "won" && <CrownIcon className="size-3.5 shrink-0 text-[var(--color-gold)]" aria-label="Winner" />}
                <WantedBadge playerId={assignment.player_id} />
              </>
            ) : (
              <span className="text-muted-foreground">{state === "shuffling" ? "Rolling..." : "Awaiting fate"}</span>
            )}
          </span>
          {revealed && title && <LoadoutChips title={title} mirrored={mirrored} className="mt-1" />}
        </span>
      </PlayerDetails>

      {canLock && onToggleLock && revealed && (
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-10 shrink-0", mirrored ? "ml-1" : "mr-1")}
          aria-pressed={assignment.locked}
          aria-label={assignment.locked ? `Unlock ${assignment.champion}` : `Lock ${assignment.champion} for re-rolls`}
          onClick={onToggleLock}
          disabled={lockPending}
        >
          {assignment.locked ? (
            <LockIcon className="text-[var(--color-gold)]" />
          ) : (
            <LockOpenIcon className="text-muted-foreground" />
          )}
        </Button>
      )}
    </div>
  )
}
