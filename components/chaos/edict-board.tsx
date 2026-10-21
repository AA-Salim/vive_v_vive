"use client"

import type { DecreeType } from "@/lib/chaos/catalog"
import { Skeleton } from "@/components/ui/skeleton"
import { DecreeCard, type DecreeCardModel } from "@/components/chaos/decree-card"

interface EdictBoardProps {
  cards: DecreeCardModel[]
  onSelect: (type: DecreeType) => void
}

export function EdictBoard({ cards, onSelect }: EdictBoardProps) {
  return (
    <ul aria-label="Royal decrees" className="grid grid-cols-2 gap-2.5 @lg:gap-3 @2xl:grid-cols-4">
      {cards.map((card, index) => (
        <li key={card.def.type} className="flex">
          <DecreeCard {...card} index={index} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  )
}

export function EdictBoardSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5 @lg:gap-3 @2xl:grid-cols-4" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-[172px] rounded-xl bg-[var(--color-navy-lighter)]/70" />
      ))}
    </div>
  )
}
