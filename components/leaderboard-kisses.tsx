"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronDownIcon, CoinsIcon, CrownIcon, FeatherIcon, HandHeartIcon, ScrollTextIcon } from "lucide-react"
import { useLiveSignal } from "@/components/live/live-context"
import { PlayerAvatar } from "@/components/pages/avatars"
import { formatNumber, formatShortDay, plural } from "@/components/pages/format"
import { LiveStamp } from "@/components/pages/live-stamp"
import { PageHeader } from "@/components/pages/page-header"
import { PAGE_KEYS, useKissBoard } from "@/components/pages/queries"
import { SeasonPicker } from "@/components/pages/season-picker"
import { PageEmpty, PageError } from "@/components/pages/states"
import { TotalTiles } from "@/components/pages/total-tiles"
import type { SeasonKey } from "@/components/pages/use-season"
import { PraiseQuote } from "@/components/praise/praise-card"
import { VerdictChip } from "@/components/praise/verdict-chip"
import { ProfileTrigger } from "@/components/profile/profile-provider"
import { PlayerName } from "@/components/titles/player-name"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthUser } from "@/hooks/use-auth"
import { domainOf } from "@/lib/live/events"
import { KISS_BOARD_HELP } from "@/lib/pages/help"
import type { KissBoardResponse, KissEntry, KissPraise } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

const COLUMNS = "grid-cols-[2.5rem_minmax(0,1fr)_auto] md:grid-cols-[3rem_minmax(0,1fr)_5.5rem_5rem_7rem]"

function PraiseLine({ praise, clamp }: { praise: KissPraise; clamp: boolean }) {
  return (
    <div className="min-w-0">
      <PraiseQuote body={praise.body} className={cn("text-sm", clamp && "line-clamp-2")} />
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <time dateTime={praise.createdAt}>{formatShortDay(praise.createdAt)}</time>
        <span className="font-semibold text-[var(--color-gold)] tabular-nums">+{formatNumber(praise.points)}</span>
        {praise.verdict ? <VerdictChip verdict={praise.verdict} favor={praise.favor} className="h-5 text-[10px]" /> : null}
      </p>
      {praise.verdictNote ? (
        <p
          className={cn(
            "mt-1.5 border-l-2 pl-2 text-xs leading-relaxed text-muted-foreground",
            praise.verdict === "scorned" ? "border-destructive/60" : "border-[var(--color-gold)]/50"
          )}
        >
          <span className="font-semibold text-[var(--color-gold)]">Salaxe: </span>
          {praise.verdictNote}
        </p>
      ) : null}
    </div>
  )
}

function KissRow({ entry, mine, live }: { entry: KissEntry; mine: boolean; live: boolean }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const latest = entry.recent[0]
  const more = entry.recent.length > 1
  return (
    <li
      className={cn(
        "rounded-xl border px-2.5 py-2.5 sm:px-3",
        mine ? "border-[var(--color-gold)]/45 bg-[var(--color-gold)]/[0.06]" : "border-transparent bg-[var(--color-navy-light)]/70 hover:border-[var(--color-gold)]/15"
      )}
    >
      <div className={cn("grid items-center gap-x-3", COLUMNS)}>
        <span
          className={cn(
            "text-center font-display text-base font-semibold tabular-nums",
            entry.rank === 1 ? "text-[var(--color-gold)]" : "text-[var(--color-gold-light)]/80"
          )}
        >
          {entry.rank === 1 ? <CrownIcon className="mx-auto mb-0.5 size-3.5" aria-hidden /> : null}
          {entry.rank}
        </span>

        <span className="flex min-w-0 items-center gap-2.5">
          <ProfileTrigger playerId={entry.playerId} name={entry.name} className="shrink-0 rounded-full">
            <PlayerAvatar name={entry.name} src={entry.avatarUrl} size="md" />
          </ProfileTrigger>
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-1.5">
              <ProfileTrigger playerId={entry.playerId} name={entry.name} className="min-w-0 text-sm font-semibold text-[var(--color-gold-light)]">
                <PlayerName name={entry.name} userId={entry.userId} />
              </ProfileTrigger>
              {mine ? (
                <span className="shrink-0 rounded-full bg-[var(--color-gold)]/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[var(--color-gold)]">
                  YOU
                </span>
              ) : null}
              {live && entry.today ? (
                <span className="shrink-0 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-emerald-300">
                  TODAY
                </span>
              ) : null}
            </span>
            <span className="block text-[11px] text-muted-foreground tabular-nums">
              <span className="md:hidden">
                {plural(entry.kisses, "kiss", "kisses")} · {plural(entry.crowns, "crown")}
                {entry.legacy > 0 ? " · " : null}
              </span>
              {entry.legacy > 0 ? <span>{plural(entry.legacy, "Act I kiss", "Act I kisses")}</span> : null}
            </span>
          </span>
        </span>

        <span className="hidden text-sm text-[var(--color-gold-light)]/75 tabular-nums md:block">{entry.kisses}</span>
        <span className="hidden text-sm text-[var(--color-gold-light)]/75 tabular-nums md:block">{entry.crowns > 0 ? entry.crowns : "-"}</span>

        <span className="flex flex-col items-end gap-0.5 text-right">
          <span className="font-display text-lg leading-none font-semibold text-[var(--color-gold)] tabular-nums">{formatNumber(entry.points)}</span>
          <span className="text-[11px] text-muted-foreground">points</span>
        </span>
      </div>

      {latest ? (
        <div className="mt-2 space-y-2 pl-[3.25rem] md:pl-[3.75rem]">
          <div id={listId} className="space-y-3">
            {(open ? entry.recent : [latest]).map((praise) => (
              <PraiseLine key={praise.id} praise={praise} clamp={!open} />
            ))}
          </div>
          {more ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen((value) => !value)}
              className="-ml-1 inline-flex h-8 items-center gap-1 rounded-md px-1 text-xs font-medium text-[var(--color-gold-light)]/80 outline-none hover:text-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
              {open ? "Only the latest" : `The last ${entry.recent.length} praises`}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-1.5 pl-[3.25rem] text-xs text-muted-foreground md:pl-[3.75rem]">Kissed the hand in Act I, never put it in writing.</p>
      )}
    </li>
  )
}

function KissedToday({ entries, viewerId }: { entries: KissEntry[]; viewerId: string | null }) {
  const kissed = entries.filter((e) => e.today)
  const me = viewerId ? entries.find((e) => e.userId === viewerId) : undefined
  return (
    <section
      aria-labelledby="kissed-today-title"
      className="flex flex-col gap-3 rounded-2xl border border-[var(--color-gold)]/20 bg-card px-3 py-3 sm:flex-row sm:items-center sm:px-4"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-1.5">
          <h2 id="kissed-today-title" className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Kissed today
          </h2>
          <InfoTip help={KISS_BOARD_HELP.today} className="size-4 [&_svg]:size-3.5" />
        </div>
        <p className="font-display text-base font-semibold text-[var(--color-gold-light)]">
          {kissed.length === 0 ? "The royal hand is still dry today." : `${plural(kissed.length, "subject")} sang for the King today.`}
        </p>
        {kissed.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Kissed the hand today">
            {kissed.map((e) => (
              <li key={e.userId}>
                <ProfileTrigger playerId={e.playerId} name={e.name} className="rounded-full">
                  <PlayerAvatar name={e.name} src={e.avatarUrl} size="sm" ring={e.userId === viewerId ? "gold" : null} />
                </ProfileTrigger>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {viewerId ? (
        me?.today ? (
          <p className="text-sm font-medium text-emerald-300">Your lips are on record for today.</p>
        ) : (
          <Link
            href="/"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-gold)] px-4 text-sm font-semibold text-[var(--color-navy)] transition-colors outline-none hover:bg-[var(--color-gold-light)] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <FeatherIcon className="size-4" aria-hidden />
            Sing for him today
          </Link>
        )
      ) : null}
    </section>
  )
}

function KissTotals({ data }: { data: KissBoardResponse }) {
  return (
    <div className="space-y-1.5">
      <TotalTiles
        items={[
          { icon: HandHeartIcon, label: "Hands kissed", value: formatNumber(data.totals.kisses), help: KISS_BOARD_HELP.kisses },
          { icon: CoinsIcon, label: "Points paid", value: formatNumber(data.totals.points), help: KISS_BOARD_HELP.points },
          { icon: CrownIcon, label: "Crowns", value: formatNumber(data.totals.crowns), help: KISS_BOARD_HELP.crowns },
        ]}
      />
      {data.totals.legacy > 0 ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          Plus {plural(data.totals.legacy, "Act I kiss", "Act I kisses")}, counted apart.
          <InfoTip help={KISS_BOARD_HELP.legacy} className="size-4 [&_svg]:size-3.5" />
        </p>
      ) : null}
    </div>
  )
}

function KissSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Counting the kisses">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export function KissBoard({ season, onSeasonChange }: { season: SeasonKey; onSeasonChange: (next: SeasonKey) => void }) {
  const query = useKissBoard(season)
  const queryClient = useQueryClient()
  const { user, isLoading: authLoading } = useAuthUser()
  const viewerId = authLoading ? null : (user?.id ?? null)
  const data = query.data
  // Today only means something while the window is still open.
  const live = !!data && (data.season === null || data.season.status === "active")

  useLiveSignal((signal) => {
    if (signal.kind === "event" && domainOf(signal.event.type) === "act") {
      void queryClient.invalidateQueries({ queryKey: PAGE_KEYS.kisses(season) })
    }
  })

  return (
    <>
      <PageHeader
        eyebrow="The King's devoted"
        title="The Hall of Kisses"
        description="Every praise sung for Salaxe, counted in coin and in crowns. He reads the list each night, then pretends he never asked for it."
        help={KISS_BOARD_HELP.page}
        actions={<LiveStamp updatedAt={query.dataUpdatedAt} fetching={query.isFetching && !query.isPending} />}
      />
      <SeasonPicker value={season} onChange={onSeasonChange} served={data?.season} className="w-full sm:w-auto" />

      {query.isPending ? (
        <KissSkeleton />
      ) : !data ? (
        <PageError
          title="The Hall of Kisses is locked"
          message={query.error?.message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : !data.available ? (
        <PageEmpty icon={ScrollTextIcon} title="The Hall is still being built">
          The praise ledger has not been opened yet. Come back once the King&apos;s scribes finish the paperwork.
        </PageEmpty>
      ) : data.entries.length === 0 ? (
        <PageEmpty icon={HandHeartIcon} title="No lips have touched the hand">
          {data.season
            ? "Nobody has sung for Salaxe in this act yet. The first praise waits in the match room."
            : "Nobody has sung for Salaxe yet. The first praise waits in the match room."}
        </PageEmpty>
      ) : (
        <>
          <KissTotals data={data} />
          {live ? <KissedToday entries={data.entries} viewerId={viewerId} /> : null}
          <section aria-labelledby="kisses-title" className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <h2 id="kisses-title" className="font-display text-lg font-semibold text-[var(--color-gold-light)]">
                  The most devoted lips
                </h2>
                <InfoTip help={KISS_BOARD_HELP.page} />
              </div>
              <span className="hidden text-xs text-muted-foreground sm:inline">Ranked by points, then by praises</span>
            </div>
            <div>
              <div
                aria-hidden
                className={cn("mb-1.5 hidden gap-x-3 px-3 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase md:grid", COLUMNS)}
              >
                <span className="text-center">#</span>
                <span>Subject</span>
                <span>Kisses</span>
                <span>Crowns</span>
                <span className="text-right">Earned</span>
              </div>
              <ol className="space-y-1.5" aria-label="The Hall of Kisses">
                {data.entries.map((entry) => (
                  <KissRow key={entry.userId} entry={entry} mine={entry.userId === viewerId} live={live} />
                ))}
              </ol>
            </div>
          </section>
        </>
      )}
    </>
  )
}
