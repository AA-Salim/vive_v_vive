"use client"

import { ChevronRightIcon, SwordsIcon } from "lucide-react"
import { PlayerAvatar } from "@/components/pages/avatars"
import { RelativeTime } from "@/components/live/relative-time"
import { WinRateMeter } from "@/components/pages/indicators"
import type { Feud } from "@/components/pages/rivalries/rivalry-math"
import { FEUD_RULES } from "@/lib/pages/constants"
import type { PlayerRef } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

const rate = (f: Feud) => (f.games > 0 ? Math.round((f.wins / f.games) * 1000) / 10 : 0)

function verdict(f: Feud): { text: string; tone: string } {
  if (f.games < FEUD_RULES.metGames) return { text: "Barely met", tone: "text-muted-foreground" }
  const diff = f.wins - f.losses
  if (diff >= FEUD_RULES.ownMargin && f.wins >= 2 * f.losses) return { text: "Owns him", tone: "text-emerald-300" }
  if (diff <= -FEUD_RULES.ownMargin && f.losses >= 2 * f.wins) return { text: "Owned", tone: "text-rose-300" }
  if (diff > 0) return { text: "Has the edge", tone: "text-emerald-300/80" }
  if (diff < 0) return { text: "Trailing", tone: "text-rose-300/80" }
  return { text: "Dead level", tone: "text-[var(--color-gold)]" }
}

interface FeudListProps {
  feuds: Feud[]
  players: Map<string, PlayerRef>
  onOpen: (opponent: string) => void
}

export function FeudList({ feuds, players, onOpen }: FeudListProps) {
  return (
    <ol className="space-y-1.5">
      {feuds.map((feud) => {
        const opponent = players.get(feud.opponent)
        if (!opponent) return null
        const v = verdict(feud)
        return (
          <li key={feud.opponent}>
            <button
              type="button"
              onClick={() => onOpen(feud.opponent)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl border border-transparent bg-[var(--color-navy-light)]/70 px-3 py-2.5 text-left transition-colors outline-none hover:border-[var(--color-gold)]/20 focus-visible:ring-3 focus-visible:ring-ring/50 md:grid-cols-[minmax(0,1fr)_7rem_9rem_7.5rem_1rem]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <PlayerAvatar name={opponent.name} src={opponent.avatarUrl} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--color-gold-light)]">{opponent.name}</span>
                  <span className={cn("block text-xs", v.tone)}>{v.text}</span>
                </span>
              </span>
              <span className="text-right font-display text-lg font-semibold tabular-nums md:text-left">
                <span className="text-emerald-300">{feud.wins}</span>
                <span className="mx-1 text-muted-foreground">-</span>
                <span className="text-rose-300">{feud.losses}</span>
              </span>
              <span className="col-span-2 flex items-center justify-between gap-3 md:col-span-1 md:block">
                <WinRateMeter rate={rate(feud)} games={feud.games} />
                <span className="text-[11px] text-muted-foreground md:hidden">
                  {feud.laneDuels > 0 ? `Lane ${feud.laneWins}-${feud.laneLosses}` : "Never in lane"} · <RelativeTime at={feud.lastPlayedAt} />
                </span>
              </span>
              <span className="hidden text-xs text-muted-foreground md:block">
                {feud.laneDuels > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <SwordsIcon className="size-3 text-[var(--color-gold)]/70" aria-hidden />
                    Lane {feud.laneWins}-{feud.laneLosses}
                  </span>
                ) : (
                  "Never in lane"
                )}
              </span>
              <ChevronRightIcon className="hidden size-4 text-muted-foreground md:block" aria-hidden />
            </button>
          </li>
        )
      })}
    </ol>
  )
}
