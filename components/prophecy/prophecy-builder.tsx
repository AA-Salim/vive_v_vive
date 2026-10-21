"use client"

import { useState } from "react"
import { UsersIcon } from "lucide-react"
import { CandidateGrid } from "@/components/prophecy/candidate-grid"
import { TONES } from "@/components/prophecy/category-meta"
import { MarketSwitch } from "@/components/prophecy/market-switch"
import { StakeBar } from "@/components/prophecy/stake-bar"
import type { ClockedBoard, SealInput } from "@/components/prophecy/queries"
import { DEFAULT_STAKE, type Category } from "@/lib/prophecy/constants"
import { CATEGORY_COPY } from "@/lib/prophecy/lines"
import { formatMultiplier, projectedMultiplier } from "@/lib/prophecy/odds"
import { cn } from "@/lib/utils"

interface ProphecyBuilderProps {
  board: ClockedBoard
  balance: number | null
  sealing: boolean
  onSeal: (input: SealInput) => void
}

export function ProphecyBuilder({ board, balance, sealing, onSeal }: ProphecyBuilderProps) {
  const [market, setMarket] = useState<Category>("mvp")
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [stake, setStake] = useState(DEFAULT_STAKE)

  const book = board.books[market]
  const tone = TONES[market]
  const selfId = board.viewer?.playerId ?? null
  const candidate = board.candidates.find((c) => c.playerId === playerId) ?? null
  const selectable = market === "inter" && candidate?.playerId === selfId ? null : candidate

  const handleSeal = () => {
    if (selectable) onSeal({ market, playerId: selectable.playerId, stake })
  }

  return (
    <div className="space-y-3">
      <MarketSwitch books={board.books} candidates={board.candidates} value={market} onChange={setMarket} />

      <CandidateGrid
        candidates={board.candidates}
        category={market}
        label={CATEGORY_COPY[market].question}
        selectedId={selectable?.playerId ?? null}
        onSelect={setPlayerId}
        disabledReason={(c) => (market === "inter" && c.playerId === selfId ? "That's you" : null)}
        share={(c) => (book.pot > 0 ? (book.picks[c.playerId]?.stake ?? 0) / book.pot : 0)}
        describe={(c) => {
          const backers = book.picks[c.playerId]?.prophets ?? 0
          return `${c.name}, ${c.champion}, ${c.side} side. ${backers} ${backers === 1 ? "prophet" : "prophets"}. Pays ${formatMultiplier(projectedMultiplier(book, c.playerId, stake))} for a ${stake} point stake.`
        }}
        aside={(c) => {
          const backers = book.picks[c.playerId]?.prophets ?? 0
          return (
            <span className="flex flex-col items-end leading-none">
              <span className={cn("text-sm font-bold tabular-nums", book.pot === 0 ? "text-muted-foreground" : tone.text)}>
                {book.pot === 0 ? "open" : formatMultiplier(projectedMultiplier(book, c.playerId, stake))}
              </span>
              <span className="mt-1 flex items-center gap-0.5 text-[10px] text-muted-foreground tabular-nums">
                <UsersIcon className="size-2.5" aria-hidden />
                {backers}
              </span>
            </span>
          )
        }}
      />

      <StakeBar
        category={market}
        candidate={selectable}
        book={book}
        stake={stake}
        balance={balance}
        sealing={sealing}
        onStake={setStake}
        onSeal={handleSeal}
      />
    </div>
  )
}
