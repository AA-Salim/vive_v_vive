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
  const { entryFor } = useEquippedTitles()
  const entry = entryFor(playerId, userId)
  if (!entry) return null

  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {entry.kind !== "curse" && (
        <TitleBadge
          name={entry.title}
          category={entry.category}
          rarity={entry.rarity}
          perk={entry.perk}
          price={entry.price}
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
          price={curse.price}
          curse={{ bestowedBy: curse.bestowedBy, gamesLeft: curse.gamesLeft, dignityCost: curse.dignityCost }}
          size={size}
          interactive={interactive}
        />
      ))}
    </span>
  )
}
