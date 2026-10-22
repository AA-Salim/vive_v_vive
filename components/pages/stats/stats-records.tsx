"use client"

import { motion, useReducedMotion } from "motion/react"
import { CrownIcon, FlameIcon, ShieldIcon, SnowflakeIcon, SparklesIcon, SwordsIcon, TargetIcon, type LucideIcon } from "lucide-react"
import { PlayerAvatar } from "@/components/pages/avatars"
import type { PlayerRef, StatsRecord } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

const RECORD_META: Record<string, { icon: LucideIcon; tone: "royal" | "hype" | "roast" }> = {
  most_wins: { icon: CrownIcon, tone: "royal" },
  best_rate: { icon: TargetIcon, tone: "royal" },
  iron_man: { icon: ShieldIcon, tone: "hype" },
  hot_streak: { icon: FlameIcon, tone: "hype" },
  cold_streak: { icon: SnowflakeIcon, tone: "roast" },
  golden_era: { icon: SwordsIcon, tone: "royal" },
  champion_ocean: { icon: SparklesIcon, tone: "hype" },
}

const TONE: Record<"royal" | "hype" | "roast", string> = {
  royal: "border-[var(--color-gold)]/30 bg-linear-to-br from-[var(--color-gold)]/[0.08] to-transparent text-[var(--color-gold)]",
  hype: "border-emerald-400/20 bg-linear-to-br from-emerald-400/[0.06] to-transparent text-emerald-300",
  roast: "border-rose-400/20 bg-linear-to-br from-rose-400/[0.06] to-transparent text-rose-300",
}

export function StatsRecords({ records, onOpen }: { records: StatsRecord[]; onOpen: (player: PlayerRef) => void }) {
  const reduced = useReducedMotion()
  if (records.length === 0) return null
  return (
    <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" aria-label="Records">
      {records.map((record, index) => {
        const meta = RECORD_META[record.id] ?? { icon: SparklesIcon, tone: "royal" as const }
        const Icon = meta.icon
        return (
          <motion.li
            key={record.id}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: reduced ? 0 : index * 0.04 }}
            className={cn(index === 0 && "col-span-2 lg:col-span-1")}
          >
            <button
              type="button"
              onClick={() => onOpen(record.player)}
              className={cn(
                "flex h-full w-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors outline-none hover:brightness-110 focus-visible:ring-3 focus-visible:ring-ring/50",
                TONE[meta.tone]
              )}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase">
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{record.label}</span>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <PlayerAvatar name={record.player.name} src={record.player.avatarUrl} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-display text-base leading-tight font-semibold text-[var(--color-gold-light)]">
                    {record.player.name}
                  </span>
                  <span className="block text-sm font-semibold tabular-nums">{record.value}</span>
                </span>
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">{record.quip}</span>
            </button>
          </motion.li>
        )
      })}
    </ul>
  )
}
