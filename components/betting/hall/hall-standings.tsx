"use client"

import { CrownIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { outcomeTone } from "@/components/betting/payout-preview"
import { formatSigned } from "@/lib/betting/math"
import type { HallStanding } from "@/lib/betting/types"
import { cn } from "@/lib/utils"

const PODIUM = ["text-[var(--color-gold)]", "text-[var(--color-gold-light)]/80", "text-[var(--color-gold-dark)]"]

export function HallStandings({ standings, viewerId }: { standings: HallStanding[]; viewerId: string | null }) {
  return (
    <section aria-labelledby="hall-standings-title" className="rounded-2xl border border-[var(--color-gold)]/15 bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="hall-standings-title" className="font-display text-base font-semibold text-[var(--color-gold)]">
          The Ledger
        </h2>
        <span className="text-[11px] text-muted-foreground">Net profit from wagers</span>
      </div>
      <ol className="space-y-1">
        {standings.map((s, i) => {
          const decided = s.won + s.lost
          const rate = decided > 0 ? Math.round((s.won / decided) * 100) : null
          return (
            <li
              key={s.user_id}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2 py-2",
                i < 3 ? "bg-[var(--color-gold)]/[0.05]" : "",
                s.user_id === viewerId && "ring-1 ring-[var(--color-gold)]/40"
              )}
            >
              <span className={cn("w-6 shrink-0 text-center font-display text-sm font-semibold tabular-nums", PODIUM[i] ?? "text-muted-foreground")}>
                {i === 0 ? (
                  <>
                    <CrownIcon className="mx-auto size-4" aria-hidden />
                    <span className="sr-only">1</span>
                  </>
                ) : (
                  i + 1
                )}
              </span>
              <Avatar size="sm" className="shrink-0">
                {s.avatar_url && <AvatarImage src={s.avatar_url} alt="" />}
                <AvatarFallback className="bg-[var(--color-navy-lighter)] text-[10px] font-semibold text-[var(--color-gold)]">
                  {s.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[var(--color-gold-light)]">{s.name}</div>
                <div className="text-[11px] tabular-nums text-muted-foreground">
                  {s.won}-{s.lost}
                  {rate != null && ` · ${rate}%`} · {s.bets} {s.bets === 1 ? "bet" : "bets"}
                  {s.best_win > 0 && <span className="hidden sm:inline"> · best {formatSigned(s.best_win)}</span>}
                </div>
              </div>
              <span className={cn("shrink-0 font-display text-base font-semibold tabular-nums", outcomeTone(s.net))}>
                {formatSigned(s.net)}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
