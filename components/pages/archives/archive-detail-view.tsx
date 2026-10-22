"use client"

import Link from "next/link"
import { ArrowLeftIcon, CalendarDaysIcon, CoinsIcon, CrownIcon, DicesIcon, ScrollTextIcon, SwordsIcon } from "lucide-react"
import { ArchiveHallOfFame } from "@/components/archive-hall-of-fame"
import { ArchiveStandings } from "@/components/archive-standings"
import { SpendingBars, TreasuryRace, WagerOutcomes } from "@/components/archive-charts"
import { useLiveRefetch } from "@/components/live/live-context"
import { actLore, romanOf } from "@/components/pages/archives/act-lore"
import { daysBetween, formatCompact, formatNumber, formatShortDay } from "@/components/pages/format"
import { LiveStamp } from "@/components/pages/live-stamp"
import { PageHeader } from "@/components/pages/page-header"
import { PageApiError, useArchive } from "@/components/pages/queries"
import { StatTile } from "@/components/pages/stat-tile"
import { PageEmpty, PageError, SectionCard } from "@/components/pages/states"
import { Skeleton } from "@/components/ui/skeleton"

const LIVE_DOMAINS = ["session", "bet", "points", "chaos", "praise", "title", "sidebet", "bounty", "duel", "vote"] as const

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Unsealing the chronicle">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}

export function ArchiveDetailView({ id }: { id: number }) {
  const validId = Number.isInteger(id) && id > 0
  const query = useArchive(validId ? id : null)
  const data = query.data
  const live = data?.act.status === "active"
  const { refetch } = query

  useLiveRefetch(
    () => {
      if (live) void refetch()
    },
    { domains: [...LIVE_DOMAINS], tables: ["point_balances"] }
  )

  const back = (
    <Link
      href="/archives"
      className="inline-flex h-10 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-[var(--color-gold-light)]/80 outline-none hover:text-[var(--color-gold)] focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      All acts
    </Link>
  )

  if (validId && query.isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        {back}
        <Skeleton className="h-24 w-full max-w-xl" />
        <DetailSkeleton />
      </div>
    )
  }

  if (!data) {
    const missing =
      !validId || (query.error instanceof PageApiError && (query.error.status === 404 || query.error.status === 400))
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {back}
        {missing ? (
          <PageEmpty icon={ScrollTextIcon} title="This chapter was never written">
            No act carries that number. Maybe one day.
          </PageEmpty>
        ) : (
          <PageError title="The chronicle is sealed shut" message={query.error?.message} onRetry={() => void refetch()} retrying={query.isFetching} />
        )}
      </div>
    )
  }

  const { act, totals } = data
  const champion = data.standings[0] ?? null

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {back}
      <PageHeader
        eyebrow={`Act ${romanOf(act.number)} · ${live ? "Now playing" : "Sealed"}`}
        title={act.subtitle ?? act.name}
        description={
          <>
            {actLore(act.number, act.subtitle)}{" "}
            <span className="text-muted-foreground">
              {formatShortDay(act.startedAt)} - {act.endedAt ? formatShortDay(act.endedAt) : "today"}.
            </span>
          </>
        }
        actions={live ? <LiveStamp updatedAt={query.dataUpdatedAt} fetching={query.isFetching} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile icon={CalendarDaysIcon} label="Days" value={daysBetween(act.startedAt, act.endedAt)} />
        <StatTile icon={SwordsIcon} label="Games" value={formatNumber(totals.games)} />
        <StatTile icon={DicesIcon} label="Wagers" value={formatNumber(totals.bets)} />
        <StatTile icon={CoinsIcon} label="Wagered" value={formatCompact(totals.wagered)} />
        <StatTile icon={ScrollTextIcon} label="Decrees" value={formatNumber(totals.decrees)} />
        <StatTile icon={CrownIcon} label="Devotion" value={formatNumber(totals.devotion)} hint={act.number === 1 ? "Hands kissed" : "Praises sung"} />
      </div>

      <SectionCard id="hall-of-fame" eyebrow="Honors" title="Hall of Fame">
        {data.awards.length > 0 ? (
          <ArchiveHallOfFame awards={data.awards} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {live
              ? `The honors are handed out when the act ends.${champion ? ` For now ${champion.name} leads the treasury with ${formatNumber(champion.balance)}.` : ""}`
              : "No honors were recorded for this act."}
          </p>
        )}
      </SectionCard>

      <SectionCard id="treasury-race" eyebrow="Day by day" title="The race for the treasury" description="Every noble's balance across the act. Pick anyone to put them in the spotlight.">
        <TreasuryRace timeline={data.timeline} defaultFocus={champion?.userId ?? null} />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard id="wagers" eyebrow="The betting book" title="Wager outcomes" description="Most active bettors first.">
          <WagerOutcomes bets={data.bets} />
        </SectionCard>
        <SectionCard id="spending" eyebrow="Follow the money" title="Where the coin went">
          <SpendingBars spending={data.spending} />
        </SectionCard>
      </div>

      <SectionCard id="standings" eyebrow={live ? "Live standings" : "When the curtain fell"} title={live ? "Standings so far" : "Final standings"}>
        <ArchiveStandings standings={data.standings} />
      </SectionCard>
    </div>
  )
}
