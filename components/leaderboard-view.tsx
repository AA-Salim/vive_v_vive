"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowRightIcon, CoinsIcon, CrownIcon, ScaleIcon, TrendingDownIcon } from "lucide-react"
import { displayName, LeaderboardPodium } from "@/components/leaderboard-podium"
import { LeaderboardTable } from "@/components/leaderboard-table"
import { useLiveSignal } from "@/components/live/live-context"
import { PlayerAvatar } from "@/components/pages/avatars"
import { formatNumber, plural } from "@/components/pages/format"
import { LiveStamp } from "@/components/pages/live-stamp"
import { PageHeader } from "@/components/pages/page-header"
import { PlayerSheet } from "@/components/pages/player-sheet"
import { PAGE_KEYS, useLeaderboard } from "@/components/pages/queries"
import { PageEmpty, PageError } from "@/components/pages/states"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthUser } from "@/hooks/use-auth"
import { domainOf, type LiveDomain } from "@/lib/live/events"
import type { LeaderboardEntry, PlayerRef } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]

// These events move balances (or the act) without naming the leaderboard in their invalidation roots.
const TREASURY_DOMAINS: ReadonlySet<LiveDomain> = new Set<LiveDomain>(["title", "bounty", "duel", "sidebet", "vote", "shame", "act"])

function standingLine(me: LeaderboardEntry, ahead: LeaderboardEntry | undefined): string {
  if (me.balance < 0) return `In debt by ${formatNumber(-me.balance)}. Salaxe has written your name down twice.`
  if (me.rank === 1) return "You hold the treasury. Sleep with one eye open."
  if (!ahead) return "Keep climbing."
  const gap = ahead.balance - me.balance
  if (gap === 0) return `Level with ${displayName(ahead)}. Someone has to blink first.`
  return gap <= 25
    ? `${plural(gap, "point")} behind ${displayName(ahead)}. One good wager away.`
    : `${plural(gap, "point")} behind ${displayName(ahead)}. The climb continues.`
}

function YourStanding({ entries }: { entries: LeaderboardEntry[] }) {
  const index = entries.findIndex((e) => e.is_current_user)
  if (index < 0) return null
  const me = entries[index]
  const ahead = entries.slice(0, index).reverse().find((e) => e.balance > me.balance)
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/[0.05] px-3 py-3 sm:px-4">
      <PlayerAvatar name={displayName(me)} src={me.avatar_url} size="md" ring="gold" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Your standing</p>
        <p className="font-display text-base font-semibold text-[var(--color-gold-light)]">
          #{me.rank} of {entries.length} <span className="text-muted-foreground">·</span>{" "}
          <span className={cn("text-[var(--color-gold)]", me.balance < 0 && "text-rose-300")}>{formatNumber(me.balance)} points</span>
        </p>
        <p className="text-xs text-muted-foreground">{standingLine(me, ahead)}</p>
      </div>
      <Link
        href="/profile"
        className="hidden h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-gold)]/25 px-3 text-sm font-medium text-[var(--color-gold-light)] transition-colors outline-none hover:bg-[var(--color-gold)]/10 focus-visible:ring-3 focus-visible:ring-ring/50 sm:inline-flex"
      >
        Your ledger
        <ArrowRightIcon className="size-4" aria-hidden />
      </Link>
    </div>
  )
}

function TreasuryTotals({ entries }: { entries: LeaderboardEntry[] }) {
  const total = entries.reduce((sum, e) => sum + e.balance, 0)
  const debtors = entries.filter((e) => e.balance < 0).length
  const moved = entries.reduce((sum, e) => sum + Math.abs(e.delta_24h), 0)
  const items = [
    { icon: CoinsIcon, label: "Coin in play", value: formatNumber(total) },
    { icon: ScaleIcon, label: "Moved today", value: formatNumber(moved) },
    { icon: TrendingDownIcon, label: "In debt", value: debtors === 0 ? "Nobody" : plural(debtors, "noble") },
  ]
  return (
    <dl className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-xl border border-[var(--color-gold)]/12 bg-card px-2.5 py-2 sm:px-3">
          <dt className="flex items-start gap-1 text-[10px] leading-tight font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <item.icon className="mt-px size-3 shrink-0 text-[var(--color-gold)]/60" aria-hidden />
            <span>{item.label}</span>
          </dt>
          <dd className="truncate font-display text-base font-semibold text-[var(--color-gold-light)] tabular-nums sm:text-lg">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Counting the treasury">
      <div className="grid grid-cols-3 items-end gap-2 sm:gap-5">
        {[28, 36, 24].map((h, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="size-14 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="w-full rounded-t-xl rounded-b-none" style={{ height: h * 4 }} />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export function LeaderboardView() {
  const query = useLeaderboard()
  const queryClient = useQueryClient()
  const { user, isLoading: authLoading } = useAuthUser()
  const [open, setOpen] = useState<PlayerRef | null>(null)
  const act = query.data?.act ?? null
  const viewerId = user?.id ?? null
  const entries = useMemo(() => {
    const list = query.data?.leaderboard ?? []
    return authLoading ? list : list.map((e) => ({ ...e, is_current_user: e.user_id === viewerId }))
  }, [query.data, authLoading, viewerId])

  useLiveSignal((signal) => {
    if (signal.kind === "event" && TREASURY_DOMAINS.has(domainOf(signal.event.type))) {
      void queryClient.invalidateQueries({ queryKey: PAGE_KEYS.leaderboard })
    }
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow={act ? `Act ${ROMAN[act.number] ?? act.number} · ${act.subtitle ?? act.name}` : "The kingdom"}
        title="The Treasury"
        description="Every coin in the kingdom, counted twice. Salaxe counts it a third time, in his little notebook."
        actions={<LiveStamp updatedAt={query.dataUpdatedAt} fetching={query.isFetching && !query.isPending} />}
      />

      {query.isPending ? (
        <LeaderboardSkeleton />
      ) : query.isError && entries.length === 0 ? (
        <PageError
          title="The treasury doors are jammed"
          message={query.error.message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : entries.length === 0 ? (
        <PageEmpty icon={CrownIcon} title="The vault is empty">
          No coin has changed hands yet. Sign in, claim your daily stipend and play a game to open the books.
        </PageEmpty>
      ) : (
        <>
          <LeaderboardPodium entries={entries.slice(0, 3)} onOpen={setOpen} />
          <TreasuryTotals entries={entries} />
          <YourStanding entries={entries} />
          {entries.length > 3 ? (
            <section aria-labelledby="court-title" className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="court-title" className="font-display text-lg font-semibold text-[var(--color-gold-light)]">
                  The rest of the court
                </h2>
                <span className="hidden text-xs text-muted-foreground sm:inline">Arrows: movement in the last 24 hours</span>
              </div>
              <LeaderboardTable entries={entries.slice(3)} onOpen={setOpen} />
            </section>
          ) : null}
        </>
      )}
      <PlayerSheet player={open} onClose={() => setOpen(null)} />
    </div>
  )
}
