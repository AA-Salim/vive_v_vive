"use client"

import { Check, Hourglass } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { TitleBadge } from "@/components/title-badge"
import { PerkLine } from "@/components/titles/perk-line"
import { RARITY_FRAME } from "@/components/titles/title-visuals"
import { cn } from "@/lib/utils"
import { HALL_COPY } from "@/lib/titles/copy"
import { titleHelp } from "@/lib/titles/help"
import type { OwnedTitleView, TitleRarity, TitleView } from "@/lib/titles/types"

const RARITY_ORDER: Record<TitleRarity, number> = { legendary: 0, epic: 1, rare: 2, common: 3, cursed: 4 }

interface CollectionGridProps {
  titles: TitleView[]
  collection: OwnedTitleView[]
  locked: boolean
  busyId: string | null
  onEquip: (title: TitleView) => void
  onBrowse: () => void
}

export function CollectionGrid({ titles, collection, locked, busyId, onEquip, onBrowse }: CollectionGridProps) {
  const reduce = useReducedMotion()
  const titleById = new Map(titles.map((t) => [t.id, t]))
  const items = collection
    .flatMap((owned) => {
      const title = titleById.get(owned.title_id)
      return title ? [{ owned, title }] : []
    })
    .sort(
      (a, b) =>
        Number(b.owned.is_active) - Number(a.owned.is_active) ||
        RARITY_ORDER[a.title.rarity] - RARITY_ORDER[b.title.rarity] ||
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
        return (
          <motion.li
            key={title.id}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: reduce ? 0 : Math.min(index, 12) * 0.025 }}
            className={cn(
              "flex flex-col gap-2.5 rounded-xl border bg-card p-3.5",
              owned.is_active ? "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/[0.06]" : RARITY_FRAME[title.rarity]
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <TitleBadge
                name={title.name}
                category={title.category}
                rarity={title.rarity}
                perk={owned.perk}
                description={title.description}
                curse={
                  owned.curse
                    ? { bestowedBy: owned.bestowed_by?.name, gamesLeft: owned.curse.left, dignityCost: owned.curse.dignity_cost }
                    : null
                }
                price={title.price}
                size="md"
                interactive
              />
              {owned.is_active && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-300">
                  <Check aria-hidden className="size-3.5" />
                  Equipped
                </span>
              )}
            </div>
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
            <div className="mt-auto flex items-center justify-end gap-1.5">
              <InfoTip
                help={titleHelp({
                  name: title.name,
                  category: title.category,
                  perk: owned.perk,
                  price: title.price,
                  wearer: "you",
                  curse: owned.curse?.active
                    ? { bestowedBy: owned.bestowed_by?.name, gamesLeft: owned.curse.left, dignityCost: owned.curse.dignity_cost }
                    : null,
                })}
                side="top"
                align="end"
              />
              {owned.is_active ? null : (
                <Button
                  variant="outline"
                  className="h-10 px-4"
                  disabled={locked || busyId === title.id}
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
