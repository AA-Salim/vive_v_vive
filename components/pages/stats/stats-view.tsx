"use client"

import { useMemo, useState } from "react"
import { BarChart3Icon, CalendarIcon, SwordsIcon, UsersIcon } from "lucide-react"
import { SearchField, Segmented } from "@/components/pages/controls"
import { formatShortDay, plural } from "@/components/pages/format"
import { LiveStamp } from "@/components/pages/live-stamp"
import { PageHeader } from "@/components/pages/page-header"
import { PlayerSheet } from "@/components/pages/player-sheet"
import { useStats } from "@/components/pages/queries"
import { StatTile } from "@/components/pages/stat-tile"
import { PageEmpty, PageError } from "@/components/pages/states"
import { StatsRecords } from "@/components/pages/stats/stats-records"
import { sortPlayers, StatsCards, StatsTable, type SortKey, type SortState } from "@/components/pages/stats/stats-table"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { RATE_MIN_GAMES } from "@/lib/pages/constants"
import { STATS_HELP } from "@/lib/pages/help"
import type { PlayerRef } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

type Scope = "regulars" | "everyone"

const MOBILE_SORTS: { value: SortKey; label: string }[] = [
  { value: "wins", label: "Wins" },
  { value: "winRate", label: "Win rate" },
  { value: "games", label: "Games" },
  { value: "streak", label: "Streak" },
]

function StatsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Counting victories">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}

export function StatsView() {
  const query = useStats()
  const [scope, setScope] = useState<Scope>("regulars")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortState>({ key: "wins", ascending: false })
  const [open, setOpen] = useState<PlayerRef | null>(null)
  const data = query.data

  const players = useMemo(() => {
    const list = data?.players ?? []
    const needle = search.trim().toLowerCase()
    const filtered = list.filter(
      (p) => (scope === "everyone" || p.games >= RATE_MIN_GAMES) && (!needle || p.name.toLowerCase().includes(needle))
    )
    return sortPlayers(filtered, sort)
  }, [data, scope, search, sort])

  const toggleSort = (key: SortKey) =>
    setSort((current) => (current.key === key ? { key, ascending: !current.ascending } : { key, ascending: key === "name" }))

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        eyebrow="Hall of Records"
        title="Player Stats"
        description="Wins, streaks, lanes and the champions the dice keep forcing on everyone. The numbers never lie. Salaxe still argues."
        help={STATS_HELP.page}
        actions={<LiveStamp updatedAt={query.dataUpdatedAt} fetching={query.isFetching && !query.isPending} />}
      />

      {query.isPending ? (
        <StatsSkeleton />
      ) : !data ? (
        <PageError title="The record books are locked" message={query.error?.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : data.players.length === 0 ? (
        <PageEmpty icon={BarChart3Icon} title="No games played yet">
          The record books open with the first declared winner.
        </PageEmpty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <StatTile icon={SwordsIcon} label="Games played" value={data.totals.games} hint={data.totals.lastGameAt ? `Last one ${formatShortDay(data.totals.lastGameAt)}` : undefined} help={STATS_HELP.games} />
            <StatTile icon={UsersIcon} label="Players" value={data.totals.players} hint="Have set foot on the Rift" help={STATS_HELP.players} />
            <StatTile
              icon={BarChart3Icon}
              label="Side war"
              help={STATS_HELP.sides}
              value={
                <span>
                  <span className="text-[var(--color-blue-team)]">{data.totals.blueWins}</span>
                  <span className="mx-1 text-muted-foreground">-</span>
                  <span className="text-[var(--color-red-team)]">{data.totals.redWins}</span>
                </span>
              }
              hint={
                data.totals.redWins > data.totals.blueWins
                  ? "Red side keeps winning. Blame the map."
                  : data.totals.blueWins > data.totals.redWins
                    ? "Blue side leads. For now."
                    : "Dead even. The Rift refuses to pick a side."
              }
            />
            <StatTile
              icon={CalendarIcon}
              label="Since"
              value={data.totals.firstGameAt ? formatShortDay(data.totals.firstGameAt) : "-"}
              hint="The first recorded game"
              help={STATS_HELP.since}
            />
          </div>

          <StatsRecords records={data.records} onOpen={setOpen} />

          <section aria-labelledby="ranking-title" className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 id="ranking-title" className="font-display text-lg font-semibold text-[var(--color-gold-light)]">
                    The roster
                  </h2>
                  <InfoTip help={STATS_HELP.roster} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {plural(players.length, "player")} · tap a name for the full court file
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <SearchField value={search} onChange={setSearch} placeholder="Find a player" label="Find a player" className="sm:w-52" />
                <Segmented
                  label="Who to show"
                  value={scope}
                  onChange={setScope}
                  options={[
                    { value: "regulars", label: `${RATE_MIN_GAMES}+ games` },
                    { value: "everyone", label: "Everyone" },
                  ]}
                />
              </div>
            </div>

            <Segmented
              label="Sort by"
              value={MOBILE_SORTS.some((s) => s.value === sort.key) ? sort.key : "wins"}
              onChange={(key) => setSort({ key, ascending: false })}
              options={MOBILE_SORTS}
              className="flex w-full md:hidden"
            />

            {players.length === 0 ? (
              <p className={cn("rounded-2xl border border-dashed border-[var(--color-gold)]/20 p-6 text-center text-sm text-muted-foreground")}>
                Nobody matches. Try another name, or show everyone.
              </p>
            ) : (
              <>
                <div className="hidden md:block">
                  <StatsTable players={players} sort={sort} onSort={toggleSort} onOpen={setOpen} />
                </div>
                <div className="md:hidden">
                  <StatsCards players={players} onOpen={setOpen} />
                </div>
              </>
            )}
          </section>
        </>
      )}

      <PlayerSheet player={open} onClose={() => setOpen(null)} />
    </div>
  )
}
