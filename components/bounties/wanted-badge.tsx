"use client"

import { CrosshairIcon } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import { useBountyBoard } from "@/components/bounties/use-bounties"
import { useWanted } from "@/components/bounties/use-wanted"
import { useAuthUser } from "@/hooks/use-auth"
import { warrantHelp } from "@/lib/bounties/help"
import { cn } from "@/lib/utils"

// Drop-in chip for player cards: shows the price on a player's head, nothing when there is none. Tap or hover
// it for the terms of the warrant.
export function WantedBadge({ playerId, className }: { playerId: string; className?: string }) {
  const { user } = useAuthUser()
  const viewerPlayerId = useBountyBoard(user?.id ?? null).data?.viewer.playerId ?? null
  const warrant = useWanted().get(playerId)
  if (!warrant) return null
  return (
    <InfoTip
      help={warrantHelp(warrant, viewerPlayerId === playerId)}
      className={cn(
        "size-auto min-h-5 gap-1 rounded-full bg-[var(--color-red-team)]/15 px-1.5 text-[10px] font-bold tabular-nums text-[var(--color-red-team)] ring-1 ring-[var(--color-red-team)]/40 hover:text-[var(--color-red-team)] data-[popup-open]:text-[var(--color-red-team)] data-[popup-open]:ring-[var(--color-red-team)]/80",
        className
      )}
    >
      <CrosshairIcon className="size-3" aria-hidden />
      {warrant.price}
    </InfoTip>
  )
}
