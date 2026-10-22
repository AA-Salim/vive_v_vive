"use client"

import { motion, useReducedMotion } from "motion/react"
import { CrownIcon, SkullIcon } from "lucide-react"
import { verdictLine } from "@/lib/duels/copy"
import type { DuelView } from "@/lib/duels/types"
import { cn } from "@/lib/utils"

interface VerdictSummaryProps {
  duels: DuelView[]
  viewerId: string
}

// The viewer's own reckoning once the Nexus fell: wins, losses and the net, in one line.
export function VerdictSummary({ duels, viewerId }: VerdictSummaryProps) {
  const reduceMotion = useReducedMotion() ?? false
  const fought = duels.filter(
    (d) => (d.status === "won" || d.status === "lost") && (d.challenger.userId === viewerId || d.opponent?.userId === viewerId)
  )
  if (fought.length === 0) return null

  const won = fought.filter((d) => d.winnerId === viewerId)
  const lost = fought.filter((d) => d.winnerId !== viewerId)
  const net =
    won.reduce((sum, d) => sum + (d.payout ?? d.stake * 2) - d.stake, 0) - lost.reduce((sum, d) => sum + d.stake, 0)
  const victorious = net >= 0 && won.length > 0
  const rivals = (list: DuelView[]) =>
    list.map((d) => (d.challenger.userId === viewerId ? d.opponent?.name : d.challenger.name) ?? "Someone").join(", ")

  const headline =
    lost.length === 0
      ? `You won ${won.length === 1 ? `your duel against ${rivals(won)}` : `all ${won.length} duels`}`
      : won.length === 0
        ? `You lost ${lost.length === 1 ? `to ${rivals(lost)}` : `all ${lost.length} duels`}`
        : `${won.length} won, ${lost.length} lost`

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-3",
        victorious
          ? "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/10 shadow-[0_0_28px_-14px_var(--color-gold)]"
          : "border-[var(--color-red-team)]/35 bg-[var(--color-red-team)]/8"
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full",
          victorious ? "bg-[var(--color-gold)] text-[var(--color-navy)]" : "bg-[var(--color-red-team)]/20 text-[var(--color-red-team)]"
        )}
      >
        {victorious ? <CrownIcon className="size-5" aria-hidden /> : <SkullIcon className="size-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug break-words text-foreground">{headline}</p>
        <p className="text-xs leading-snug text-muted-foreground">{verdictLine(victorious, fought[0].id)}</p>
      </div>
      <span
        className={cn(
          "shrink-0 font-display text-lg font-semibold tabular-nums",
          net >= 0 ? "text-[var(--color-gold)]" : "text-[var(--color-red-team)]"
        )}
      >
        {net >= 0 ? `+${net}` : `−${Math.abs(net)}`}
      </span>
    </motion.div>
  )
}
