"use client"

import { Hourglass, Skull, Sparkles, Zap } from "lucide-react"
import { TitleBadge } from "@/components/title-badge"
import { CATEGORY_ICON, RARITY_BADGE, iconKeyFor } from "@/components/titles/title-visuals"
import { InfoTip } from "@/components/ui/info-tip"
import type { HelpEntry } from "@/lib/help"
import { isCurseCategory, perkInfo, rarityOf, tierOf } from "@/lib/titles/catalog"
import { titleEffects } from "@/lib/titles/effects"
import { titleHelp } from "@/lib/titles/help"
import { slotOf } from "@/lib/titles/loadout"
import { shopPrice } from "@/lib/titles/pricing"
import { dignityCost } from "@/lib/titles/rules"
import type { CurseBadge, EquippedTitle, LoadoutEntry } from "@/lib/titles/types"
import { cn } from "@/lib/utils"

// Loadouts in the match room: chips on a player card (inside its details button, so never interactive) and the
// per-title bubbles in the details popover.

// Before loadouts the equipped-titles API only described the primary title.
export function loadoutOf(title: EquippedTitle): LoadoutEntry[] {
  if (title.loadout) return title.loadout
  if (title.kind === "curse" && isCurseCategory(title.category)) return []
  const tier = title.tier ?? tierOf(title.title, title.category)
  return [
    {
      title: title.title,
      category: title.category,
      rarity: title.rarity ?? rarityOf(title.title, title.category),
      tier,
      slot: slotOf(tier),
      effect: title.effect ?? null,
      perk: title.perk,
      primary: true,
    },
  ]
}

export function loadoutHelp(entry: LoadoutEntry): HelpEntry {
  const forSelf = !isCurseCategory(entry.category)
  const price = entry.category === "award" ? 0 : shopPrice(entry.title, 0)
  return titleHelp({
    name: entry.title,
    category: entry.category,
    tier: entry.tier,
    price,
    for_self: forSelf,
    perk: forSelf ? perkInfo(entry.title, entry.category) : null,
    effects: forSelf ? titleEffects(entry.title) : [],
    dignity_cost: forSelf ? null : dignityCost(price),
  })
}

export function curseHelp(curse: CurseBadge): HelpEntry {
  const price = shopPrice(curse.title, 0)
  const help = titleHelp({
    name: curse.title,
    category: "mockery",
    tier: curse.tier ?? tierOf(curse.title, "mockery", price),
    price,
    for_self: false,
    perk: perkInfo(curse.title, "mockery", curse.bestowedBy ?? "whoever branded them"),
    dignity_cost: dignityCost(price),
  })
  const clock = `${curse.gamesLeft} game${curse.gamesLeft === 1 ? "" : "s"} left`
  return { ...help, title: `${curse.title} (curse)`, limits: `${curse.bestowedBy ? `Branded by ${curse.bestowedBy}, ` : ""}${clock}. ${help.limits ?? ""}` }
}

function MiniChip({ name, category, rarity }: Pick<LoadoutEntry, "category" | "rarity"> & { name: string }) {
  const Icon = CATEGORY_ICON[iconKeyFor(category, rarity)]
  return (
    <span
      className={cn(
        "inline-flex h-4 max-w-[7.5rem] min-w-0 items-center gap-0.5 rounded border px-1 text-[9px] leading-none font-semibold",
        RARITY_BADGE[rarity]
      )}
    >
      <Icon aria-hidden className="size-2.5 shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  )
}

const MAX_EXTRA = 2

interface LoadoutChipsProps {
  title: EquippedTitle
  mirrored?: boolean
  className?: string
}

// The primary title, then small chips for the rest of the loadout and every burning curse.
export function LoadoutChips({ title, mirrored = false, className }: LoadoutChipsProps) {
  const loadout = loadoutOf(title)
  const [primary, ...others] = loadout
  const curses = title.curses ?? []
  const extra = others.slice(0, MAX_EXTRA)
  const hidden = others.length - extra.length
  if (!primary && curses.length === 0) return null

  const label = [
    ...loadout.map((t) => t.title),
    ...curses.map((c) => `${c.title} (curse)`),
  ].join(", ")

  return (
    <span
      aria-label={`Titles: ${label}`}
      className={cn("flex min-w-0 flex-wrap items-center gap-1", mirrored && "flex-row-reverse", className)}
    >
      {primary && (
        <span className="inline-flex min-w-0 max-w-full [&>span]:truncate">
          <TitleBadge name={primary.title} category={primary.category} rarity={primary.rarity} />
        </span>
      )}
      {extra.map((t) => (
        <MiniChip key={t.title} name={t.title} category={t.category} rarity={t.rarity} />
      ))}
      {hidden > 0 && <span className="text-[9px] font-semibold text-muted-foreground">+{hidden}</span>}
      {curses.map((c) => (
        <span
          key={c.title}
          className="inline-flex h-4 max-w-[7.5rem] min-w-0 items-center gap-0.5 rounded border border-dashed border-rose-500/50 bg-rose-500/10 px-1 text-[9px] leading-none font-semibold text-rose-200"
        >
          <Skull aria-hidden className="size-2.5 shrink-0" />
          <span className="truncate">{c.title}</span>
        </span>
      ))}
    </span>
  )
}

function DetailRow({ name, rarity, category, effect, perk, help, cursed, footnote }: {
  name: string
  rarity: LoadoutEntry["rarity"]
  category: string
  effect: string | null
  perk: string | null
  help: HelpEntry
  cursed?: boolean
  footnote?: string | null
}) {
  return (
    <li className={cn("space-y-1 rounded-md border p-2", cursed ? "border-rose-500/30 bg-rose-500/[0.06]" : "border-border bg-muted/40")}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 [&>span]:truncate">
          <TitleBadge name={name} category={category} rarity={rarity} />
        </span>
        <InfoTip help={help} />
      </div>
      {effect && (
        <p className={cn("flex gap-1.5 text-xs leading-snug", cursed ? "text-rose-100/90" : "text-[var(--color-gold-light)]/90")}>
          <Zap aria-hidden className={cn("mt-0.5 size-3.5 shrink-0", cursed ? "text-rose-400" : "text-[var(--color-gold)]")} />
          <span>
            <span className="sr-only">Effect: </span>
            {effect}
          </span>
        </p>
      )}
      <p className="flex gap-1.5 text-xs leading-snug text-muted-foreground">
        {cursed ? (
          <Skull aria-hidden className="mt-0.5 size-3.5 shrink-0 text-rose-400" />
        ) : (
          <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0 text-[var(--color-gold)]" />
        )}
        <span>
          <span className="sr-only">After the game: </span>
          {perk ?? "Pure prestige: no perk after the game."}
        </span>
      </p>
      {footnote && (
        <p className="flex items-center gap-1.5 text-[11px] text-rose-200/80">
          <Hourglass aria-hidden className="size-3 shrink-0" />
          {footnote}
        </p>
      )}
    </li>
  )
}

// Every title a player wears and every brand burning on them, each with its bubble. For popovers and panels.
export function LoadoutDetails({ title, className }: { title: EquippedTitle; className?: string }) {
  const loadout = loadoutOf(title)
  const curses = title.curses ?? []
  return (
    <ul className={cn("space-y-1.5", className)} aria-label="Titles and curses">
      {loadout.map((entry) => (
        <DetailRow
          key={entry.title}
          name={entry.title}
          category={entry.category}
          rarity={entry.rarity}
          effect={entry.effect}
          perk={entry.perk}
          help={loadoutHelp(entry)}
        />
      ))}
      {curses.map((curse) => (
        <DetailRow
          key={curse.title}
          name={curse.title}
          category="mockery"
          rarity="cursed"
          effect={curse.effect ?? null}
          perk={curse.perk || null}
          help={curseHelp(curse)}
          cursed
          footnote={`${curse.bestowedBy ? `Branded by ${curse.bestowedBy} · ` : ""}${curse.gamesLeft} game${curse.gamesLeft === 1 ? "" : "s"} left`}
        />
      ))}
    </ul>
  )
}
