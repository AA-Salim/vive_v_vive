"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"
import { SwordsIcon } from "lucide-react"
import { DuelAvatar } from "@/components/duels/duel-avatar"
import { SIDE_NAME, otherSide } from "@/lib/duels/rules"
import type { DuelView, Duelist } from "@/lib/duels/types"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

const SIDE_TEXT: Record<Side, string> = {
  blue: "text-[var(--color-blue-team)]",
  red: "text-[var(--color-red-team)]",
}

interface StatusChip {
  label: string
  tone: "gold" | "muted" | "live"
}

function statusChip(duel: DuelView, viewerId: string | null): StatusChip {
  switch (duel.status) {
    case "open":
      if (duel.isOpen) return { label: "Open gauntlet", tone: "gold" }
      return { label: duel.opponent?.userId === viewerId ? "Awaiting you" : `Awaiting ${duel.opponent?.name ?? "an answer"}`, tone: "gold" }
    case "accepted":
      return { label: "Sworn", tone: "live" }
    case "won":
    case "lost": {
      const winner = duel.winnerId === duel.challenger.userId ? duel.challenger : duel.opponent
      return { label: winner ? `${winner.userId === viewerId ? "You" : winner.name} won` : "Settled", tone: "live" }
    }
    case "declined":
      return { label: "Declined", tone: "muted" }
    case "withdrawn":
      return { label: "Withdrawn", tone: "muted" }
    case "expired":
      return { label: "Unanswered", tone: "muted" }
    case "refunded":
      return { label: "Refunded", tone: "muted" }
  }
}

const CHIP_TONE: Record<StatusChip["tone"], string> = {
  gold: "border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 text-[var(--color-gold)]",
  live: "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/15 text-[var(--color-gold-light)]",
  muted: "border-border bg-muted/50 text-muted-foreground",
}

export function fightersOf(duel: DuelView): Record<Side, Duelist | null> {
  const challengerSide = duel.challengerSide
  return {
    [challengerSide]: duel.challenger,
    [otherSide(challengerSide)]: duel.opponent,
  } as Record<Side, Duelist | null>
}

interface FighterProps {
  duel: DuelView
  side: Side
  fighter: Duelist | null
  viewerId: string | null
  compact: boolean
}

function Fighter({ duel, side, fighter, viewerId, compact }: FighterProps) {
  const settled = duel.status === "won" || duel.status === "lost"
  const isWinner = settled && duel.winnerSide === side
  const isLoser = settled && duel.winnerSide !== null && duel.winnerSide !== side
  const isViewer = !!fighter && fighter.userId === viewerId
  const name = fighter ? fighter.name : duel.status === "open" ? "Anyone" : "Nobody"
  const align = side === "blue" ? "items-start text-left" : "items-end text-right"

  if (compact) {
    return (
      <div className={cn("flex min-w-0 items-center gap-2", side === "red" && "flex-row-reverse")}>
        <DuelAvatar duelist={fighter} side={side} size="sm" winner={isWinner} dim={isLoser} />
        <div className={cn("flex min-w-0 flex-col", align)}>
          <span className={cn("max-w-full truncate text-[13px] font-semibold", isLoser ? "text-muted-foreground" : "text-foreground")}>
            {name}
          </span>
          <span className={cn("text-[10px] font-semibold uppercase tracking-[0.16em]", SIDE_TEXT[side])}>
            {isViewer ? "You" : SIDE_NAME[side]}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <DuelAvatar duelist={fighter} side={side} size="md" winner={isWinner} dim={isLoser} />
      <span
        className={cn(
          "max-w-full truncate text-sm font-semibold",
          isWinner ? "text-[var(--color-gold-light)]" : isLoser ? "text-muted-foreground line-through decoration-1" : "text-foreground"
        )}
      >
        {name}
      </span>
      <span className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", SIDE_TEXT[side])}>
        {isViewer ? `You · ${SIDE_NAME[side]}` : !fighter && duel.status === "open" ? `takes ${SIDE_NAME[side]}` : SIDE_NAME[side]}
      </span>
      {settled && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
            isWinner ? "bg-[var(--color-gold)]/15 text-[var(--color-gold)]" : "text-muted-foreground"
          )}
        >
          {isWinner ? `+${(duel.payout ?? duel.stake * 2) - duel.stake}` : `−${duel.stake}`}
        </span>
      )}
    </div>
  )
}

interface VersusCardProps {
  duel: DuelView
  viewerId: string | null
  compact?: boolean
  highlight?: boolean
  children?: ReactNode
}

export function VersusCard({ duel, viewerId, compact = false, highlight = false, children }: VersusCardProps) {
  const reduceMotion = useReducedMotion() ?? false
  const fighters = fightersOf(duel)
  const chip = statusChip(duel, viewerId)
  const settled = duel.status === "won" || duel.status === "lost"
  const faded = ["declined", "withdrawn", "expired", "refunded"].includes(duel.status)
  const mine = !!viewerId && (duel.challenger.userId === viewerId || duel.opponent?.userId === viewerId)
  const label = `${fighters.blue?.name ?? "Anyone"} on Blue versus ${fighters.red?.name ?? "Anyone"} on Red, ${duel.stake} points each. ${chip.label}.`

  return (
    <motion.article
      layout={reduceMotion ? false : "position"}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: faded ? 0.7 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      aria-label={label}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-[var(--color-navy)]/60",
        mine ? "border-[var(--color-gold)]/35" : "border-border",
        compact ? "px-3 py-2.5" : "px-3 pt-2.5 pb-3"
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--color-blue-team)]/12 via-transparent to-[var(--color-red-team)]/12"
      />
      {settled && duel.winnerSide && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 w-1/2 from-[var(--color-gold)]/18 to-transparent",
            duel.winnerSide === "blue" ? "left-0 bg-gradient-to-r" : "right-0 bg-gradient-to-l"
          )}
        />
      )}
      {highlight && !reduceMotion && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-[var(--color-gold)]/70"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2.2, ease: "easeOut" }}
        />
      )}

      {!compact && (
        <div className="relative mb-2 flex items-center justify-between gap-2">
          <span className={cn("inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-semibold", CHIP_TONE[chip.tone])}>
            {chip.label}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">Pot {duel.stake * 2}</span>
        </div>
      )}

      <div className={cn("relative grid items-center", compact ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2" : "grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)] gap-1")}>
        <Fighter duel={duel} side="blue" fighter={fighters.blue} viewerId={viewerId} compact={compact} />
        <div className="flex flex-col items-center gap-0.5">
          <span
            aria-hidden
            className={cn(
              "grid place-items-center rounded-full border border-[var(--color-gold)]/40 bg-[var(--color-navy)] text-[var(--color-gold)]",
              compact ? "size-7" : "size-9"
            )}
          >
            <SwordsIcon className={compact ? "size-3.5" : "size-4"} />
          </span>
          <span className={cn("font-display font-semibold tabular-nums text-[var(--color-gold-light)]", compact ? "text-sm" : "text-lg leading-tight")}>
            {duel.stake}
          </span>
          {!compact && <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">each</span>}
        </div>
        <Fighter duel={duel} side="red" fighter={fighters.red} viewerId={viewerId} compact={compact} />
      </div>

      {children && <div className="relative mt-3 border-t border-border/60 pt-3">{children}</div>}
    </motion.article>
  )
}
