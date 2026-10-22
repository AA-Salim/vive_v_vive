"use client"

import { Check, Crown, Hourglass } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { TitleBadge } from "@/components/title-badge"
import { EffectLines } from "@/components/titles/effect-lines"
import type { LoadoutModel } from "@/components/titles/loadout-model"
import { PerkLine } from "@/components/titles/perk-line"
import { TierChip } from "@/components/titles/tier-chip"
import { RARITY_FRAME } from "@/components/titles/title-visuals"
import { cn } from "@/lib/utils"
import { HALL_COPY } from "@/lib/titles/copy"
import { titleHelp } from "@/lib/titles/help"
import { SLOT_LABEL } from "@/lib/titles/loadout"
import { PRICE_TIERS } from "@/lib/titles/pricing"
import type { OwnedTitleView, TitleView } from "@/lib/titles/types"

const TIER_RANK = Object.fromEntries(PRICE_TIERS.map((tier, index) => [tier, index])) as Record<TitleView["tier"], number>

interface CollectionGridProps {
  titles: TitleView[]
  collection: OwnedTitleView[]
  loadout: LoadoutModel
  busyId: string | null
  onEquip: (title: TitleView) => void
  onUnequip: (title: TitleView) => void
  onBrowse: () => void
}

export function CollectionGrid({ titles, collection, loadout, busyId, onEquip, onUnequip, onBrowse }: CollectionGridProps) {
  const reduce = useReducedMotion()
  const titleById = new Map(titles.map((t) => [t.id, t]))
  const primaryId = loadout.worn.find((w) => w.primary)?.title.id ?? null
  const items = collection
    .flatMap((owned) => {
      const title = titleById.get(owned.title_id)
      return title ? [{ owned, title }] : []
    })
    .sort(
      (a, b) =>
        Number(b.owned.is_active) - Number(a.owned.is_active) ||
        Number(a.title.category === "mockery") - Number(b.title.category === "mockery") ||
        TIER_RANK[a.title.tier] - TIER_RANK[b.title.tier] ||
        a.title.name.localeCompare(b.title.name)
    )

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">{HALL_COPY.emptyCollection}</p>
        <Button className="mt-4 h-10" onClick={onBrowse}>
          Browse the armory
        </Button>
      </div>
    )
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {items.map(({ owned, title }, index) => {
        const brand = !title.for_self
        const worn = owned.is_active
        const block = worn ? null : loadout.blockFor(title)
        const blockId = `collection-block-${title.id}`
        return (
          <motion.li
            key={title.id}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: reduce ? 0 : Math.min(index, 12) * 0.025 }}
            className={cn(
              "flex flex-col gap-2.5 rounded-xl border bg-card p-3.5",
              worn ? "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/[0.06]" : RARITY_FRAME[title.rarity]
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <TitleBadge
                name={title.name}
                category={title.category}
                rarity={title.rarity}
                perk={owned.perk}
                description={title.description}
                price={title.price}
                tier={title.tier}
                curse={
                  owned.curse
                    ? { bestowedBy: owned.bestowed_by?.name, gamesLeft: owned.curse.left, dignityCost: owned.curse.dignity_cost }
                    : null
                }
                size="md"
                interactive
              />
              {worn ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-300">
                  {title.id === primaryId ? <Crown aria-hidden className="size-3.5 text-[var(--color-gold)]" /> : <Check aria-hidden className="size-3.5" />}
                  {title.id === primaryId ? "Primary" : "Equipped"}
                </span>
              ) : (
                <TierChip tier={title.tier} size="sm" cursed={brand} />
              )}
            </div>
            {!brand && <EffectLines effects={title.effects} emptyLabel={null} />}
            {brand && owned.curse?.active && <EffectLines effects={title.effects} cursed emptyLabel={null} />}
            <PerkLine
              perk={owned.perk}
              emptyLabel={brand ? "Burnt out. A scar, not a curse: wear it with pride." : undefined}
            />
            {brand && owned.curse && (
              <p className="flex items-center gap-1.5 text-[11px] text-rose-200/80">
                <Hourglass aria-hidden className="size-3" />
                {owned.curse.active
                  ? `Burning: ${owned.curse.left} game${owned.curse.left === 1 ? "" : "s"} left · by ${owned.bestowed_by?.name ?? "someone"}`
                  : `Branded by ${owned.bestowed_by?.name ?? "someone"}, now cold`}
              </p>
            )}
            {block && (
              <p id={blockId} className="text-[11px] leading-snug text-amber-200/80">
                {block}
              </p>
            )}
            <div className="mt-auto flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-[10px] tracking-wider text-muted-foreground uppercase">
                {SLOT_LABEL[title.slot]} slot
                <InfoTip
                  help={titleHelp({
                    name: title.name,
                    category: title.category,
                    perk: owned.perk,
                    price: title.price,
                    tier: title.tier,
                    wearer: "you",
                    curse: owned.curse?.active
                      ? { bestowedBy: owned.bestowed_by?.name, gamesLeft: owned.curse.left, dignityCost: owned.curse.dignity_cost }
                      : null,
                  })}
                  side="top"
                  align="end"
                />
              </span>
              {worn ? (
                <Button
                  variant="ghost"
                  className="h-10 px-4 text-muted-foreground"
                  disabled={loadout.locked || busyId === title.id}
                  onClick={() => onUnequip(title)}
                >
                  Take off
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="h-10 px-4"
                  disabled={!!block || busyId === title.id}
                  aria-describedby={block ? blockId : undefined}
                  onClick={() => onEquip(title)}
                >
                  {brand ? "Wear it" : "Equip"}
                </Button>
              )}
            </div>
          </motion.li>
        )
      })}
    </ul>
  )
}
