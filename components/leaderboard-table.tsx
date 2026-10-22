"use client"

import { motion, useReducedMotion } from "motion/react"
import { AnimatedNumber } from "@/components/betting/animated-number"
import { RelativeTime } from "@/components/live/relative-time"
import { displayName } from "@/components/leaderboard-podium"
import { PlayerAvatar } from "@/components/pages/avatars"
import { ChangeFlash } from "@/components/pages/change-flash"
import { formatNumber, formatSigned } from "@/components/pages/format"
import { Delta, RankShift, toneOf } from "@/components/pages/indicators"
import { PlayerTitles } from "@/components/titles/player-titles"
import type { LeaderboardEntry, PlayerRef } from "@/lib/pages/types"
import { reasonLabel, reasonMeta } from "@/lib/reasons"
import { cn } from "@/lib/utils"

const COLUMNS = "grid-cols-[2.5rem_minmax(0,1fr)_auto] md:grid-cols-[3rem_minmax(0,1fr)_6.5rem_5.5rem_11rem_8rem]"

function LastMove({ entry }: { entry: LeaderboardEntry }) {
  if (entry.last_change === null || !entry.last_reason) return <span className="text-xs text-muted-foreground">Quiet week</span>
  const Icon = reasonMeta(entry.last_reason).icon
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs">
      <Icon className="size-3.5 shrink-0 text-[var(--color-gold)]/60" aria-hidden />
      <span className={cn("shrink-0 font-semibold tabular-nums", toneOf(entry.last_change))}>{formatSigned(entry.last_change)}</span>
      <span className="truncate text-muted-foreground">
        {reasonLabel(entry.last_reason, entry.last_change)}
        {entry.last_change_at ? (
          <>
            {" · "}
            <RelativeTime at={entry.last_change_at} />
          </>
        ) : null}
      </span>
    </span>
  )
}

export function entryPlayer(entry: LeaderboardEntry): PlayerRef | null {
  return entry.player_id
    ? { id: entry.player_id, name: entry.player_name ?? entry.username, avatarUrl: entry.avatar_url, userId: entry.user_id }
    : null
}

function Row({ entry, reduced, onOpen }: { entry: LeaderboardEntry; reduced: boolean; onOpen: (player: PlayerRef) => void }) {
  const player = entryPlayer(entry)
  const name = displayName(entry)
  const record = entry.wins !== null && entry.losses !== null ? `${entry.wins}W ${entry.losses}L` : null
  return (
    <motion.li layout={!reduced} transition={{ type: "spring", stiffness: 420, damping: 38 }}>
      <ChangeFlash
        value={entry.balance}
        className={cn(
          "grid items-center gap-x-3 rounded-xl border px-2.5 py-2.5 sm:px-3",
          COLUMNS,
          entry.is_current_user
            ? "border-[var(--color-gold)]/45 bg-[var(--color-gold)]/[0.06]"
            : "border-transparent bg-[var(--color-navy-light)]/70 hover:border-[var(--color-gold)]/15"
        )}
      >
        <span className="flex flex-col items-center gap-0.5">
          <span className="font-display text-base font-semibold text-[var(--color-gold-light)]/80 tabular-nums">{entry.rank}</span>
          <RankShift rank={entry.rank} previous={entry.prev_rank} />
        </span>

        <span className="flex min-w-0 items-center gap-2.5">
          <PlayerAvatar name={name} src={entry.avatar_url} size="md" />
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-1.5">
              {player ? (
                <button
                  type="button"
                  onClick={() => onOpen(player)}
                  className="truncate rounded-sm text-left text-sm font-semibold text-[var(--color-gold-light)] outline-none hover:text-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {name}
                </button>
              ) : (
                <span className="truncate text-sm font-semibold text-[var(--color-gold-light)]">{name}</span>
              )}
              {entry.is_current_user ? (
                <span className="shrink-0 rounded-full bg-[var(--color-gold)]/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[var(--color-gold)]">
                  YOU
                </span>
              ) : null}
              {entry.balance < 0 ? (
                <span className="shrink-0 rounded-full bg-rose-400/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-rose-300">
                  IN DEBT
                </span>
              ) : null}
            </span>
            <PlayerTitles userId={entry.user_id} className="mt-0.5" />
            {record ? <span className="block text-[11px] text-muted-foreground tabular-nums md:hidden">{record}</span> : null}
          </span>
        </span>

        <span className="hidden text-sm text-[var(--color-gold-light)]/75 tabular-nums md:block">{record ?? "Spectator"}</span>
        <span className="hidden text-sm text-[var(--color-gold-light)]/75 tabular-nums md:block" title="Hands kissed and praises sung">
          {entry.total_kisses > 0 ? entry.total_kisses : "-"}
        </span>
        <span className="hidden min-w-0 md:block">
          <LastMove entry={entry} />
        </span>

        <span className="flex flex-col items-end gap-0.5 text-right">
          <span className={cn("font-display text-lg leading-none font-semibold text-[var(--color-gold)]", entry.balance < 0 && "text-rose-300")}>
            <AnimatedNumber value={entry.balance} format={formatNumber} />
          </span>
          {entry.delta_24h !== 0 ? (
            <Delta value={entry.delta_24h} suffix=" today" className="text-[11px]" />
          ) : (
            <span className="text-[11px] text-muted-foreground">points</span>
          )}
        </span>
      </ChangeFlash>
    </motion.li>
  )
}

export function LeaderboardTable({ entries, onOpen }: { entries: LeaderboardEntry[]; onOpen: (player: PlayerRef) => void }) {
  const reduced = useReducedMotion() ?? false
  if (entries.length === 0) return null
  return (
    <div>
      <div
        aria-hidden
        className={cn(
          "mb-1.5 hidden gap-x-3 px-3 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase md:grid",
          COLUMNS
        )}
      >
        <span className="text-center">#</span>
        <span>Noble</span>
        <span>Record</span>
        <span>Devotion</span>
        <span>Last move</span>
        <span className="text-right">Treasury</span>
      </div>
      <ol className="space-y-1.5" aria-label="Standings">
        {entries.map((entry) => (
          <Row key={entry.user_id} entry={entry} reduced={reduced} onOpen={onOpen} />
        ))}
      </ol>
    </div>
  )
}
