"use client"

import { Flame, Hourglass } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { HelpRows } from "@/components/ui/info-tip"
import { cn } from "@/lib/utils"
import { CATEGORY_META, RARITY_LABEL, isCurseCategory, perkInfo, rarityOf, tierOf } from "@/lib/titles/catalog"
import { titleEffects } from "@/lib/titles/effects"
import { titleHelp } from "@/lib/titles/help"
import { multiplierLabel, shopTier, tierPrice, type PriceTier } from "@/lib/titles/pricing"
import { dignityCost } from "@/lib/titles/rules"
import type { PerkInfo, TitleCategory, TitleRarity } from "@/lib/titles/types"
import { EffectLines } from "@/components/titles/effect-lines"
import { PerkLine } from "@/components/titles/perk-line"
import { TierChip } from "@/components/titles/tier-chip"
import { CATEGORY_ICON, RARITY_BADGE, RARITY_TEXT, iconKeyFor } from "@/components/titles/title-visuals"

interface TitleBadgeProps {
  name: string
  category?: string
  rarity?: TitleRarity
  // undefined: derive the perk from the title; null: cosmetic; string or PerkInfo: shown as given.
  perk?: string | PerkInfo | null
  description?: string | null
  curse?: { bestowedBy?: string | null; gamesLeft?: number; dignityCost?: number | null } | null
  // Shown in the popover. Derived for shop titles when omitted; honors are free.
  price?: number | null
  tier?: PriceTier
  size?: "sm" | "md" | "lg"
  // Opt-in popover with the effect and perk. Keep it off inside buttons and other popover triggers.
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

// Price when it is known: given, a seeded shop title, or a free honor. Unknown titles show the tier only.
function resolvePrice(name: string, category: string, price: number | null | undefined): number | null {
  if (price != null) return price
  const seeded = shopTier(name)
  if (seeded) return tierPrice(seeded)
  return category === "award" ? 0 : null
}

export function TitleBadge({
  name,
  category,
  rarity,
  perk,
  description,
  curse,
  price,
  tier,
  size = "sm",
  interactive = false,
  className,
}: TitleBadgeProps) {
  const cat = category ?? ""
  const look = rarity ?? rarityOf(name, cat, price ?? undefined)
  const Icon = CATEGORY_ICON[iconKeyFor(cat, look)]
  const classes = cn(
    "inline-flex max-w-full min-w-0 items-center rounded-md border font-semibold leading-none whitespace-nowrap",
    RARITY_BADGE[look],
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

  const cursed = isCurseCategory(cat) || look === "cursed"
  const info = resolvePerk(name, cat, perk, curse?.bestowedBy)
  const categoryLabel = CATEGORY_META[cat as TitleCategory]?.label
  const priceTier = tier ?? tierOf(name, cat, price ?? undefined)
  const shownPrice = resolvePrice(name, cat, price)
  const effects = titleEffects(name)

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        nativeButton={false}
        render={<span />}
        aria-label={`Title: ${name}${effects.length ? `. Effect: ${effects.map((e) => e.text).join(". ")}` : ""}${info ? `. ${info.kind === "curse" ? "Curse" : "Perk"}: ${info.summary}` : ""}`}
        className={cn(
          classes,
          "cursor-help outline-none transition-[filter] hover:brightness-125 focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60"
        )}
      >
        {content}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={6}
        className="max-h-[min(30rem,75dvh)] w-80 gap-2 overflow-y-auto border border-border bg-[var(--color-navy-light)] p-3"
      >
        <div className="flex items-start gap-2">
          <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", RARITY_TEXT[look])} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm leading-tight text-[var(--color-gold-light)]">{name}</p>
            <p className={cn("mt-0.5 text-[10px] font-semibold tracking-wider uppercase", RARITY_TEXT[look])}>
              {RARITY_LABEL[look]}
              {categoryLabel ? <span className="text-muted-foreground"> · {categoryLabel}</span> : null}
            </p>
          </div>
          <TierChip tier={priceTier} price={shownPrice} cursed={cursed} size="sm" />
        </div>
        {shownPrice != null && shownPrice > 0 && (
          <p className="text-[10px] text-muted-foreground">{multiplierLabel(priceTier)}</p>
        )}
        <div className="space-y-1">
          <p className={cn("text-[10px] font-bold tracking-wider uppercase", cursed ? "text-rose-300" : "text-amber-200/80")}>
            {cursed ? "While branded" : "While equipped"}
          </p>
          <EffectLines effects={effects} cursed={cursed} />
        </div>
        <div className="space-y-1">
          <p className={cn("text-[10px] font-bold tracking-wider uppercase", cursed ? "text-rose-300" : "text-[var(--color-gold)]/80")}>
            After each game
          </p>
          <PerkLine perk={info} />
        </div>
        {cursed && shownPrice != null && shownPrice > 0 ? (
          <p className="flex items-center gap-1.5 text-[11px] text-rose-200/80">
            <Flame aria-hidden className="size-3 shrink-0 text-rose-400" />
            Dignity buyback: {(curse?.dignityCost ?? dignityCost(shownPrice)).toLocaleString("en-US")} points
          </p>
        ) : null}
        {curse ? (
          <p className="flex items-center gap-1.5 text-[11px] text-rose-200/80">
            <Hourglass aria-hidden className="size-3 shrink-0" />
            {curse.bestowedBy ? `Branded by ${curse.bestowedBy}` : "Branded"}
            {typeof curse.gamesLeft === "number" ? ` · ${curse.gamesLeft} game${curse.gamesLeft === 1 ? "" : "s"} left` : ""}
          </p>
        ) : null}
        {description ? <p className="text-[11px] text-muted-foreground italic">&ldquo;{description}&rdquo;</p> : null}
        <div className="border-t border-border/60 pt-2">
          <HelpRows
            help={titleHelp({
              name,
              category: cat,
              perk: info,
              price: shownPrice,
              tier: priceTier,
              curse: curse ? { bestowedBy: curse.bestowedBy, gamesLeft: curse.gamesLeft, dignityCost: curse.dignityCost } : null,
            })}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
