"use client"

import { CrosshairIcon } from "lucide-react"
import { useWanted } from "@/components/bounties/use-wanted"
import { cn } from "@/lib/utils"

// Drop-in chip for player cards: shows the price on a player's head, nothing when there is none.
export function WantedBadge({ playerId, className }: { playerId: string; className?: string }) {
  const warrant = useWanted().get(playerId)
  if (!warrant) return null
  const label = `Wanted: ${warrant.price} points on ${warrant.target.name}. Beat them to collect.`
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-[var(--color-red-team)]/15 px-1.5 text-[10px] font-bold tabular-nums text-[var(--color-red-team)] ring-1 ring-[var(--color-red-team)]/40",
        className
      )}
    >
      <CrosshairIcon className="size-3" aria-hidden />
      {warrant.price}
    </span>
  )
}
