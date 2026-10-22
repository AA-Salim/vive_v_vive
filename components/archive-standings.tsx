"use client"

import { useState } from "react"
import { ChevronDownIcon, CrownIcon } from "lucide-react"
import { PlayerAvatar } from "@/components/pages/avatars"
import { formatNumber, formatPercent } from "@/components/pages/format"
import { Button } from "@/components/ui/button"
import type { ArchiveStanding } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

const VISIBLE = 12

function Rank({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="grid place-items-center text-[var(--color-gold)]">
        <CrownIcon className="size-4" aria-hidden />
        <span className="sr-only">1</span>
      </span>
    )
  }
  return <span className="font-display font-semibold text-muted-foreground tabular-nums">{rank || "-"}</span>
}

export function ArchiveStandings({ standings }: { standings: ArchiveStanding[] }) {
  const [all, setAll] = useState(false)
  if (standings.length === 0) return null
  const shown = all ? standings : standings.slice(0, VISIBLE)

  return (
    <div className="space-y-2">
      <div className="hidden overflow-hidden rounded-2xl border border-[var(--color-gold)]/15 bg-card md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Final standings of the act</caption>
          <thead>
            <tr className="border-b border-[var(--color-gold)]/10 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              <th scope="col" className="w-12 px-3 py-2.5 text-center font-semibold">
                #
              </th>
              <th scope="col" className="px-2 py-2.5 text-left font-semibold">
                Noble
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Treasury
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Earned
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Spent
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Games
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Win rate
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Bets
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Devotion
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.userId} className={cn("border-b border-[var(--color-gold)]/[0.06] last:border-0", s.rank === 1 && "bg-[var(--color-gold)]/[0.05]")}>
                <td className="px-3 py-2 text-center">
                  <Rank rank={s.rank} />
                </td>
                <td className="px-2 py-2">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <PlayerAvatar name={s.name} src={s.avatarUrl} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-[var(--color-gold-light)]">{s.name}</span>
                      {s.username && s.username !== s.name ? <span className="block truncate text-[11px] text-muted-foreground">@{s.username}</span> : null}
                    </span>
                  </span>
                </td>
                <td className={cn("px-3 py-2 text-right font-display font-semibold tabular-nums", s.balance < 0 ? "text-rose-300" : "text-[var(--color-gold)]")}>
                  {formatNumber(s.balance)}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", s.earned > 0 ? "text-emerald-300/90" : "text-muted-foreground")}>
                  {s.earned > 0 ? `+${formatNumber(s.earned)}` : "0"}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums", s.spent > 0 ? "text-rose-300/90" : "text-muted-foreground")}>
                  {s.spent > 0 ? `-${formatNumber(s.spent)}` : "0"}
                </td>
                <td className="px-3 py-2 text-right text-[var(--color-gold-light)]/75 tabular-nums">{s.games}</td>
                <td className="px-3 py-2 text-right text-[var(--color-gold-light)]/75 tabular-nums">{s.winRate !== null ? formatPercent(s.winRate) : "-"}</td>
                <td className="px-3 py-2 text-right text-[var(--color-gold-light)]/75 tabular-nums">{s.bets}</td>
                <td className="px-3 py-2 text-right text-[var(--color-gold-light)]/75 tabular-nums">{s.devotion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol className="space-y-1.5 md:hidden" aria-label="Final standings">
        {shown.map((s) => (
          <li
            key={s.userId}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-2.5 py-2",
              s.rank === 1 ? "border-[var(--color-gold)]/40 bg-[var(--color-gold)]/[0.06]" : "border-transparent bg-[var(--color-navy-light)]/70"
            )}
          >
            <span className="w-6 shrink-0 text-center">
              <Rank rank={s.rank} />
            </span>
            <PlayerAvatar name={s.name} src={s.avatarUrl} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[var(--color-gold-light)]">{s.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground tabular-nums">
                {s.games} games{s.winRate !== null ? ` · ${formatPercent(s.winRate)}` : ""} · {s.bets} bets · {s.devotion} devotion
              </span>
            </span>
            <span className={cn("shrink-0 font-display text-base font-semibold tabular-nums", s.balance < 0 ? "text-rose-300" : "text-[var(--color-gold)]")}>
              {formatNumber(s.balance)}
            </span>
          </li>
        ))}
      </ol>

      {standings.length > VISIBLE ? (
        <Button variant="outline" className="h-10 w-full" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          <ChevronDownIcon className={cn("transition-transform", all && "rotate-180")} aria-hidden />
          {all ? "Show the top only" : `Show all ${standings.length} nobles`}
        </Button>
      ) : null}
    </div>
  )
}
