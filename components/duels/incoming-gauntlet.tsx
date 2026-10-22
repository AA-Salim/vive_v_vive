"use client"

import { motion, useReducedMotion } from "motion/react"
import { SwordsIcon } from "lucide-react"
import { RespondButtons } from "@/components/duels/duel-actions"
import { VersusCard } from "@/components/duels/versus-card"
import { DUEL_COPY } from "@/lib/duels/copy"
import { SIDE_NAME, canAfford, duelPayout, duelProfit, otherSide } from "@/lib/duels/rules"
import type { DuelAction, DuelView } from "@/lib/duels/types"

interface IncomingGauntletProps {
  duel: DuelView
  viewerId: string
  balance: number | null
  pendingAction: DuelAction | null
  busy: boolean
  highlight: boolean
  onAction: (duel: DuelView, action: DuelAction) => void
}

// A challenge naming the viewer: the loudest thing in the panel until it is answered.
export function IncomingGauntlet({ duel, viewerId, balance, pendingAction, busy, highlight, onAction }: IncomingGauntletProps) {
  const reduceMotion = useReducedMotion() ?? false
  const answer = SIDE_NAME[otherSide(duel.challengerSide)]
  const cannotAfford = balance !== null && !canAfford(balance, duel.stake)

  return (
    <motion.section
      layout={reduceMotion ? false : "position"}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      aria-label={`${duel.challenger.name} challenges you for ${duel.stake} points`}
      className="relative overflow-hidden rounded-2xl border border-[var(--color-gold)]/55 bg-[var(--color-gold)]/[0.06] p-3 shadow-[0_0_36px_-14px_var(--color-gold)]"
    >
      {!reduceMotion && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-[var(--color-gold)]/60"
          animate={{ opacity: [0.2, 0.9, 0.2] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <div className="relative flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-gold)]">
        <SwordsIcon className="size-3.5" aria-hidden />
        {DUEL_COPY.incomingKicker}
      </div>
      <p className="relative mt-1 text-sm leading-snug text-[var(--color-gold-light)]">
        <span className="font-semibold">{duel.challenger.name}</span> rides for {SIDE_NAME[duel.challengerSide]} and demands you
        answer with {answer}.
      </p>

      <div className="relative mt-3">
        <VersusCard duel={duel} viewerId={viewerId} compact highlight={highlight} />
      </div>

      <p className="relative mt-2.5 text-xs tabular-nums text-muted-foreground">
        Answer for <span className="font-semibold text-foreground">{duel.stake}</span>. Victory pays{" "}
        <span className="font-semibold text-[var(--color-gold)]">{duelPayout(duel.stake)}</span> (+{duelProfit(duel.stake)} after
        the tithe). Defeat costs {duel.stake}.
      </p>

      <div className="relative mt-3">
        <RespondButtons duel={duel} pendingAction={pendingAction} busy={busy} cannotAfford={cannotAfford} onAction={onAction} />
      </div>
    </motion.section>
  )
}
