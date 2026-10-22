"use client"

import { CoinsIcon, CrownIcon, HandCoinsIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"
import { AnimatedNumber } from "@/components/betting/animated-number"
import { PlayerAvatar } from "@/components/pages/avatars"
import { formatNumber, formatSigned } from "@/components/pages/format"
import { toneOf } from "@/components/pages/indicators"
import { StatTile } from "@/components/pages/stat-tile"
import { PlayerTitles } from "@/components/titles/player-titles"
import { Skeleton } from "@/components/ui/skeleton"
import type { PointsHistoryResponse } from "@/lib/pages/types"
import { isDevotion } from "@/lib/reasons"
import { cn } from "@/lib/utils"

interface ProfileHeroProps {
  userId: string
  name: string
  username: string | null
  avatarUrl: string | null
  playerName: string | null
  balance: number
  today: number
  history: PointsHistoryResponse | undefined
}

function rankLine(rank: number | null, of: number): string {
  if (!rank) return "Not on the books yet"
  if (rank === 1) return `First of ${of}. The treasury is yours.`
  if (rank <= 3) return `#${rank} of ${of}. On the podium.`
  if (rank > of - 3) return `#${rank} of ${of}. The view from the bottom is humbling.`
  return `#${rank} of ${of} in the treasury`
}

export function ProfileHero({ userId, name, username, avatarUrl, playerName, balance, today, history }: ProfileHeroProps) {
  const devotion = history?.breakdown.filter((r) => isDevotion(r.reason)).reduce((sum, r) => sum + r.count, 0) ?? 0
  const net = history ? history.income - history.spending : 0

  return (
    <section
      aria-label="Your standing"
      className="relative overflow-hidden rounded-2xl border border-[var(--color-gold)]/25 bg-card shadow-2xl shadow-black/30"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/80 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-16 h-56 w-80 rounded-full bg-[var(--color-gold)]/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <PlayerAvatar name={name} src={avatarUrl} size="xl" ring="gold" className="size-16 sm:size-20" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              {history?.act ? history.act.name : "Your court file"}
            </p>
            <h1 className="truncate font-display text-3xl leading-tight font-semibold text-[var(--color-gold-light)] sm:text-4xl">{name}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {username ? `@${username}` : null}
              {playerName ? ` · plays as ${playerName}` : " · no player claimed"}
            </p>
            <PlayerTitles userId={userId} size="md" className="mt-1.5" />
          </div>
        </div>

        <div className="flex flex-col gap-1 lg:items-end lg:text-right">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase lg:justify-end">
            <CoinsIcon className="size-3.5 text-[var(--color-gold)]" aria-hidden />
            Treasury
          </p>
          <p className={cn("font-display text-5xl leading-none font-semibold text-[var(--color-gold)] sm:text-6xl", balance < 0 && "text-rose-300")}>
            <AnimatedNumber value={balance} format={formatNumber} />
          </p>
          <div className="flex flex-wrap items-center gap-x-2 text-sm text-[var(--color-gold-light)]/75 lg:justify-end">
            {history ? (
              <span className="inline-flex items-center gap-1">
                <CrownIcon className="size-3.5 text-[var(--color-gold)]/70" aria-hidden />
                {rankLine(history.rank, history.of)}
              </span>
            ) : (
              <Skeleton className="h-4 w-40" />
            )}
            {today !== 0 ? <span className={cn("font-semibold tabular-nums", toneOf(today))}>{formatSigned(today)} today</span> : null}
          </div>
        </div>
      </div>

      <div className="relative grid grid-cols-2 gap-2 border-t border-[var(--color-gold)]/10 p-3 sm:grid-cols-4 sm:p-4">
        <StatTile
          icon={TrendingUpIcon}
          label="Earned"
          value={history ? <span className="text-emerald-300">+{formatNumber(history.income)}</span> : <Skeleton className="h-7 w-16" />}
          hint="This act"
        />
        <StatTile
          icon={TrendingDownIcon}
          label="Spent"
          value={history ? <span className="text-rose-300">-{formatNumber(history.spending)}</span> : <Skeleton className="h-7 w-16" />}
          hint="This act"
        />
        <StatTile
          icon={HandCoinsIcon}
          label="Net result"
          value={history ? <span className={toneOf(net)}>{formatSigned(net)}</span> : <Skeleton className="h-7 w-16" />}
          hint={history ? `${formatNumber(history.transactions)} movements` : undefined}
        />
        <StatTile
          icon={CrownIcon}
          label="Devotion"
          value={history ? formatNumber(devotion) : <Skeleton className="h-7 w-10" />}
          hint={devotion === 0 ? "The fallen king noticed." : devotion > 20 ? "Salaxe keeps your verses." : "Kisses and praises"}
        />
      </div>
    </section>
  )
}
