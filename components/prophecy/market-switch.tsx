"use client"

import { CoinsIcon, UsersIcon } from "lucide-react"
import { AnimatedNumber } from "@/components/prophecy/animated-number"
import { ChampionPortrait } from "@/components/prophecy/champion-portrait"
import { TONES } from "@/components/prophecy/category-meta"
import { CATEGORIES, type Category } from "@/lib/prophecy/constants"
import { CATEGORY_COPY } from "@/lib/prophecy/lines"
import { favorites } from "@/lib/prophecy/odds"
import type { Candidate, MarketBooks } from "@/lib/prophecy/types"
import { cn } from "@/lib/utils"

interface MarketSwitchProps {
  books: MarketBooks
  candidates: Candidate[]
  value?: Category | null
  onChange?: (category: Category) => void
}

export function MarketSwitch({ books, candidates, value, onChange }: MarketSwitchProps) {
  const byId = new Map(candidates.map((c) => [c.playerId, c]))
  return (
    <div role="group" aria-label="Prophecy markets" className="grid grid-cols-2 gap-2 sm:gap-3">
      {CATEGORIES.map((category) => {
        const tone = TONES[category]
        const Icon = tone.icon
        const book = books[category]
        const top = favorites(book, 3)
        const active = value === category
        const content = (
          <>
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity",
                tone.glow,
                active && "opacity-100"
              )}
            />
            <span className="relative flex items-center justify-between gap-2">
              <span className={cn("flex items-center gap-1.5 text-xs font-bold tracking-[0.14em] uppercase", tone.text)}>
                <Icon className="size-4" aria-hidden />
                {CATEGORY_COPY[category].short}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CoinsIcon className="size-3" aria-hidden />
                <AnimatedNumber value={book.pot} className="font-semibold text-foreground" />
              </span>
            </span>
            <span className="relative mt-1 hidden text-xs text-muted-foreground sm:block">
              {CATEGORY_COPY[category].question}
            </span>
            <span className="relative mt-2 flex items-center gap-2">
              <span className="flex -space-x-1.5">
                {top.length === 0 && <span className="text-[11px] text-muted-foreground/80">No prophets yet</span>}
                {top.map((pick) => {
                  const c = byId.get(pick.playerId)
                  if (!c) return null
                  return (
                    <ChampionPortrait
                      key={pick.playerId}
                      championInternal={c.championInternal}
                      champion={c.champion}
                      side={c.side}
                      size="sm"
                      className="ring-1"
                    />
                  )
                })}
              </span>
              {book.prophets > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <UsersIcon className="size-3 sm:hidden" aria-hidden />
                  {book.prophets}
                  <span className="hidden sm:inline">{book.prophets === 1 ? "prophet" : "prophets"}</span>
                  <span className="sr-only sm:hidden">{book.prophets === 1 ? "prophet" : "prophets"}</span>
                </span>
              )}
            </span>
          </>
        )

        const classes = cn(
          "relative overflow-hidden rounded-xl border bg-[var(--color-navy)]/70 p-3 text-left",
          active ? tone.selected : "border-border"
        )

        if (!onChange) {
          return (
            <div key={category} className={classes}>
              {content}
            </div>
          )
        }
        return (
          <button
            key={category}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(category)}
            className={cn(
              classes,
              "min-h-[84px] cursor-pointer outline-none transition-[border-color,background-color] focus-visible:ring-2 focus-visible:ring-ring",
              !active && "hover:border-[var(--color-gold)]/40"
            )}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
