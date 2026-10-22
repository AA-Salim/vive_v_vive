"use client"

import { CrownIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { AnimatedNumber } from "@/components/betting/animated-number"
import { PlayerAvatar } from "@/components/pages/avatars"
import { ChangeFlash } from "@/components/pages/change-flash"
import { formatNumber } from "@/components/pages/format"
import { Delta, RankShift } from "@/components/pages/indicators"
import { PlayerTitles } from "@/components/titles/player-titles"
import type { LeaderboardEntry, PlayerRef } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

const PLACES = [
  {
    label: "1st",
    order: "order-2",
    ring: "gold",
    step: "min-h-32 sm:min-h-40 border-[var(--color-gold)]/60 bg-linear-to-b from-[var(--color-gold)]/20 via-[var(--color-gold)]/[0.06] to-transparent",
    balance: "text-2xl sm:text-4xl text-[var(--color-gold)]",
    avatar: "xl",
  },
  {
    label: "2nd",
    order: "order-1",
    ring: "silver",
    step: "min-h-24 sm:min-h-32 border-[var(--color-gold-light)]/30 bg-linear-to-b from-[var(--color-gold-light)]/10 to-transparent",
    balance: "text-xl sm:text-3xl text-[var(--color-gold-light)]",
    avatar: "lg",
  },
  {
    label: "3rd",
    order: "order-3",
    ring: "bronze",
    step: "min-h-20 sm:min-h-28 border-[var(--color-gold-dark)]/70 bg-linear-to-b from-[var(--color-gold-dark)]/25 to-transparent",
    balance: "text-xl sm:text-3xl text-[var(--color-gold-light)]/90",
    avatar: "lg",
  },
] as const

export const displayName = (entry: Pick<LeaderboardEntry, "player_name" | "username">) => entry.player_name ?? entry.username

export function LeaderboardPodium({ entries, onOpen }: { entries: LeaderboardEntry[]; onOpen: (player: PlayerRef) => void }) {
  const reduced = useReducedMotion()
  if (entries.length === 0) return null

  return (
    <ol aria-label="The podium" className="grid grid-cols-3 items-end gap-2 sm:gap-5">
      {entries.slice(0, 3).map((entry, index) => {
        const place = PLACES[index]
        const name = displayName(entry)
        return (
          <motion.li
            key={entry.user_id}
            layout={!reduced}
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: reduced ? 0 : [0.15, 0, 0.3][index] }}
            className={cn("flex min-w-0 flex-col items-center text-center", place.order)}
          >
            <div className="relative mb-2">
              {index === 0 ? (
                <CrownIcon
                  aria-hidden
                  className="absolute -top-6 left-1/2 size-6 -translate-x-1/2 text-[var(--color-gold)] drop-shadow-[0_0_10px_var(--color-gold)] sm:-top-7 sm:size-7"
                />
              ) : null}
              <PlayerAvatar
                name={name}
                src={entry.avatar_url}
                size={place.avatar}
                ring={place.ring}
                className={cn(index === 0 && "size-16 sm:size-20", index > 0 && "size-12 sm:size-14")}
              />
            </div>
            {entry.player_id ? (
              <button
                type="button"
                onClick={() => onOpen({ id: entry.player_id as string, name, avatarUrl: entry.avatar_url, userId: entry.user_id })}
                className="w-full truncate rounded-sm font-display text-sm font-semibold text-[var(--color-gold-light)] outline-none hover:text-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-ring/50 sm:text-base"
              >
                {name}
                {entry.is_current_user ? <span className="sr-only"> (you)</span> : null}
              </button>
            ) : (
              <p className="w-full truncate font-display text-sm font-semibold text-[var(--color-gold-light)] sm:text-base">
                {name}
                {entry.is_current_user ? <span className="sr-only"> (you)</span> : null}
              </p>
            )}
            {entry.player_name && entry.player_name !== entry.username ? (
              <p className="hidden w-full truncate text-[11px] text-muted-foreground sm:block">@{entry.username}</p>
            ) : null}
            <PlayerTitles userId={entry.user_id} className="mt-1 hidden max-w-full justify-center sm:flex" />
            <ChangeFlash
              value={entry.balance}
              className={cn(
                "mt-2 flex w-full flex-col items-center justify-start gap-0.5 rounded-t-xl border border-b-0 px-1.5 pt-2.5 pb-2 sm:pt-4",
                place.step,
                entry.is_current_user && "ring-1 ring-[var(--color-gold)]/50"
              )}
            >
              <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">{place.label}</span>
              <span className={cn("font-display leading-none font-semibold", place.balance, entry.balance < 0 && "text-rose-300")}>
                <AnimatedNumber value={entry.balance} format={formatNumber} />
              </span>
              <span className="text-[10px] tracking-wider text-muted-foreground uppercase">points</span>
              <span className="mt-1 flex flex-wrap items-center justify-center gap-x-1.5 text-[11px]">
                {entry.delta_24h !== 0 ? <Delta value={entry.delta_24h} suffix=" today" /> : null}
                <RankShift rank={entry.rank} previous={entry.prev_rank} />
              </span>
            </ChangeFlash>
          </motion.li>
        )
      })}
    </ol>
  )
}
