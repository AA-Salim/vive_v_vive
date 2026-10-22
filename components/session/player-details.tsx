"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import { CrownIcon, LockIcon, LockOpenIcon, ShieldAlertIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { LaneIcon } from "@/components/lane-icon"
import { LoadoutDetails } from "@/components/titles/loadout-chips"
import { LoadoutSummaryBar } from "@/components/titles/loadout-summary"
import { PlayerName } from "@/components/titles/player-name"
import type { EquippedTitle } from "@/app/api/titles/equipped/route"
import { getChampionSplashUrl, ROLE_LABELS } from "@/lib/champions"
import type { RoomAssignment } from "@/lib/session/types"
import { cn } from "@/lib/utils"
import { SIDE_NAME } from "@/components/session/copy"
import { LOCK_HELP } from "@/components/session/help"
import { useMediaQuery } from "@/components/session/use-browser-state"
import { ProfileTrigger } from "@/components/profile/profile-provider"

export interface PlayerDetailsProps {
  assignment: RoomAssignment
  title?: EquippedTitle | null
  disabled?: boolean
  canLock?: boolean
  lockPending?: boolean
  onToggleLock?: () => void
  outcome?: "won" | "lost" | null
  triggerClassName?: string
  children: ReactNode
}

export function PlayerDetails({
  assignment,
  title,
  disabled,
  canLock,
  lockPending,
  onToggleLock,
  outcome,
  triggerClassName,
  children,
}: PlayerDetailsProps) {
  const sideColor = assignment.side === "blue" ? "text-[var(--color-blue-team)]" : "text-[var(--color-red-team)]"
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)")

  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        openOnHover={finePointer}
        delay={450}
        closeDelay={120}
        aria-label={disabled ? undefined : `${assignment.players.name} on ${assignment.champion}, ${ROLE_LABELS[assignment.lane]}. Show details`}
        className={cn(
          "min-w-0 cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
          triggerClassName
        )}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 gap-0 overflow-hidden p-0" side="bottom" align="center">
        <div className="relative h-28 overflow-hidden">
          <Image
            src={getChampionSplashUrl(assignment.champion_internal)}
            alt=""
            fill
            unoptimized
            sizes="288px"
            className="object-cover object-[center_25%]"
          />
          <div className="absolute inset-0 bg-linear-to-t from-popover via-popover/40 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3">
            <p className={cn("flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]", sideColor)}>
              <LaneIcon lane={assignment.lane} size={14} title={null} />
              {ROLE_LABELS[assignment.lane]} · {SIDE_NAME[assignment.side]}
            </p>
            <p className="font-display text-xl leading-tight text-foreground">{assignment.champion}</p>
          </div>
        </div>
        <div className="space-y-3 p-3">
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <span className="shrink-0">Played by</span>
            <PlayerName name={assignment.players.name} title={title ?? null} epithet className="font-semibold text-foreground" />
            {outcome === "won" && <CrownIcon className="size-4 shrink-0 text-[var(--color-gold)]" aria-label="Winner" />}
          </p>
          <ProfileTrigger
            playerId={assignment.player_id}
            name={assignment.players.name}
            className="text-xs font-semibold text-[var(--color-gold-light)] underline-offset-4 hover:underline"
          >
            Open {assignment.players.name}&apos;s court file
          </ProfileTrigger>
          {title ? (
            <>
              <LoadoutDetails title={title} className="max-h-72 overflow-y-auto overscroll-contain" />
              <LoadoutSummaryBar userId={title.userId} name={assignment.players.name} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No title equipped. A blank page in the royal notebook.</p>
          )}
          {assignment.fearless_override && (
            <p className="flex gap-1.5 text-xs leading-relaxed text-[var(--color-gold-light)]/80">
              <ShieldAlertIcon className="mt-0.5 size-3.5 shrink-0 text-[var(--color-gold)]" aria-hidden />
              Every {ROLE_LABELS[assignment.lane]} pick was already burned by fearless today, so the rule bent for this one.
            </p>
          )}
          {canLock && onToggleLock && (
            <div className="flex items-center gap-2">
              <Button
                variant={assignment.locked ? "secondary" : "outline"}
                className="h-10 flex-1"
                onClick={onToggleLock}
                disabled={lockPending}
                aria-pressed={assignment.locked}
              >
                {assignment.locked ? <LockOpenIcon aria-hidden /> : <LockIcon aria-hidden />}
                {assignment.locked ? "Unlock for re-rolls" : "Lock this champion"}
              </Button>
              <InfoTip help={LOCK_HELP} side="top" align="end" />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
