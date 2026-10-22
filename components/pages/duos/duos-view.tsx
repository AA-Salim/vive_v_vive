"use client"

import { useMemo, useState } from "react"
import { ChevronDownIcon, HeartCrackIcon, HeartHandshakeIcon, UsersIcon } from "lucide-react"
import { DuoList } from "@/components/duo-list"
import { DuoShowcaseCard } from "@/components/duo-showcase-card"
import { RivalryDetailDialog } from "@/components/rivalry-detail-dialog"
import { PlayerSelect, SearchField, Segmented } from "@/components/pages/controls"
import { DuoHonors, PartnerColumn } from "@/components/pages/duos/duo-sections"
import { plural } from "@/components/pages/format"
import { LiveStamp } from "@/components/pages/live-stamp"
import { PageHeader } from "@/components/pages/page-header"
import { useDuos } from "@/components/pages/queries"
import { PageEmpty, PageError, SectionCard } from "@/components/pages/states"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { DUO_MIN_GAMES } from "@/lib/pages/constants"
import { duosHelp } from "@/lib/pages/help"
import type { Duo } from "@/lib/pages/types"

type Sort = "wins" | "winRate" | "games"
const PAGE = 30

function DuosSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Pairing everyone up">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )
}

export function DuosView() {
  const query = useDuos()
  const { profile } = useAuth()
  const [scope, setScope] = useState<"regulars" | "everyone">("regulars")
  const [sort, setSort] = useState<Sort>("wins")
  const [search, setSearch] = useState("")
  const [visible, setVisible] = useState(PAGE)
  const [picked, setPicked] = useState<string | null>(null)
  const [open, setOpen] = useState<Duo | null>(null)
  const data = query.data

  const players = useMemo(() => new Map((data?.players ?? []).map((p) => [p.id, p])), [data])
  const sortedNames = useMemo(() => [...(data?.players ?? [])].sort((x, y) => x.name.localeCompare(y.name)), [data])
  const minGames = data?.minGames ?? DUO_MIN_GAMES
  const help = useMemo(() => duosHelp(minGames), [minGames])
  const showcase = useMemo(() => (data?.duos ?? []).filter((d) => d.headline).slice(0, 3), [data])
  const honors = useMemo(() => (data?.duos ?? []).flatMap((d) => d.badges.map((badge) => ({ duo: d, badge }))), [data])

  const busiest = useMemo(() => {
    const games = new Map<string, number>()
    for (const d of data?.duos ?? []) {
      games.set(d.a, (games.get(d.a) ?? 0) + d.games)
      games.set(d.b, (games.get(d.b) ?? 0) + d.games)
    }
    return [...games.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null
  }, [data])
  const own = profile?.player_id && players.has(profile.player_id) ? profile.player_id : null
  const focus = picked ?? own ?? busiest
  const focusPlayer = focus ? players.get(focus) ?? null : null
  const partners = useMemo(
    () => (focus ? (data?.duos ?? []).filter((d) => (d.a === focus || d.b === focus) && d.games >= minGames) : []),
    [data, focus, minGames]
  )
  const lucky = [...partners].sort((x, y) => y.winRate - x.winRate || y.games - x.games).slice(0, 3)
  const omens = [...partners]
    .sort((x, y) => x.winRate - y.winRate || y.games - x.games)
    .filter((d) => !lucky.includes(d) && d.winRate < 50)
    .slice(0, 3)

  const list = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = (data?.duos ?? []).filter((d) => {
      if (scope === "regulars" && d.games < minGames) return false
      if (!needle) return true
      return [players.get(d.a)?.name, players.get(d.b)?.name].some((n) => n?.toLowerCase().includes(needle))
    })
    return [...filtered].sort((x, y) => y[sort] - x[sort] || y.games - x.games)
  }, [data, scope, search, sort, minGames, players])

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        eyebrow="Better Together"
        title="Duos"
        description="Same team, same fate. Who carries, who gets carried, and who should never queue together again."
        help={help.page}
        actions={<LiveStamp updatedAt={query.dataUpdatedAt} fetching={query.isFetching && !query.isPending} />}
      />

      {query.isPending ? (
        <DuosSkeleton />
      ) : !data ? (
        <PageError title="The pairing book is lost" message={query.error?.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : data.duos.length === 0 ? (
        <PageEmpty icon={UsersIcon} title="No duos yet">
          Duos form the moment two people win or lose on the same side. Play a game.
        </PageEmpty>
      ) : (
        <>
          {showcase.length > 0 ? (
            <ul className="grid gap-3 md:grid-cols-3">
              {showcase.map((duo, i) => {
                const a = players.get(duo.a)
                const b = players.get(duo.b)
                return a && b ? (
                  <li key={`${duo.a}:${duo.b}`} className={i === 0 ? "md:order-2" : i === 1 ? "md:order-1" : "md:order-3"}>
                    <DuoShowcaseCard duo={duo} a={a} b={b} rank={i + 1} onOpen={() => setOpen(duo)} />
                  </li>
                ) : null
              })}
            </ul>
          ) : null}

          <DuoHonors honors={honors} players={players} onOpen={setOpen} />

          {focus && focusPlayer ? (
            <SectionCard
              id="partner-finder"
              eyebrow="Partner finder"
              title={`Who should ${focusPlayer.name} queue with?`}
              description={`Based on ${plural(partners.length, "partner")} with ${minGames}+ games together.`}
              help={help.partners}
              action={<PlayerSelect value={focus} onChange={setPicked} players={sortedNames} label="Find partners for" everyoneLabel={own ? "Back to me" : "Most active player"} className="w-48" />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <PartnerColumn title="Lucky charms" icon={HeartHandshakeIcon} duos={lucky} playerId={focus} players={players} onOpen={setOpen} empty="Not enough games together yet." />
                <PartnerColumn title="Bad omens" icon={HeartCrackIcon} duos={omens} playerId={focus} players={players} onOpen={setOpen} empty="Nobody drags him down. Suspicious." />
              </div>
            </SectionCard>
          ) : null}

          <section aria-labelledby="all-duos-title" className="space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 id="all-duos-title" className="font-display text-lg font-semibold text-[var(--color-gold-light)]">
                    Every pairing
                  </h2>
                  <InfoTip help={help.list} />
                </div>
                <p className="text-xs text-muted-foreground">{plural(list.length, "duo")} · tap one for every game they shared</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <SearchField
                  value={search}
                  onChange={(value) => {
                    setSearch(value)
                    setVisible(PAGE)
                  }}
                  placeholder="Find a duo"
                  label="Find a duo by player name"
                  className="sm:w-48"
                />
                <Segmented
                  label="Sort duos by"
                  value={sort}
                  onChange={(value) => {
                    setSort(value)
                    setVisible(PAGE)
                  }}
                  options={[
                    { value: "wins", label: "Wins" },
                    { value: "winRate", label: "Win rate" },
                    { value: "games", label: "Games" },
                  ]}
                />
                <Segmented
                  label="Which duos"
                  value={scope}
                  onChange={(value) => {
                    setScope(value)
                    setVisible(PAGE)
                  }}
                  options={[
                    { value: "regulars", label: `${minGames}+ games` },
                    { value: "everyone", label: "All" },
                  ]}
                />
              </div>
            </div>
            {list.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--color-gold)]/20 p-6 text-center text-sm text-muted-foreground">
                No duo matches. Try another name.
              </p>
            ) : (
              <DuoList duos={list.slice(0, visible)} players={players} onOpen={setOpen} />
            )}
            {list.length > visible ? (
              <Button variant="outline" className="h-10 w-full" onClick={() => setVisible((v) => v + PAGE)}>
                <ChevronDownIcon aria-hidden />
                Show {Math.min(PAGE, list.length - visible)} more
              </Button>
            ) : null}
          </section>
        </>
      )}

      <RivalryDetailDialog
        open={open !== null}
        onOpenChange={(next) => !next && setOpen(null)}
        playerAId={open?.a ?? null}
        playerBId={open?.b ?? null}
        playerAName={open ? players.get(open.a)?.name ?? "" : ""}
        playerBName={open ? players.get(open.b)?.name ?? "" : ""}
        initialView="allied"
      />
    </div>
  )
}
