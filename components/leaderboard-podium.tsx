"use client"

import Image from "next/image"

interface PodiumEntry {
  rank: number
  username: string
  avatar_url: string | null
  player_name: string | null
  balance: number
}

interface LeaderboardPodiumProps {
  entries: PodiumEntry[]
}

const RANK_CONFIG = {
  1: {
    order: "order-2",
    height: "h-36",
    border: "border-[var(--color-gold)] shadow-[0_0_20px_rgba(200,155,60,0.3)]",
    label: "1st",
    balanceSize: "text-3xl",
  },
  2: {
    order: "order-1",
    height: "h-28",
    border: "border-gray-400/40",
    label: "2nd",
    balanceSize: "text-2xl",
  },
  3: {
    order: "order-3",
    height: "h-24",
    border: "border-amber-700/40",
    label: "3rd",
    balanceSize: "text-2xl",
  },
} as const

export function LeaderboardPodium({ entries }: LeaderboardPodiumProps) {
  if (entries.length === 0) return null

  return (
    <div className="flex items-end justify-center gap-4">
      {entries.slice(0, 3).map((entry) => {
        const config = RANK_CONFIG[entry.rank as 1 | 2 | 3]
        if (!config) return null

        return (
          <div
            key={entry.rank}
            className={`${config.order} flex w-40 flex-col items-center`}
          >
            <div className="mb-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--color-gold)]/30 bg-[var(--color-navy)]">
              {entry.avatar_url ? (
                <Image
                  src={entry.avatar_url}
                  alt={entry.username}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-[var(--color-gold)]">
                  {entry.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div
              className={`${config.height} w-full rounded-t-lg border-t-2 ${config.border} flex flex-col items-center justify-center bg-[var(--color-navy-light)] px-3`}
            >
              <div className="text-xs font-bold tracking-wider text-[var(--color-gold-light)]/50">
                {config.label}
              </div>
              <div className="mt-1 max-w-full truncate text-sm font-bold text-[var(--color-gold-light)]">
                {entry.player_name ?? entry.username}
              </div>
              <div
                className={`${config.balanceSize} font-bold text-[var(--color-gold)]`}
              >
                {entry.balance}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
