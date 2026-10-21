"use client"

import { Hourglass } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { CATEGORY_META, RARITY_LABEL, isCurseCategory, perkInfo, rarityOf } from "@/lib/titles/catalog"
import type { PerkInfo, TitleCategory, TitleRarity } from "@/lib/titles/types"
import { PerkLine } from "@/components/titles/perk-line"
import { CATEGORY_ICON, RARITY_BADGE, RARITY_TEXT, iconKeyFor } from "@/components/titles/title-visuals"

interface TitleBadgeProps {
  name: string
  category?: string
  rarity?: TitleRarity
  // undefined: derive the perk from the title; null: cosmetic; string or PerkInfo: shown as given.
  perk?: string | PerkInfo | null
  description?: string | null
  curse?: { bestowedBy?: string | null; gamesLeft?: number } | null
  size?: "sm" | "md" | "lg"
  interactive?: boolean
  className?: string
}

const SIZES = {
  sm: "h-5 gap-1 px-1.5 text-[10px] [&_svg]:size-3",
  md: "h-6 gap-1.5 px-2 text-xs [&_svg]:size-3.5",
  lg: "h-8 gap-2 px-3 text-sm [&_svg]:size-4",
}

function resolvePerk(name: string, category: string, perk: TitleBadgeProps["perk"], bestowedBy?: string | null): PerkInfo | null {
  if (perk === null) return null
  const derived = perkInfo(name, category, bestowedBy ?? "the brander")
  if (perk === undefined) return derived
  if (typeof perk === "string") {
    return {
      kind: isCurseCategory(category) ? "curse" : "perk",
      trigger: derived?.trigger ?? "play",
      summary: perk,
      cap: derived?.cap ?? 0,
    }
  }
  return perk
}

export function TitleBadge({
  name,
  category,
  rarity,
  perk,
  description,
  curse,
  size = "sm",
  interactive = true,
  className,
}: TitleBadgeProps) {
  const cat = category ?? ""
  const tier = rarity ?? rarityOf(name, cat)
  const Icon = CATEGORY_ICON[iconKeyFor(cat, tier)]
  const classes = cn(
    "inline-flex max-w-full min-w-0 items-center rounded-md border font-semibold leading-none whitespace-nowrap",
    RARITY_BADGE[tier],
    SIZES[size],
    className
  )
  const content = (
    <>
      <Icon aria-hidden className="shrink-0" />
      <span className="truncate">{name}</span>
    </>
  )

  if (!interactive) {
    return <span className={classes}>{content}</span>
  }

  const info = resolvePerk(name, cat, perk, curse?.bestowedBy)
  const categoryLabel = CATEGORY_META[cat as TitleCategory]?.label

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        nativeButton={false}
        render={<span />}
        aria-label={`Title: ${name}${info ? `. ${info.kind === "curse" ? "Curse" : "Perk"}: ${info.summary}` : ""}`}
        className={cn(
          classes,
          "cursor-help outline-none transition-[filter] hover:brightness-125 focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60"
        )}
      >
        {content}
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={6} className="w-64 gap-2 border border-border bg-[var(--color-navy-light)] p-3">
        <div className="flex items-start gap-2">
          <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", RARITY_TEXT[tier])} />
          <div className="min-w-0">
            <p className="font-display text-sm leading-tight text-[var(--color-gold-light)]">{name}</p>
            <p className={cn("mt-0.5 text-[10px] font-semibold tracking-wider uppercase", RARITY_TEXT[tier])}>
              {RARITY_LABEL[tier]}
              {categoryLabel ? <span className="text-muted-foreground"> · {categoryLabel}</span> : null}
            </p>
          </div>
        </div>
        <PerkLine perk={info} />
        {curse ? (
          <p className="flex items-center gap-1.5 text-[11px] text-rose-200/80">
            <Hourglass aria-hidden className="size-3 shrink-0" />
            {curse.bestowedBy ? `Branded by ${curse.bestowedBy}` : "Branded"}
            {typeof curse.gamesLeft === "number" ? ` · ${curse.gamesLeft} game${curse.gamesLeft === 1 ? "" : "s"} left` : ""}
          </p>
        ) : null}
        {description ? <p className="text-[11px] text-muted-foreground italic">&ldquo;{description}&rdquo;</p> : null}
      </PopoverContent>
    </Popover>
  )
}
