"use client"

import { useMemo, useState } from "react"
import { ChevronDownIcon, DicesIcon, FlameIcon, GhostIcon, SkullIcon, SparklesIcon, TrophyIcon, type LucideIcon } from "lucide-react"
import { LaneIcon } from "@/components/lane-icon"
import { ChampionGrid } from "@/components/pages/champions/champion-grid"
import { PoolBoard } from "@/components/pages/champions/pool-board"
import { ChampionIcon } from "@/components/pages/avatars"
import { SearchField, Segmented } from "@/components/pages/controls"
import { formatNumber, formatPercent, plural } from "@/components/pages/format"
import { LiveStamp } from "@/components/pages/live-stamp"
import { PageHeader } from "@/components/pages/page-header"
import { useChampionStats } from "@/components/pages/queries"
import { SeasonPicker } from "@/components/pages/season-picker"
import { StatTile } from "@/components/pages/stat-tile"
import { PageEmpty, PageError } from "@/components/pages/states"
import { useSeasonParam } from "@/components/pages/use-season"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { ALL_ROLES, ROLE_LABELS } from "@/lib/champions"
import type { HelpEntry } from "@/lib/help"
import { CHAMPION_MIN_GAMES } from "@/lib/pages/constants"
import { CHAMPIONS_HELP } from "@/lib/pages/help"
import type { ChampionStat } from "@/lib/pages/types"
import type { Role } from "@/lib/types"

type View = "record" | "pools"
type Sort = "games" | "winRate" | "name"
type LaneFilter = Role | "all"

const PAGE = 40

interface SpotlightProps {
  label: string
  quip: string
  champion: ChampionStat
  value: string
  icon: LucideIcon
  help: HelpEntry
}

function Spotlight({ label, quip, champion, value, icon: Icon, help }: SpotlightProps) {
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--color-gold)]/20 bg-linear-to-br from-[var(--color-gold)]/[0.06] to-transparent p-3">
      <ChampionIcon name={champion.name} internal={champion.internal} size={56} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-[var(--color-gold)] uppercase">
          <Icon className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{label}</span>
          <InfoTip help={help} className="-my-1" />
        </p>
        <p className="truncate font-display text-base font-semibold text-[var(--color-gold-light)]">
          {champion.name} <span className="text-sm text-[var(--color-gold-light)]/70">{value}</span>
        </p>
        <p className="line-clamp-2 text-[11px] text-muted-foreground">{quip}</p>
      </div>
    </li>
  )
}

export function ChampionsView() {
  const [season, setSeason] = useSeasonParam()
  const query = useChampionStats(season)
  const [view, setView] = useState<View>("record")
  const [sort, setSort] = useState<Sort>("games")
  const [lane, setLane] = useState<LaneFilter>("all")
  const [search, setSearch] = useState("")
  const [visible, setVisible] = useState(PAGE)
  const data = query.data

  const dealt = useMemo(() => new Map((data?.champions ?? []).map((c) => [c.name, c.games])), [data])
  const regulars = useMemo(() => (data?.champions ?? []).filter((c) => c.games >= CHAMPION_MIN_GAMES), [data])
  const best = regulars.reduce<ChampionStat | null>((b, c) => (!b || c.winRate > b.winRate ? c : b), null)
  const worst = regulars.reduce<ChampionStat | null>((w, c) => (!w || c.winRate < w.winRate ? c : w), null)
  const most = data?.champions[0] ?? null
  const poolNames = useMemo(() => new Set(Object.values(data?.pools ?? {}).flatMap((list) => list.map((c) => c.name))), [data])
  const fresh = [...poolNames].filter((name) => !dealt.has(name)).length

  const list = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = (data?.champions ?? []).filter(
      (c) => (lane === "all" || c.lanes.some((l) => l.lane === lane)) && (!needle || c.name.toLowerCase().includes(needle))
    )
    return [...filtered].sort((x, y) =>
      sort === "name" ? x.name.localeCompare(y.name) : sort === "winRate" ? y.winRate - x.winRate || y.games - x.games : y.games - x.games || y.winRate - x.winRate
    )
  }, [data, lane, search, sort])

  const reset = () => setVisible(PAGE)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        eyebrow="The Armory"
        title="Champions"
        description="Every champion the randomizer ever dealt, and what it did to the poor soul who got it."
        help={CHAMPIONS_HELP.page}
        actions={<LiveStamp updatedAt={query.dataUpdatedAt} fetching={query.isFetching && !query.isPending} />}
      />
      <SeasonPicker value={season} onChange={setSeason} served={query.data?.season} />

      <Segmented
        label="Choose a view"
        value={view}
        onChange={setView}
        options={[
          { value: "record", label: "Battle record" },
          { value: "pools", label: "Draft pools" },
        ]}
        className="flex w-full sm:inline-flex sm:w-auto"
      />

      {query.isPending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Opening the armory">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>
      ) : !data ? (
        <PageError title="The armory is locked" message={query.error?.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : view === "pools" ? (
        <PoolBoard pools={data.pools} dealt={dealt} />
      ) : data.champions.length === 0 ? (
        <PageEmpty icon={DicesIcon} title={data.season ? "No champion dealt this act yet" : "No champion dealt yet"}>
          The first game will fill the armory.
        </PageEmpty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <StatTile icon={DicesIcon} label="Picks dealt" value={formatNumber(data.totals.picks)} hint="Ten per game, no refunds" help={CHAMPIONS_HELP.picks} />
            <StatTile icon={SparklesIcon} label="Champions seen" value={`${data.totals.unique}`} hint={`Out of ${data.totals.pool} in the pools`} help={CHAMPIONS_HELP.seen} />
            <StatTile icon={GhostIcon} label="Still waiting" value={fresh} hint={fresh === 0 ? "The dice spared nobody" : "Never dealt, not once"} help={CHAMPIONS_HELP.waiting} />
            <StatTile icon={FlameIcon} label="Most dealt" value={most?.name ?? "-"} hint={most ? plural(most.games, "game") : undefined} help={CHAMPIONS_HELP.most} />
          </div>

          {best || worst ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {best ? (
                <Spotlight
                  icon={TrophyIcon}
                  label="Blessed pick"
                  champion={best}
                  value={formatPercent(best.winRate)}
                  quip={`Best win rate with ${CHAMPION_MIN_GAMES}+ games. Roll it and start celebrating.`}
                  help={CHAMPIONS_HELP.blessed}
                />
              ) : null}
              {worst && worst !== best ? (
                <Spotlight
                  icon={SkullIcon}
                  label="Cursed pick"
                  champion={worst}
                  value={formatPercent(worst.winRate)}
                  quip="Worst win rate in the armory. Getting it is a delayed victory in waiting."
                  help={CHAMPIONS_HELP.cursed}
                />
              ) : null}
            </ul>
          ) : null}

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <SearchField
              value={search}
              onChange={(v) => {
                setSearch(v)
                reset()
              }}
              placeholder="Find a champion"
              label="Find a champion"
              className="lg:w-56"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Segmented
                label="Filter by lane"
                value={lane}
                onChange={(v) => {
                  setLane(v)
                  reset()
                }}
                options={[
                  { value: "all" as LaneFilter, label: "All" },
                  ...ALL_ROLES.map((r) => ({
                    value: r as LaneFilter,
                    label: (
                      <>
                        <LaneIcon lane={r} size={14} />
                        <span className="hidden sm:inline">{ROLE_LABELS[r]}</span>
                        <span className="sr-only sm:hidden">{ROLE_LABELS[r]}</span>
                      </>
                    ),
                  })),
                ]}
                className="flex w-full sm:w-auto"
              />
              <Segmented
                label="Sort champions by"
                value={sort}
                onChange={(v) => {
                  setSort(v)
                  reset()
                }}
                options={[
                  { value: "games", label: "Dealt" },
                  { value: "winRate", label: "Win rate" },
                  { value: "name", label: "A-Z" },
                ]}
                className="flex w-full sm:w-auto"
              />
            </div>
          </div>

          {list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--color-gold)]/20 p-6 text-center text-sm text-muted-foreground">No champion matches.</p>
          ) : (
            <ChampionGrid champions={list.slice(0, visible)} />
          )}
          {list.length > visible ? (
            <Button variant="outline" className="h-10 w-full" onClick={() => setVisible((v) => v + PAGE)}>
              <ChevronDownIcon aria-hidden />
              Show {Math.min(PAGE, list.length - visible)} more
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}
