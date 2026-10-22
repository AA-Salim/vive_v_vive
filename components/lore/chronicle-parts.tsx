"use client"

import type { ReactNode } from "react"
import {
  BookOpenIcon,
  CoinsIcon,
  CrownIcon,
  FlameIcon,
  GavelIcon,
  LandmarkIcon,
  type LucideIcon,
  ScrollTextIcon,
  SkullIcon,
  SwordsIcon,
  TrophyIcon,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { ChronicleGame, ChronicleKind, ChronicleStats } from "@/lib/lore/chronicle/types"
import { cn } from "@/lib/utils"

export const ENTRY_META: Record<ChronicleKind, { icon: LucideIcon; label: string; tone: string }> = {
  opening: { icon: SwordsIcon, label: "The night", tone: "text-[var(--color-gold-light)]/80 bg-muted ring-border" },
  champion: { icon: TrophyIcon, label: "Champion", tone: "text-[var(--color-gold)] bg-[var(--color-gold)]/12 ring-[var(--color-gold)]/30" },
  cursed: { icon: SkullIcon, label: "The cursed", tone: "text-[var(--color-red-team)] bg-[var(--color-red-team)]/10 ring-[var(--color-red-team)]/25" },
  salaxe: { icon: CrownIcon, label: "The exile", tone: "text-[var(--color-gold)] bg-[var(--color-gold-dark)]/30 ring-[var(--color-gold)]/30" },
  tribunal: { icon: GavelIcon, label: "Tribunal", tone: "text-[var(--color-gold-light)] bg-[var(--color-gold-dark)]/25 ring-[var(--color-gold)]/20" },
  wager: { icon: CoinsIcon, label: "Wagers", tone: "text-[var(--color-gold)] bg-[var(--color-gold)]/10 ring-[var(--color-gold)]/25" },
  allin: { icon: FlameIcon, label: "All-in", tone: "text-[var(--color-red-team)] bg-[var(--color-red-team)]/10 ring-[var(--color-red-team)]/25" },
  decree: { icon: ScrollTextIcon, label: "Decrees", tone: "text-[var(--color-gold-light)] bg-[var(--color-gold-dark)]/25 ring-[var(--color-gold)]/20" },
  treasury: { icon: LandmarkIcon, label: "Treasury", tone: "text-[var(--color-gold-light)]/80 bg-muted ring-border" },
  closing: { icon: BookOpenIcon, label: "To be continued", tone: "text-muted-foreground bg-muted ring-border" },
}

const numbers = new Intl.NumberFormat("en-US")

function StatChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-[var(--color-navy)]/50 px-2.5 text-xs text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  )
}

export function NightStats({ stats }: { stats: ChronicleStats }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatChip>
        <span className="font-semibold text-foreground tabular-nums">{stats.games}</span>
        {stats.games === 1 ? "game" : "games"}
      </StatChip>
      <StatChip>
        <span className="font-semibold text-[var(--color-blue-team)] tabular-nums">Blue {stats.blueWins}</span>
        <span aria-hidden>-</span>
        <span className="font-semibold text-[var(--color-red-team)] tabular-nums">{stats.redWins} Red</span>
      </StatChip>
      {stats.wagered > 0 && (
        <StatChip>
          <CoinsIcon className="size-3.5 text-[var(--color-gold)]" aria-hidden />
          <span className="font-semibold text-foreground tabular-nums">{numbers.format(stats.wagered)}</span> wagered
        </StatChip>
      )}
      {stats.decrees > 0 && (
        <StatChip>
          <ScrollTextIcon className="size-3.5 text-[var(--color-gold)]" aria-hidden />
          <span className="font-semibold text-foreground tabular-nums">{stats.decrees}</span>
          {stats.decrees === 1 ? "decree" : "decrees"}
        </StatChip>
      )}
      {stats.canceled > 0 && (
        <StatChip>
          <span className="font-semibold text-foreground tabular-nums">{stats.canceled}</span> called off
        </StatChip>
      )}
    </div>
  )
}

function gameLabel(game: ChronicleGame, index: number): string {
  const parts = [`Game ${index + 1}: ${game.winner === "blue" ? "Blue" : "Red"} side won`]
  if (game.mvp) parts.push(`MVP ${game.mvp}`)
  if (game.inter) parts.push(`Inter ${game.inter}`)
  if (game.salaxe) parts.push(`Salaxe ${game.salaxe.won ? "won" : "lost"} on ${game.salaxe.champion}`)
  return parts.join(". ")
}

export function GameStrip({ games }: { games: ChronicleGame[] }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Results, in order">
      {games.map((game, i) => (
        <li
          key={game.id}
          aria-label={gameLabel(game, i)}
          className={cn(
            "relative inline-flex h-7 min-w-9 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-semibold tabular-nums",
            game.winner === "blue"
              ? "border-[var(--color-blue-team)]/40 bg-[var(--color-blue-team)]/12 text-[var(--color-blue-team)]"
              : "border-[var(--color-red-team)]/40 bg-[var(--color-red-team)]/12 text-[var(--color-red-team)]"
          )}
        >
          <span aria-hidden>G{i + 1}</span>
          {game.salaxe && (
            <CrownIcon
              aria-hidden
              className={cn("size-3", game.salaxe.won ? "text-[var(--color-gold)]" : "text-muted-foreground/70")}
            />
          )}
        </li>
      ))}
    </ol>
  )
}

export function ChronicleSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-busy="true" aria-label="Loading the chronicle">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="mt-4 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className={cn("h-4", i === 1 ? "w-2/3" : "w-11/12")} />
          </div>
        ))}
      </div>
    </div>
  )
}
