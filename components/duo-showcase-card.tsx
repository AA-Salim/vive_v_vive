"use client"

import { motion, useReducedMotion } from "motion/react"
import { CrownIcon } from "lucide-react"
import { PlayerAvatar } from "@/components/pages/avatars"
import { plural } from "@/components/pages/format"
import { WinRateMeter } from "@/components/pages/indicators"
import type { Duo, PlayerRef } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

interface DuoShowcaseCardProps {
  duo: Duo
  a: PlayerRef
  b: PlayerRef
  rank: number
  onOpen?: () => void
}

export function DuoShowcaseCard({ duo, a, b, rank, onOpen }: DuoShowcaseCardProps) {
  const reduced = useReducedMotion()
  const first = rank === 1
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: reduced ? 0 : (rank - 1) * 0.08 }}
      className={cn(
        "relative flex h-full w-full flex-col items-center gap-3 overflow-hidden rounded-2xl border p-5 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        first
          ? "border-[var(--color-gold)]/60 bg-linear-to-b from-[var(--color-gold)]/[0.12] to-card shadow-[0_0_40px_-12px_var(--color-gold)]"
          : "border-[var(--color-gold)]/20 bg-card"
      )}
    >
      <span className="absolute top-3 left-3 font-display text-sm font-semibold text-muted-foreground">#{rank}</span>
      {first ? <CrownIcon className="absolute top-3 right-3 size-4 text-[var(--color-gold)]" aria-hidden /> : null}
      <span className="flex items-center -space-x-3">
        <PlayerAvatar name={a.name} src={a.avatarUrl} size="lg" className="ring-2 ring-card" />
        <PlayerAvatar name={b.name} src={b.avatarUrl} size="lg" className="ring-2 ring-card" />
      </span>
      <span className="text-sm font-semibold text-[var(--color-gold-light)]">
        {a.name} <span className="text-muted-foreground">&amp;</span> {b.name}
      </span>
      {duo.headline ? (
        <span className="space-y-1">
          <span className={cn("block font-display font-semibold tracking-wide text-[var(--color-gold)]", first ? "text-2xl" : "text-xl")}>
            {duo.headline.label}
          </span>
          <span className="block text-sm leading-snug text-[var(--color-gold-light)]/75">{duo.headline.text}</span>
        </span>
      ) : null}
      <span className="mt-auto flex flex-col items-center gap-1.5">
        <span className="text-xs text-muted-foreground tabular-nums">
          <span className="text-emerald-300">{duo.wins}W</span> <span className="text-rose-300">{duo.losses}L</span> · {plural(duo.games, "game")} together
        </span>
        <WinRateMeter rate={duo.winRate} games={duo.games} />
      </span>
    </motion.button>
  )
}
