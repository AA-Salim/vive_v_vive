"use client"

import { useEffect } from "react"
import { motion, useReducedMotion } from "motion/react"
import { FlameIcon, RotateCcwIcon, SkullIcon, TrophyIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AnimatedNumber } from "@/components/betting/animated-number"
import { claimCelebration, fireWinConfetti } from "@/components/betting/confetti"
import { outcomeTone } from "@/components/betting/payout-preview"
import { allInRoast, allInSelfRoast, resultLine } from "@/lib/betting/copy"
import { formatSigned, settledBreakdown, sideLabel } from "@/lib/betting/math"
import type { MarketBet, MarketResult, ResultHighlight } from "@/lib/betting/types"
import { cn } from "@/lib/utils"

interface ResultRevealProps {
  sessionId: string
  result: MarketResult
  bet: MarketBet | null
  viewerId: string | null
  canceled?: boolean
}

function Highlight({ kind, entry }: { kind: "winner" | "loser"; entry: ResultHighlight | null }) {
  if (!entry) return null
  const Icon = kind === "winner" ? TrophyIcon : SkullIcon
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3",
        kind === "winner" ? "border-[var(--color-gold)]/35 bg-[var(--color-gold)]/[0.07]" : "border-rose-300/25 bg-rose-300/[0.05]"
      )}
    >
      <Avatar className="shrink-0">
        {entry.avatar_url && <AvatarImage src={entry.avatar_url} alt="" />}
        <AvatarFallback className="bg-[var(--color-navy-lighter)] text-xs font-semibold text-[var(--color-gold)]">
          {entry.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Icon className={cn("size-3", kind === "winner" ? "text-[var(--color-gold)]" : "text-rose-300")} aria-hidden />
          {kind === "winner" ? "Biggest winner" : "Biggest loser"}
        </div>
        <div className="truncate text-sm font-semibold text-[var(--color-gold-light)]">{entry.name}</div>
      </div>
      <span className={cn("font-display text-lg font-semibold tabular-nums", outcomeTone(entry.net))}>{formatSigned(entry.net)}</span>
    </div>
  )
}

export function ResultReveal({ sessionId, result, bet, viewerId, canceled = false }: ResultRevealProps) {
  const reduced = useReducedMotion()
  const settled = bet && bet.status !== "pending" ? bet : null
  const net = settled?.net ?? 0
  const won = settled?.status === "won"

  const settledStatus = settled?.status ?? null
  const settledSide = settled?.side ?? null

  useEffect(() => {
    if (!settledStatus || settledStatus === "refunded") return
    if (!claimCelebration(sessionId)) return
    if (settledStatus === "won") fireWinConfetti(settledSide)
  }, [sessionId, settledStatus, settledSide])

  const kind = !settled
    ? null
    : settled.status === "refunded"
      ? canceled
        ? "canceled"
        : "refund"
      : won
        ? "win"
        : settled.insured
          ? "insured"
          : "loss"
  const flavor =
    settled && settled.status === "lost" && settled.all_in
      ? allInSelfRoast(sessionId)
      : kind
        ? resultLine(kind, `${sessionId}:${viewerId ?? ""}`)
        : null
  const breakdown = settled ? settledBreakdown(settled) : []
  const roasts = result.all_in_losers.filter((name) => name !== settled?.name || !settled?.all_in).slice(0, 2)

  const banner = result.refunded || canceled
    ? {
        icon: RotateCcwIcon,
        title: canceled ? "Game called off" : "No contest",
        text: resultLine(canceled ? "canceled" : "refund", sessionId),
        tone: "text-[var(--color-gold-light)]",
      }
    : {
        icon: TrophyIcon,
        title: `${result.winner ? sideLabel(result.winner) : "The"} side wins`,
        text: `Pool of ${result.total_pool}${result.insurance_paid ? ` · ${result.insurance_paid} returned by insurance` : ""}${result.bonus_paid ? ` · ${result.bonus_paid} in boosts` : ""}`,
        tone: result.winner === "blue" ? "text-[var(--color-blue-team)]" : "text-[var(--color-red-team)]",
      }

  return (
    <div className="space-y-3">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 rounded-xl border border-[var(--color-gold)]/25 bg-[var(--color-navy)]/60 p-3"
      >
        <banner.icon className={cn("size-6 shrink-0", banner.tone)} aria-hidden />
        <div className="min-w-0">
          <div className={cn("font-display text-lg font-semibold", banner.tone)}>{banner.title}</div>
          <div className="text-xs text-muted-foreground">{banner.text}</div>
        </div>
      </motion.div>

      {settled && (
        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: reduced ? 0 : 0.15 }}
          className={cn(
            "rounded-xl border p-4 text-center",
            won ? "border-emerald-300/35 bg-emerald-300/[0.06]" : settled.status === "lost" ? "border-rose-300/30 bg-rose-300/[0.05]" : "border-border bg-[var(--color-navy)]/50"
          )}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {won ? "Your take" : settled.status === "lost" ? "Your damage" : "Your stake came back"}
          </div>
          <AnimatedNumber
            from={0}
            value={net}
            duration={1.4}
            format={formatSigned}
            className={cn("block font-display text-4xl font-bold tabular-nums sm:text-5xl", outcomeTone(net))}
          />
          {breakdown.length > 1 && (
            <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted-foreground">
              {breakdown.map((line) => (
                <li key={line.label}>
                  {line.label} <span className={outcomeTone(line.value)}>{formatSigned(line.value)}</span>
                </li>
              ))}
            </ul>
          )}
          {flavor && <p className="mt-2 text-xs italic text-[var(--color-gold-light)]/75">{flavor}</p>}
        </motion.div>
      )}

      {!result.refunded && (result.top_winner || result.biggest_loser) && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Highlight kind="winner" entry={result.top_winner} />
          <Highlight kind="loser" entry={result.biggest_loser} />
        </div>
      )}

      {roasts.length > 0 && (
        <ul className="space-y-1">
          {roasts.map((name) => (
            <li key={name} className="flex items-start gap-1.5 text-xs text-rose-200/80">
              <FlameIcon className="mt-0.5 size-3.5 shrink-0 text-[var(--color-red-team)]" aria-hidden />
              {allInRoast(name, sessionId)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
