"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { Gem, Layers, Skull, Sparkles, Star, Trophy, type LucideIcon } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import { TitleShopCard } from "@/components/titles/title-shop-card"
import type { LoadoutModel } from "@/components/titles/loadout-model"
import { cn } from "@/lib/utils"
import { pts, type HelpEntry } from "@/lib/help"
import { gamesLabel } from "@/lib/titles/expiry"
import { setHelp, shopHelp } from "@/lib/titles/help"
import { LOADOUT_SLOTS, MAX_EQUIPPED, SLOT_COUNT, SLOT_LABEL } from "@/lib/titles/loadout"
import { HAND_KISS_NOTE, PRICE_TIERS, TIER_GAMES, TIER_LABEL, type PriceTier } from "@/lib/titles/pricing"
import { titleRulesV2 } from "@/lib/titles/rules-version"
import { liveSets } from "@/lib/titles/sets"
import type { OwnedTitleView, TitleView } from "@/lib/titles/types"

type Section = PriceTier | "curses"
type TierFilter = "all" | Section

const SECTIONS: Section[] = [...PRICE_TIERS, "curses"]

const SECTION_META: Record<Section, { label: string; tagline: string; icon: LucideIcon }> = {
  legendary: { label: TIER_LABEL.legendary, tagline: "The rule benders. One of your two super rare slots.", icon: Trophy },
  epic: { label: TIER_LABEL.epic, tagline: "Nearly as broken, for a little less.", icon: Gem },
  rare: { label: TIER_LABEL.rare, tagline: "The workhorses of every combo. Three slots.", icon: Star },
  common: { label: TIER_LABEL.common, tagline: "Cheap, cheerful, four slots of them.", icon: Sparkles },
  curses: { label: "Curses", tagline: "Bought for someone else. They pay you tribute while they burn.", icon: Skull },
}

const sectionOf = (title: TitleView): Section => (title.for_self ? title.tier : "curses")

const byPrice = (a: TitleView, b: TitleView) => b.price - a.price || a.name.localeCompare(b.name)

function sectionHelp(section: Section, items: TitleView[]): HelpEntry {
  const sold = items.map((t) => t.price).filter((p) => p > 0)
  const price = sold.length ? pts(Math.max(...sold)) : null
  const effects = items.flatMap((t) => t.effects.map((e) => `${t.name}: ${e.text}`))
  const lasts = section !== "curses" && titleRulesV2() ? ` Each purchase lasts ${gamesLabel(TIER_GAMES[section])} you take part in while wearing it.` : ""
  return {
    title: SECTION_META[section].label,
    does: `${SECTION_META[section].tagline}${effects.length ? ` ${effects.slice(0, 4).join(". ")}${effects.length > 4 ? ", and more" : ""}.` : ""}`,
    cost: price ? `${price}.${lasts} ${HAND_KISS_NOTE}` : "Honors are free, earned on the Rift",
    reward: "Every title also pays its own perk after each game",
    limits: `Up to ${MAX_EQUIPPED} titles worn at once: ${LOADOUT_SLOTS.map((s) => `${SLOT_COUNT[s]} ${SLOT_LABEL[s]}`).join(", ")}. Curses burn on someone else and take no slot.`,
  }
}

function Chip({ active, tone = "gold", onClick, children }: { active: boolean; tone?: "gold" | "rose" | "emerald"; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60",
        active
          ? tone === "rose"
            ? "border-rose-400/50 bg-rose-500/15 text-rose-100"
            : tone === "emerald"
              ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
              : "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/15 text-[var(--color-gold-light)]"
          : "border-border text-muted-foreground hover:text-[var(--color-gold-light)]"
      )}
    >
      {children}
    </button>
  )
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

// The Titles Shop: every title for sale by tier, filterable by tier and by set bonus.
export function Armory({ titles, collection, loadout, balance, signedIn, locked, busyId, onBuy, onBestow, onEquip, onUnequip }: ArmoryProps) {
  const reduce = useReducedMotion()
  const [tier, setTier] = useState<TierFilter>("all")
  const [setName, setSetName] = useState<string | null>(null)
  const ownedById = new Map(collection.map((c) => [c.title_id, c]))
  const shop = titles.filter((t) => t.category !== "award")
  const sets = liveSets()
  const set = sets.find((s) => s.name === setName) ?? null
  const present = SECTIONS.filter((s) => shop.some((t) => sectionOf(t) === s))

  const sections = present
    .filter((s) => tier === "all" || s === tier)
    .map((section) => ({
      section,
      items: shop.filter((t) => sectionOf(t) === section && (!set || set.members.includes(t.name))).sort(byPrice),
    }))
    .filter((s) => s.items.length > 0)

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <h2 className="font-display text-base text-[var(--color-gold-light)]">For sale</h2>
          <span className="text-xs text-muted-foreground">How titles work</span>
          <InfoTip help={shopHelp()} side="bottom" align="start" />
        </div>
        <div role="group" aria-label="Filter titles by tier" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {(["all", ...present] as TierFilter[]).map((key) => {
            const Icon = key === "all" ? null : SECTION_META[key].icon
            return (
              <Chip key={key} active={tier === key} tone={key === "curses" ? "rose" : "gold"} onClick={() => setTier(key)}>
                {Icon ? <Icon aria-hidden className="size-4" /> : null}
                {key === "all" ? "All" : SECTION_META[key].label}
              </Chip>
            )
          })}
        </div>
        {sets.length > 0 && (
          <div role="group" aria-label="Filter titles by set" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {sets.map((s) => {
              const progress = loadout.sets.find((p) => p.set.name === s.name)
              return (
                <Chip key={s.name} active={setName === s.name} tone="emerald" onClick={() => setSetName(setName === s.name ? null : s.name)}>
                  <Layers aria-hidden className="size-4" />
                  {s.name}
                  <span className="text-xs tabular-nums opacity-70">
                    {Math.min(progress?.count ?? 0, s.needs)}/{s.needs}
                  </span>
                </Chip>
              )
            })}
          </div>
        )}
        {set && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {set.blurb}
            <InfoTip help={setHelp(set, loadout.sets.find((p) => p.set.name === set.name)?.count)} />
          </p>
        )}
      </div>

      {sections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {set ? "Nothing of that set in this tier. Try All." : "The shop is empty. Someone bought out the whole kingdom."}
        </p>
      ) : (
        sections.map(({ section, items }) => {
          const meta = SECTION_META[section]
          const Icon = meta.icon
          const lasts = section !== "curses" && titleRulesV2() ? ` · ${gamesLabel(TIER_GAMES[section])} each` : ""
          return (
            <section key={section} aria-labelledby={`shop-${section}`} className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", section === "curses" ? "text-rose-400" : "text-[var(--color-gold)]")} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <h2 id={`shop-${section}`} className="font-display text-base leading-tight text-[var(--color-gold-light)]">
                      {meta.label}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">{lasts}</span>
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
                      sets={loadout.sets}
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
