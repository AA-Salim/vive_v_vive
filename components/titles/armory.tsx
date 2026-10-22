"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Coins, Crown, Feather, Sparkles, Skull, Swords, ScrollText, type LucideIcon } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import { TitleShopCard } from "@/components/titles/title-shop-card"
import type { LoadoutModel } from "@/components/titles/loadout-model"
import { cn } from "@/lib/utils"
import { pts, type HelpEntry } from "@/lib/help"
import { DOMAIN_LABEL, EFFECT_DOMAINS, type EffectDomain } from "@/lib/titles/effects"
import { LOADOUT_SLOTS, MAX_EQUIPPED, SLOT_COUNT, SLOT_LABEL } from "@/lib/titles/loadout"
import { HAND_KISS_NOTE, PRICE_TIERS } from "@/lib/titles/pricing"
import type { OwnedTitleView, TitleView } from "@/lib/titles/types"

type Section = EffectDomain | "cosmetic"
type Filter = "all" | Section | "curses"

const SECTIONS: Section[] = [...EFFECT_DOMAINS, "cosmetic"]

const SECTION_META: Record<Section, { label: string; tagline: string; icon: LucideIcon }> = {
  decrees: { label: DOMAIN_LABEL.decrees, tagline: "Cheaper, extra or untouchable Royal Decrees.", icon: ScrollText },
  betting: { label: DOMAIN_LABEL.betting, tagline: "Longer boosts, better insurance, bigger all-ins. Or a cap.", icon: Coins },
  praise: { label: DOMAIN_LABEL.praise, tagline: "Written praise and Royal Favor that pay more.", icon: Feather },
  duels: { label: DOMAIN_LABEL.duels, tagline: "A lighter tithe, or a softer defeat.", icon: Swords },
  court: { label: DOMAIN_LABEL.court, tagline: "Stipends, cheaper curses and the Herald's attention.", icon: Crown },
  cosmetic: { label: "Perks only", tagline: "No immediate effect: these pay after each game.", icon: Sparkles },
}

const TIER_RANK = Object.fromEntries(PRICE_TIERS.map((tier, index) => [tier, index])) as Record<TitleView["tier"], number>

const byTier = (a: TitleView, b: TitleView) =>
  TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.price - b.price || a.name.localeCompare(b.name)

const sectionOf = (title: TitleView): Section => title.domain ?? "cosmetic"

function sectionHelp(section: Section, items: TitleView[]): HelpEntry {
  const sold = items.map((t) => t.price).filter((p) => p > 0)
  const range = sold.length ? `${Math.min(...sold).toLocaleString("en-US")} to ${pts(Math.max(...sold))}` : null
  const effects = items.flatMap((t) => t.effects.map((e) => `${t.name}: ${e.text}`))
  return {
    title: SECTION_META[section].label,
    does: `${SECTION_META[section].tagline}${effects.length ? ` ${effects.slice(0, 4).join(". ")}${effects.length > 4 ? ", and more" : ""}.` : ""}`,
    cost: range ? `${range}, once. ${HAND_KISS_NOTE}` : "Honors are free, earned on the Rift",
    reward: "Every title also pays its own perk after each game",
    limits: `Up to ${MAX_EQUIPPED} titles worn at once: ${LOADOUT_SLOTS.map((s) => `${SLOT_COUNT[s]} ${SLOT_LABEL[s]}`).join(", ")}. Curses burn on someone else and take no slot.`,
  }
}

interface ArmoryProps {
  titles: TitleView[]
  collection: OwnedTitleView[]
  loadout: LoadoutModel
  balance: number | null
  signedIn: boolean
  locked: boolean
  busyId: string | null
  onBuy: (title: TitleView) => void
  onBestow: (title: TitleView) => void
  onEquip: (title: TitleView) => void
  onUnequip: (title: TitleView) => void
}

export function Armory({ titles, collection, loadout, balance, signedIn, locked, busyId, onBuy, onBestow, onEquip, onUnequip }: ArmoryProps) {
  const reduce = useReducedMotion()
  const [filter, setFilter] = useState<Filter>("all")
  const ownedById = new Map(collection.map((c) => [c.title_id, c]))
  const shop = titles.filter((t) => t.category !== "award")
  const present = SECTIONS.filter((s) => shop.some((t) => sectionOf(t) === s))
  const filters: Filter[] = ["all", ...present, "curses"]

  const sections = present
    .filter((s) => filter === "all" || filter === "curses" || s === filter)
    .map((section) => ({
      section,
      items: shop.filter((t) => sectionOf(t) === section && (filter !== "curses" || !t.for_self)).sort(byTier),
    }))
    .filter((s) => s.items.length > 0)

  return (
    <div className="space-y-5">
      <div role="group" aria-label="Filter titles by what they do" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {filters.map((key) => {
          const Icon = key === "all" ? null : key === "curses" ? Skull : SECTION_META[key].icon
          const active = filter === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(key)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60",
                active
                  ? key === "curses"
                    ? "border-rose-400/50 bg-rose-500/15 text-rose-100"
                    : "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/15 text-[var(--color-gold-light)]"
                  : "border-border text-muted-foreground hover:text-[var(--color-gold-light)]"
              )}
            >
              {Icon ? <Icon aria-hidden className="size-4" /> : null}
              {key === "all" ? "All" : key === "curses" ? "Curses" : SECTION_META[key].label}
            </button>
          )
        })}
      </div>

      {sections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          The armory is empty. Someone bought out the whole kingdom.
        </p>
      ) : (
        sections.map(({ section, items }) => {
          const meta = SECTION_META[section]
          const Icon = meta.icon
          return (
            <section key={section} aria-labelledby={`armory-${section}`} className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--color-gold)]" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <h2 id={`armory-${section}`} className="font-display text-base leading-tight text-[var(--color-gold-light)]">
                      {meta.label}
                    </h2>
                    <InfoTip help={sectionHelp(section, items)} side="top" align="start" />
                  </div>
                  <p className="text-xs text-muted-foreground">{meta.tagline}</p>
                </div>
              </div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {items.map((title, index) => (
                  <motion.li
                    key={title.id}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: reduce ? 0 : Math.min(index, 8) * 0.04 }}
                  >
                    <TitleShopCard
                      title={title}
                      owned={ownedById.get(title.id)}
                      balance={balance}
                      signedIn={signedIn}
                      locked={locked}
                      busy={busyId === title.id}
                      worn={loadout.isWorn(title.id)}
                      equipBlock={loadout.blockFor(title)}
                      onBuy={onBuy}
                      onBestow={onBestow}
                      onEquip={onEquip}
                      onUnequip={onUnequip}
                    />
                  </motion.li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
