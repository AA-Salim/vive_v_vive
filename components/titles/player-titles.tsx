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
  // Every equipped title instead of the primary one and a count. On by default at size md (profiles).
  full?: boolean
  className?: string
}

// The loadout (primary title first) plus any active brands, ready to drop into a player card or a profile.
export function PlayerTitles({ playerId, userId, size = "sm", interactive = false, full, className }: PlayerTitlesProps) {
  const { entryFor } = useEquippedTitles()
  const entry = entryFor(playerId, userId)
  if (!entry) return null

  const showAll = full ?? size === "md"
  const burning = new Set((entry.curses ?? []).map((c) => c.title))
  const loadout = (
    entry.loadout ??
    (entry.kind !== "curse"
      ? [{ title: entry.title, category: entry.category, rarity: entry.rarity, tier: entry.tier, perk: entry.perk }]
      : [])
  ).filter((t) => !burning.has(t.title))
  const shown = showAll ? loadout : loadout.slice(0, 1)
  const hidden = loadout.length - shown.length

  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {shown.map((t) => (
        <TitleBadge
          key={t.title}
          name={t.title}
          category={t.category}
          rarity={t.rarity}
          tier={t.tier}
          perk={t.perk}
          price={t.title === entry.title ? entry.price : undefined}
          size={size}
          interactive={interactive}
        />
      ))}
      {hidden > 0 && (
        <span
          className="inline-flex h-5 items-center rounded-md border border-border px-1.5 text-[10px] font-semibold text-muted-foreground tabular-nums"
          aria-label={`${hidden} more title${hidden === 1 ? "" : "s"} equipped: ${loadout
            .slice(1)
            .map((t) => t.title)
            .join(", ")}`}
          title={loadout
            .slice(1)
            .map((t) => t.title)
            .join(", ")}
        >
          +{hidden}
        </span>
      )}
      {entry.curses?.map((curse) => (
        <TitleBadge
          key={curse.title}
          name={curse.title}
          category="mockery"
          rarity="cursed"
          tier={curse.tier}
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
