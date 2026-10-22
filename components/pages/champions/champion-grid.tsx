"use client"

import { motion, useReducedMotion } from "motion/react"
import { LaneIcon } from "@/components/lane-icon"
import { ChampionIcon } from "@/components/pages/avatars"
import { plural } from "@/components/pages/format"
import { WinRateMeter } from "@/components/pages/indicators"
import { ROLE_LABELS } from "@/lib/champions"
import type { ChampionStat } from "@/lib/pages/types"

export function ChampionGrid({ champions }: { champions: ChampionStat[] }) {
  const reduced = useReducedMotion()
  return (
    <ul className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {champions.map((c, i) => (
        <motion.li
          key={c.name}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: reduced ? 0 : Math.min(i, 12) * 0.02 }}
          className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--color-gold)]/12 bg-card p-2.5"
        >
          <ChampionIcon name={c.name} internal={c.internal} size={52} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold text-[var(--color-gold-light)]">{c.name}</p>
              <p className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{plural(c.games, "game")}</p>
            </div>
            <WinRateMeter rate={c.winRate} games={c.games} />
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span className="truncate">
                {c.topPlayer ? (
                  <>
                    Mostly <span className="text-[var(--color-gold-light)]/80">{c.topPlayer.name}</span> ({c.topPlayer.games})
                  </>
                ) : (
                  "Nobody yet"
                )}
              </span>
              <span className="flex shrink-0 items-center gap-0.5" aria-label={`Lanes: ${c.lanes.map((l) => ROLE_LABELS[l.lane]).join(", ")}`}>
                {c.lanes.slice(0, 3).map((l) => (
                  <LaneIcon key={l.lane} lane={l.lane} size={12} className="text-[var(--color-gold)]/60" />
                ))}
              </span>
            </div>
          </div>
        </motion.li>
      ))}
    </ul>
  )
}
