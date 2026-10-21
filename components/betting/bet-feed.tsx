"use client"

import { memo } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BetTags } from "@/components/betting/bet-tags"
import { outcomeTone } from "@/components/betting/payout-preview"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import { MARKET_COPY } from "@/lib/betting/copy"
import { formatSigned, sideLabel } from "@/lib/betting/math"
import type { MarketBet } from "@/lib/betting/types"
import { cn } from "@/lib/utils"

interface BetFeedProps {
  bets: MarketBet[]
  viewerId: string | null
  open: boolean
}

function Outcome({ bet }: { bet: MarketBet }) {
  if (bet.status === "pending" || bet.net == null) return null
  if (bet.status === "refunded") return <span className="text-[11px] text-muted-foreground">refunded</span>
  return (
    <span className={cn("text-xs font-semibold tabular-nums", outcomeTone(bet.net))}>
      <span className="sr-only">{bet.status === "won" ? "won" : "lost"} </span>
      {formatSigned(bet.net)}
    </span>
  )
}

export const BetFeed = memo(function BetFeed({ bets, viewerId, open }: BetFeedProps) {
  const reduced = useReducedMotion()
  const { byUserId } = useEquippedTitles()

  return (
    <section aria-label="Bets placed" className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]/80">The notebook</h4>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {bets.length} {bets.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {bets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
          {open ? MARKET_COPY.emptyOpen : MARKET_COPY.emptyClosed}
        </p>
      ) : (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {bets.map((bet) => {
              const mine = bet.user_id === viewerId
              const title = byUserId.get(bet.user_id)?.title
              const sideColor = bet.side === "blue" ? "var(--color-blue-team)" : "var(--color-red-team)"
              return (
                <motion.li
                  key={bet.id}
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduced ? undefined : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border border-l-[3px] bg-[var(--color-navy)]/45 px-2.5 py-2",
                    bet.whale ? "border-[var(--color-gold)]/45 shadow-[0_0_18px_-8px_var(--color-gold)]" : "border-border",
                    mine && "bg-[var(--color-gold)]/[0.06]"
                  )}
                  style={{ borderLeftColor: sideColor }}
                >
                  <Avatar size="sm" className="shrink-0">
                    {bet.discord_avatar_url && <AvatarImage src={bet.discord_avatar_url} alt="" />}
                    <AvatarFallback className="bg-[var(--color-navy-lighter)] text-[10px] font-semibold text-[var(--color-gold)]">
                      {bet.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-[var(--color-gold-light)]">{bet.name}</span>
                      {mine && <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-gold)]">You</span>}
                    </div>
                    {title && <div className="truncate text-[10px] italic text-muted-foreground">{title}</div>}
                    <div className="mt-0.5 sm:hidden">
                      <BetTags bet={bet} compact />
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <BetTags bet={bet} compact />
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="flex items-baseline gap-1" style={{ color: sideColor }}>
                      <span className="text-sm font-semibold tabular-nums">{bet.amount}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider">{sideLabel(bet.side)}</span>
                    </span>
                    <Outcome bet={bet} />
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  )
})
