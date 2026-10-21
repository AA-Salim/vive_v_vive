"use client"

import { motion } from "motion/react"
import { BadgeCheckIcon, HourglassIcon, LockIcon, Undo2Icon, XIcon } from "lucide-react"
import { AnimatedNumber } from "@/components/prophecy/animated-number"
import { ChampionPortrait } from "@/components/prophecy/champion-portrait"
import { TONES } from "@/components/prophecy/category-meta"
import { CATEGORY_COPY, sealLabel } from "@/lib/prophecy/lines"
import { currentMultiplier, formatMultiplier, payoutIfHit } from "@/lib/prophecy/odds"
import type { Candidate, MarketBook, WagerView } from "@/lib/prophecy/types"
import { cn } from "@/lib/utils"

interface SealedProphecyProps {
  wager: WagerView
  candidate: Candidate | null
  book: MarketBook
  phase: "open" | "locked" | "voting" | "settled"
}

export function SealedProphecy({ wager, candidate, book, phase }: SealedProphecyProps) {
  const tone = TONES[wager.market]
  const Icon = tone.icon
  const name = candidate?.name ?? "A vanished player"
  const multiplier = wager.playerId ? currentMultiplier(book, wager.playerId) : null
  const potential = wager.playerId ? payoutIfHit(book, wager.playerId, wager.stake) : wager.stake

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("relative overflow-hidden rounded-xl border bg-[var(--color-navy)]/70 p-3", tone.border)}
    >
      <span
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-r to-transparent opacity-60", tone.glow)}
      />
      <div className="relative flex items-center gap-3">
        {candidate ? (
          <ChampionPortrait
            championInternal={candidate.championInternal}
            champion={candidate.champion}
            side={candidate.side}
            size="lg"
          />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Icon className={cn("size-6", tone.text)} aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className={cn("flex items-center gap-1.5 text-[10px] font-bold tracking-[0.18em] uppercase", tone.text)}>
            <Icon className="size-3.5" aria-hidden />
            Your {CATEGORY_COPY[wager.market].title.toLowerCase()}
          </div>
          <div className="truncate font-display text-base font-semibold text-foreground">
            {sealLabel(wager.market, name)}
          </div>
          <div className="text-xs text-muted-foreground">
            {wager.stake} staked
            {wager.status === "pending" && multiplier !== null && (
              <>
                {" "}
                · pays <span className={cn("font-semibold", tone.text)}>{formatMultiplier(multiplier)}</span> now (~
                <AnimatedNumber value={potential} />)
              </>
            )}
          </div>
        </div>
        <StatusChip wager={wager} phase={phase} />
      </div>
    </motion.div>
  )
}

function StatusChip({ wager, phase }: { wager: WagerView; phase: SealedProphecyProps["phase"] }) {
  const base = "flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider"
  if (wager.status === "won") {
    return (
      <span className={cn(base, "bg-emerald-500/15 text-emerald-300")}>
        <BadgeCheckIcon className="size-4" aria-hidden />
        <span>
          +<AnimatedNumber value={wager.payout ?? 0} />
        </span>
      </span>
    )
  }
  if (wager.status === "lost") {
    return (
      <span className={cn(base, "bg-destructive/15 text-destructive")}>
        <XIcon className="size-4" aria-hidden />
        <span>-{wager.stake}</span>
      </span>
    )
  }
  if (wager.status === "refunded") {
    return (
      <span className={cn(base, "bg-muted text-muted-foreground")}>
        <Undo2Icon className="size-4" aria-hidden />
        <span>Returned</span>
      </span>
    )
  }
  return (
    <span className={cn(base, "bg-muted text-muted-foreground")}>
      {phase === "voting" ? <HourglassIcon className="size-4" aria-hidden /> : <LockIcon className="size-4" aria-hidden />}
      <span>{phase === "voting" ? "Judging" : "Sealed"}</span>
    </span>
  )
}
