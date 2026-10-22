"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { InfoTip } from "@/components/ui/info-tip"
import { TitleShopCard } from "@/components/titles/title-shop-card"
import { CATEGORY_ICON } from "@/components/titles/title-visuals"
import { cn } from "@/lib/utils"
import { CATEGORY_META } from "@/lib/titles/catalog"
import { categoryHelp } from "@/lib/titles/help"
import type { OwnedTitleView, TitleCategory, TitleView } from "@/lib/titles/types"

type ShopCategory = Exclude<TitleCategory, "award">
type Filter = "all" | ShopCategory

const SHOP_CATEGORIES: ShopCategory[] = ["rebellion", "loyalty", "absurd", "mockery"]
const FILTERS: Filter[] = ["all", ...SHOP_CATEGORIES]

interface ArmoryProps {
  titles: TitleView[]
  collection: OwnedTitleView[]
  balance: number | null
  signedIn: boolean
  locked: boolean
  busyId: string | null
  onBuy: (title: TitleView) => void
  onBestow: (title: TitleView) => void
  onEquip: (title: TitleView) => void
}

export function Armory({ titles, collection, balance, signedIn, locked, busyId, onBuy, onBestow, onEquip }: ArmoryProps) {
  const reduce = useReducedMotion()
  const [filter, setFilter] = useState<Filter>("all")
  const ownedById = new Map(collection.map((c) => [c.title_id, c]))
  const byPrice = (a: TitleView, b: TitleView) => a.price - b.price || a.name.localeCompare(b.name)
  const sections = SHOP_CATEGORIES.filter((c) => filter === "all" || c === filter)
    .map((category) => ({ category, items: titles.filter((t) => t.category === category).sort(byPrice) }))
    .filter((section) => section.items.length > 0)

  return (
    <div className="space-y-5">
      <div role="group" aria-label="Filter titles by category" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((key) => {
          const Icon = key === "all" ? null : CATEGORY_ICON[key]
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
                  ? key === "mockery"
                    ? "border-rose-400/50 bg-rose-500/15 text-rose-100"
                    : "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/15 text-[var(--color-gold-light)]"
                  : "border-border text-muted-foreground hover:text-[var(--color-gold-light)]"
              )}
            >
              {Icon ? <Icon aria-hidden className="size-4" /> : null}
              {key === "all" ? "All" : CATEGORY_META[key].label}
            </button>
          )
        })}
      </div>

      {sections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          The armory is empty. Someone bought out the whole kingdom.
        </p>
      ) : (
        sections.map(({ category, items }) => {
          const Icon = CATEGORY_ICON[category]
          return (
            <section key={category} aria-labelledby={`armory-${category}`} className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Icon
                  aria-hidden
                  className={cn("mt-0.5 size-4 shrink-0", category === "mockery" ? "text-rose-400" : "text-[var(--color-gold)]")}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <h2 id={`armory-${category}`} className="font-display text-base leading-tight text-[var(--color-gold-light)]">
                      {CATEGORY_META[category].label}
                    </h2>
                    <InfoTip help={categoryHelp(category, items.map((t) => t.price))} side="top" align="start" />
                  </div>
                  <p className="text-xs text-muted-foreground">{CATEGORY_META[category].tagline}</p>
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
                      onBuy={onBuy}
                      onBestow={onBestow}
                      onEquip={onEquip}
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
