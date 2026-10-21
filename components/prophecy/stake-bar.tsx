"use client"

import { CoinsIcon, LoaderCircleIcon, ScrollTextIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatedNumber } from "@/components/prophecy/animated-number"
import { TONES } from "@/components/prophecy/category-meta"
import { DEBT_FLOOR, STAKE_CHIPS, type Category } from "@/lib/prophecy/constants"
import { sealLabel } from "@/lib/prophecy/lines"
import { formatMultiplier, projectedMultiplier, projectedPayout } from "@/lib/prophecy/odds"
import type { Candidate, MarketBook } from "@/lib/prophecy/types"
import { cn } from "@/lib/utils"

interface StakeBarProps {
  category: Category
  candidate: Candidate | null
  book: MarketBook
  stake: number
  balance: number | null
  sealing: boolean
  onStake: (stake: number) => void
  onSeal: () => void
}

export function StakeBar({ category, candidate, book, stake, balance, sealing, onStake, onSeal }: StakeBarProps) {
  const tone = TONES[category]
  const affordable = (amount: number) => balance === null || balance - amount >= DEBT_FLOOR
  const canSeal = !!candidate && affordable(stake) && !sealing
  const payout = candidate ? projectedPayout(book, candidate.playerId, stake) : 0
  const multiplier = candidate ? projectedMultiplier(book, candidate.playerId, stake) : null

  return (
    <div className="space-y-3 rounded-xl border border-border bg-[var(--color-navy)]/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <span id="prophecy-stake-label" className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Stake
        </span>
        {balance !== null && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CoinsIcon className="size-3.5" aria-hidden />
            Balance <AnimatedNumber value={balance} className="font-semibold text-foreground" />
          </span>
        )}
      </div>

      <div role="group" aria-labelledby="prophecy-stake-label" className="grid grid-cols-3 gap-2">
        {STAKE_CHIPS.map((chip) => {
          const active = chip === stake
          const disabled = !affordable(chip)
          return (
            <button
              key={chip}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onStake(chip)}
              className={cn(
                "flex h-11 items-center justify-center gap-1 rounded-lg border text-sm font-bold tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active ? tone.selected : "border-border text-muted-foreground hover:border-[var(--color-gold)]/40 hover:text-foreground",
                active && tone.text,
                disabled && "cursor-not-allowed opacity-40"
              )}
            >
              {chip}
              <span className="text-[10px] font-medium opacity-70">pts</span>
            </button>
          )
        })}
      </div>

      <p className="min-h-10 text-xs leading-relaxed text-muted-foreground" aria-live="polite">
        {!candidate && "Pick a player above. Lonely calls pay the most."}
        {candidate && book.pot === 0 && (
          <>
            <span className="font-semibold text-foreground">{sealLabel(category, candidate.name)}</span>. You would be the
            first prophet: the pot grows as others seal theirs.
          </>
        )}
        {candidate && book.pot > 0 && (
          <>
            <span className="font-semibold text-foreground">{sealLabel(category, candidate.name)}</span> pays about{" "}
            <span className={cn("font-bold", tone.text)}>{payout}</span> ({formatMultiplier(multiplier)}) if the court
            agrees right now.
          </>
        )}
      </p>

      <Button
        onClick={onSeal}
        disabled={!canSeal}
        className="h-11 w-full bg-[var(--color-gold)] text-sm font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]"
      >
        {sealing ? (
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
        ) : (
          <ScrollTextIcon className="size-4" aria-hidden />
        )}
        {sealing ? "Sealing..." : `Seal prophecy · ${stake}`}
      </Button>
      {balance !== null && !affordable(stake) && (
        <p className="text-center text-xs text-destructive">That stake would sink you past the -300 debt floor.</p>
      )}
    </div>
  )
}
