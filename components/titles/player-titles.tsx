"use client"

import { TitleBadge } from "@/components/title-badge"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import { cn } from "@/lib/utils"

interface PlayerTitlesProps {
  playerId?: string | null
  userId?: string | null
  size?: "sm" | "md"
  // Perk popovers on tap or hover. Leave off when rendered inside a button or another popover trigger.
  interactive?: boolean
  className?: string
}

// The equipped title (with its perk) plus any active brands, ready to drop into a player card.
export function PlayerTitles({ playerId, userId, size = "sm", interactive = false, className }: PlayerTitlesProps) {
  const { byPlayerId, byUserId } = useEquippedTitles()
  const entry = (playerId ? byPlayerId.get(playerId) : undefined) ?? (userId ? byUserId.get(userId) : undefined)
  if (!entry) return null

  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {entry.kind !== "curse" && (
        <TitleBadge
          name={entry.title}
          category={entry.category}
          rarity={entry.rarity}
          perk={entry.perk}
          size={size}
          interactive={interactive}
        />
      )}
      {entry.curses?.map((curse) => (
        <TitleBadge
          key={curse.title}
          name={curse.title}
          category="mockery"
          rarity="cursed"
          perk={curse.perk}
          curse={{ bestowedBy: curse.bestowedBy, gamesLeft: curse.gamesLeft }}
          size={size}
          interactive={interactive}
        />
      ))}
    </span>
  )
}
