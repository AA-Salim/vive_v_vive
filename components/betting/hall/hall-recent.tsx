"use client"

import { useState } from "react"
import { FlameIcon, ShieldCheckIcon, ZapIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { InfoTip } from "@/components/ui/info-tip"
import { timeAgo } from "@/components/betting/hall/use-hall"
import { outcomeTone } from "@/components/betting/payout-preview"
import { RECENT_HELP } from "@/lib/betting/help"
import { formatSigned, sideLabel } from "@/lib/betting/math"
import type { HallRecentBet } from "@/lib/betting/types"
import { cn } from "@/lib/utils"

export function HallRecent({ bets }: { bets: HallRecentBet[] }) {
  const [now] = useState(() => Date.now())
  return (
    <section aria-labelledby="hall-recent-title" className="rounded-2xl border border-[var(--color-gold)]/15 bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <h2 id="hall-recent-title" className="font-display text-base font-semibold text-[var(--color-gold)]">
            {RECENT_HELP.title}
          </h2>
          <InfoTip help={RECENT_HELP} align="start" />
        </div>
        <span className="text-right text-[11px] text-muted-foreground">Latest settled wagers</span>
      </div>
      <ul className="space-y-1">
        {bets.map((bet) => {
          const sideColor = bet.side === "blue" ? "var(--color-blue-team)" : "var(--color-red-team)"
          return (
            <li key={bet.bet_id} className="flex items-center gap-2.5 rounded-lg border-l-[3px] bg-[var(--color-navy)]/40 px-2.5 py-2" style={{ borderLeftColor: sideColor }}>
              <Avatar size="sm" className="shrink-0">
                {bet.avatar_url && <AvatarImage src={bet.avatar_url} alt="" />}
                <AvatarFallback className="bg-[var(--color-navy-lighter)] text-[10px] font-semibold text-[var(--color-gold)]">
                  {bet.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-[var(--color-gold-light)]">{bet.name}</span>
                  {bet.insured && (
                    <>
                      <ShieldCheckIcon className="size-3.5 shrink-0 text-emerald-300" aria-hidden />
                      <span className="sr-only">Insured</span>
                    </>
                  )}
                  {bet.all_in && (
                    <>
                      <FlameIcon className="size-3.5 shrink-0 text-[var(--color-red-team)]" aria-hidden />
                      <span className="sr-only">All-in</span>
                    </>
                  )}
                  {bet.early && (
                    <>
                      <ZapIcon className="size-3.5 shrink-0 text-[var(--color-gold)]" aria-hidden />
                      <span className="sr-only">Early conviction</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  <span style={{ color: sideColor }}>
                    {bet.amount} on {sideLabel(bet.side)}
                  </span>{" "}
                  · {timeAgo(bet.at, now)}
                </div>
              </div>
              <span className={cn("shrink-0 text-sm font-semibold tabular-nums", bet.status === "refunded" ? "text-muted-foreground" : outcomeTone(bet.net))}>
                {bet.status === "refunded" ? "refunded" : formatSigned(bet.net)}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
