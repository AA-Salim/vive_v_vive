"use client"

import { PlayerAvatar } from "@/components/pages/avatars"
import { WinRateMeter } from "@/components/pages/indicators"
import type { BadgeTone, Duo, DuoBadge, PlayerRef } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

const BADGE_TONE: Record<BadgeTone, string> = {
  royal: "bg-[var(--color-gold)]/12 text-[var(--color-gold)] ring-[var(--color-gold)]/30",
  hype: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25",
  roast: "bg-rose-400/10 text-rose-300 ring-rose-400/25",
}

export function DuoBadgeChip({ badge, className }: { badge: DuoBadge; className?: string }) {
  return (
    <span
      title={badge.text}
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-bold tracking-wide whitespace-nowrap ring-1",
        BADGE_TONE[badge.tone],
        className
      )}
    >
      {badge.label}
    </span>
  )
}

const allBadges = (duo: Duo) => [...(duo.headline ? [duo.headline] : []), ...duo.badges]

interface DuoListProps {
  duos: Duo[]
  players: Map<string, PlayerRef>
  onOpen: (duo: Duo) => void
  startRank?: number
}

function Pair({ a, b }: { a: PlayerRef; b: PlayerRef }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="flex shrink-0 -space-x-2">
        <PlayerAvatar name={a.name} src={a.avatarUrl} size="sm" className="ring-2 ring-card" />
        <PlayerAvatar name={b.name} src={b.avatarUrl} size="sm" className="ring-2 ring-card" />
      </span>
      <span className="min-w-0 truncate text-sm font-semibold text-[var(--color-gold-light)]">
        {a.name} <span className="font-normal text-muted-foreground">&amp;</span> {b.name}
      </span>
    </span>
  )
}

export function DuoList({ duos, players, onOpen, startRank = 1 }: DuoListProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-[var(--color-gold)]/15 bg-card md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Duos and their record together</caption>
          <thead>
            <tr className="border-b border-[var(--color-gold)]/10 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              <th scope="col" className="w-10 px-3 py-2.5 text-center font-semibold">
                #
              </th>
              <th scope="col" className="px-2 py-2.5 text-left font-semibold">
                Duo
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Games
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                W
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                L
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                Together
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                Honors
              </th>
            </tr>
          </thead>
          <tbody>
            {duos.map((duo, i) => {
              const a = players.get(duo.a)
              const b = players.get(duo.b)
              if (!a || !b) return null
              return (
                <tr key={`${duo.a}:${duo.b}`} className="border-b border-[var(--color-gold)]/[0.06] transition-colors last:border-0 hover:bg-[var(--color-gold)]/[0.03]">
                  <td className="px-3 py-2 text-center font-display font-semibold text-muted-foreground tabular-nums">{startRank + i}</td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => onOpen(duo)} className="max-w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                      <Pair a={a} b={b} />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--color-gold-light)]/80 tabular-nums">{duo.games}</td>
                  <td className="px-3 py-2 text-right text-emerald-300 tabular-nums">{duo.wins}</td>
                  <td className="px-3 py-2 text-right text-rose-300 tabular-nums">{duo.losses}</td>
                  <td className="px-3 py-2">
                    <WinRateMeter rate={duo.winRate} games={duo.games} />
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {allBadges(duo).map((badge) => (
                        <DuoBadgeChip key={badge.id} badge={badge} />
                      ))}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ol className="space-y-2 md:hidden" aria-label="Duos">
        {duos.map((duo, i) => {
          const a = players.get(duo.a)
          const b = players.get(duo.b)
          if (!a || !b) return null
          const badges = allBadges(duo)
          return (
            <li key={`${duo.a}:${duo.b}`}>
              <button
                type="button"
                onClick={() => onOpen(duo)}
                className="flex w-full flex-col gap-2 rounded-2xl border border-[var(--color-gold)]/12 bg-card p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex w-full items-center gap-2">
                  <span className="w-5 shrink-0 text-center font-display text-sm font-semibold text-muted-foreground tabular-nums">{startRank + i}</span>
                  <Pair a={a} b={b} />
                </span>
                <span className="flex w-full items-center justify-between gap-2 pl-7">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    <span className="text-emerald-300">{duo.wins}W</span> <span className="text-rose-300">{duo.losses}L</span> · {duo.games} games
                  </span>
                  <WinRateMeter rate={duo.winRate} games={duo.games} />
                </span>
                {badges.length > 0 ? (
                  <span className="flex flex-wrap gap-1 pl-7">
                    {badges.map((badge) => (
                      <DuoBadgeChip key={badge.id} badge={badge} />
                    ))}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
    </>
  )
}
