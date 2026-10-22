"use client"

import { useMemo, useState } from "react"
import { LogInIcon, ShieldQuestionIcon, UserRoundPlusIcon } from "lucide-react"
import { ClaimPlayerDialog } from "@/components/claim-player-dialog"
import { formatNumber, formatShortDay, formatSigned, localDayKey } from "@/components/pages/format"
import { toneOf } from "@/components/pages/indicators"
import { PlayerRecord } from "@/components/pages/player-record"
import { AchievementsCard } from "@/components/pages/profile/achievements-card"
import { BalanceChart, summarizeSeries } from "@/components/pages/profile/balance-chart"
import { Breakdown } from "@/components/pages/profile/breakdown"
import { Ledger } from "@/components/pages/profile/ledger"
import { ProfileHero } from "@/components/pages/profile/profile-hero"
import { TitlesCard } from "@/components/pages/profile/titles-card"
import { PageApiError, usePlayerDetail, usePointsHistory } from "@/components/pages/queries"
import { PageEmpty, PageError, SectionCard } from "@/components/pages/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import type { BalancePoint } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

const DAY_MS = 86_400_000

function dayExtremes(series: BalancePoint[]) {
  const days = new Map<string, { at: string; delta: number }>()
  for (const p of series.slice(1)) {
    const key = localDayKey(p.at)
    const entry = days.get(key) ?? { at: p.at, delta: 0 }
    entry.delta += p.delta
    days.set(key, entry)
  }
  const list = [...days.values()]
  const best = list.reduce<{ at: string; delta: number } | null>((b, d) => (d.delta > (b?.delta ?? 0) ? d : b), null)
  const worst = list.reduce<{ at: string; delta: number } | null>((w, d) => (d.delta < (w?.delta ?? 0) ? d : w), null)
  return { best, worst }
}

function Fact({ label, value, hint, className }: { label: string; value: string; hint: string; className?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--color-navy)]/50 px-2.5 py-2">
      <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className={cn("font-display text-base font-semibold tabular-nums text-[var(--color-gold-light)]", className)}>{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Opening your court file">
      <Skeleton className="h-56 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}

export function ProfileView() {
  const { user, profile, isLoading, signIn } = useAuth()
  const userId = user?.id ?? null
  const points = usePoints(userId)
  const history = usePointsHistory(userId)
  const playerId = profile?.player_id ?? null
  const detail = usePlayerDetail(playerId)
  const [claimOpen, setClaimOpen] = useState(false)

  const series = useMemo(() => history.data?.series ?? [], [history.data])
  const summary = summarizeSeries(series)
  const extremes = useMemo(() => dayExtremes(series), [series])
  const today = useMemo(() => {
    if (!history.dataUpdatedAt) return 0
    const since = history.dataUpdatedAt - DAY_MS
    return points.transactions.filter((t) => Date.parse(t.created_at) >= since).reduce((sum, t) => sum + t.amount, 0)
  }, [points.transactions, history.dataUpdatedAt])

  if (isLoading) return <ProfileSkeleton />

  if (!user) {
    return (
      <div className="mx-auto max-w-xl py-6">
        <PageEmpty
          icon={ShieldQuestionIcon}
          title="The court does not know your face"
          action={
            <Button onClick={() => void signIn()} className="h-10 px-4">
              <LogInIcon aria-hidden />
              Sign in with Discord
            </Button>
          }
        >
          Sign in to open your court file: your treasury curve, every coin you won and lost, your titles and your deeds.
        </PageEmpty>
      </div>
    )
  }

  const name = profile?.players?.name ?? profile?.discord_username ?? "Mysterious noble"

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-5">
      <ProfileHero
        userId={user.id}
        name={name}
        username={profile?.discord_username ?? null}
        avatarUrl={profile?.discord_avatar_url ?? null}
        playerName={profile?.players?.name ?? null}
        balance={history.data?.balance ?? points.balance}
        today={today}
        history={history.data}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          id="treasury-curve"
          eyebrow={history.data?.act ? `Since ${formatShortDay(history.data.since)}` : "All time"}
          title="Treasury curve"
          description="Every bet, decree and kiss, one step at a time."
          className="lg:col-span-2"
        >
          {history.isPending ? (
            <Skeleton className="h-60 w-full rounded-xl sm:h-72" />
          ) : history.isError && !history.data ? (
            <PageError message={history.error.message} onRetry={() => void history.refetch()} retrying={history.isFetching} className="py-6" />
          ) : series.length < 2 || !summary ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No movements this act yet. The curve starts with your first coin.</p>
          ) : (
            <div className="space-y-3">
              <BalanceChart series={series} asOf={history.dataUpdatedAt} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Fact label="Peak" value={formatNumber(summary.peak.balance)} hint={formatShortDay(summary.peak.at)} />
                <Fact label="Low point" value={formatNumber(summary.low.balance)} hint={formatShortDay(summary.low.at)} />
                <Fact
                  label="Best day"
                  value={extremes.best ? formatSigned(extremes.best.delta) : "-"}
                  hint={extremes.best ? formatShortDay(extremes.best.at) : "Still waiting"}
                  className={extremes.best ? toneOf(extremes.best.delta) : undefined}
                />
                <Fact
                  label="Worst day"
                  value={extremes.worst ? formatSigned(extremes.worst.delta) : "-"}
                  hint={extremes.worst ? formatShortDay(extremes.worst.at) : "Untouched"}
                  className={extremes.worst ? toneOf(extremes.worst.delta) : undefined}
                />
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard id="money-trail" eyebrow="This act" title="Follow the money">
          {history.data ? (
            <Breakdown breakdown={history.data.breakdown} />
          ) : history.isError ? (
            <p className="py-6 text-center text-sm text-muted-foreground">The money trail went cold. It comes back with the curve.</p>
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        id="rift-record"
        eyebrow="All time"
        title={playerId ? "Your record on the Rift" : "The Rift does not know you yet"}
        description={playerId ? "Wins, lanes, champions and the people who ruin your evenings." : undefined}
      >
        {!playerId ? (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg text-sm text-muted-foreground">
              Claim your player to see your record, your nemesis and your soulmate on the Rift. Games already played will count.
            </p>
            <Button onClick={() => setClaimOpen(true)} className="h-10 px-4">
              <UserRoundPlusIcon aria-hidden />
              Claim your player
            </Button>
          </div>
        ) : detail.isPending ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : detail.data ? (
          <PlayerRecord detail={detail.data} />
        ) : detail.error instanceof PageApiError && detail.error.status === 404 ? (
          <p className="text-sm text-muted-foreground">No games recorded yet. Your legend starts with the first one.</p>
        ) : (
          <PageError message={detail.error?.message} onRetry={() => void detail.refetch()} retrying={detail.isFetching} className="py-6" />
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard id="titles" eyebrow="Wardrobe" title="Titles">
          <TitlesCard />
        </SectionCard>
        <SectionCard id="deeds" eyebrow="Milestones" title="Deeds">
          <AchievementsCard />
        </SectionCard>
      </div>

      <SectionCard id="ledger" eyebrow="Latest movements" title="The ledger" description="Straight from the royal scribes. They never round in your favour.">
        <Ledger transactions={points.transactions} loading={points.isLoading} />
      </SectionCard>

      <ClaimPlayerDialog open={claimOpen} onOpenChange={setClaimOpen} />
    </div>
  )
}
