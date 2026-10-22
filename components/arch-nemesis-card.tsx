"use client"

import { ArrowRightIcon, SwordsIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { PlayerAvatar } from "@/components/pages/avatars"
import { formatShortDay, plural } from "@/components/pages/format"
import { InfoTip } from "@/components/ui/info-tip"
import type { HelpEntry } from "@/lib/help"
import type { PlayerRef, Rivalry } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

interface ArchNemesisCardProps {
  rivalry: Rivalry
  a: PlayerRef
  b: PlayerRef
  onOpen: () => void
  help?: HelpEntry
}

function quip(r: Rivalry, a: PlayerRef, b: PlayerRef): string {
  if (r.aLaneWins === r.bLaneWins) return `${plural(r.laneDuels, "lane duel")} and still level. The Rift demands a tiebreaker.`
  const [winner, loser] = r.aLaneWins > r.bLaneWins ? [a, b] : [b, a]
  return `${plural(r.laneDuels, "lane duel")}. ${winner.name} sleeps well. ${loser.name} has a notebook now.`
}

export function ArchNemesisCard({ rivalry, a, b, onOpen, help }: ArchNemesisCardProps) {
  const reduced = useReducedMotion()
  const aLeads = rivalry.aLaneWins > rivalry.bLaneWins
  const bLeads = rivalry.bLaneWins > rivalry.aLaneWins

  return (
    <section
      aria-labelledby="arch-nemesis-title"
      className="relative overflow-hidden rounded-2xl border border-[var(--color-gold)]/30 bg-card shadow-2xl shadow-black/30"
    >
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-linear-to-r from-[var(--color-blue-team)]/12 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-linear-to-l from-[var(--color-red-team)]/12 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/80 to-transparent" />
      <div className="relative flex flex-col items-center gap-4 px-4 py-6 text-center sm:px-8">
        <div className="flex items-center gap-1.5">
          <h2 id="arch-nemesis-title" className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.3em] text-[var(--color-gold)] uppercase">
            <SwordsIcon className="size-3.5" aria-hidden />
            Arch-nemesis
          </h2>
          {help ? <InfoTip help={help} side="bottom" /> : null}
        </div>

        <div className="grid w-full max-w-xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
          {[
            { player: a, wins: rivalry.aLaneWins, leads: aLeads, side: "blue" as const },
            { player: b, wins: rivalry.bLaneWins, leads: bLeads, side: "red" as const },
          ].map((entry, i) => (
            <motion.div
              key={entry.player.id}
              initial={reduced ? false : { opacity: 0, x: i === 0 ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={cn("flex min-w-0 flex-col items-center gap-2", i === 1 && "order-3")}
            >
              <PlayerAvatar name={entry.player.name} src={entry.player.avatarUrl} size="xl" ring={entry.side} className="size-16 sm:size-20" />
              <p className="w-full truncate font-display text-lg font-semibold text-[var(--color-gold-light)] sm:text-xl">{entry.player.name}</p>
              <p
                className={cn(
                  "font-display text-4xl leading-none font-semibold tabular-nums sm:text-5xl",
                  entry.leads ? "text-[var(--color-gold)]" : "text-[var(--color-gold-light)]/60"
                )}
              >
                {entry.wins}
              </p>
            </motion.div>
          ))}
          <div className="order-2 flex flex-col items-center gap-1">
            <span className="font-display text-2xl font-semibold text-[var(--color-gold)] sm:text-3xl">VS</span>
            <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">lane wins</span>
          </div>
        </div>

        <p className="max-w-md text-sm text-[var(--color-gold-light)]/75">{quip(rivalry, a, b)}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          Overall {rivalry.aWins}-{rivalry.bWins} in {plural(rivalry.games, "game")} · last clash {formatShortDay(rivalry.lastPlayedAt)}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--color-gold)]/30 px-4 text-sm font-medium text-[var(--color-gold-light)] transition-colors outline-none hover:bg-[var(--color-gold)]/10 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Open the feud file
          <ArrowRightIcon className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  )
}
