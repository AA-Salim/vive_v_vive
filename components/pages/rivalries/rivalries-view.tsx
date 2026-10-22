"use client"

import { useMemo, useState } from "react"
import { ScaleIcon, SkullIcon, SwordsIcon, type LucideIcon } from "lucide-react"
import { ArchNemesisCard } from "@/components/arch-nemesis-card"
import { RivalryDetailDialog } from "@/components/rivalry-detail-dialog"
import { RivalryMatrix } from "@/components/rivalry-matrix"
import { PlayerAvatar } from "@/components/pages/avatars"
import { PlayerSelect, Segmented } from "@/components/pages/controls"
import { plural } from "@/components/pages/format"
import { LiveStamp } from "@/components/pages/live-stamp"
import { PageHeader } from "@/components/pages/page-header"
import { useRivalries } from "@/components/pages/queries"
import { FeudList } from "@/components/pages/rivalries/feud-list"
import { archNemesisOf, feudsOf, highlightsOf, type Highlight } from "@/components/pages/rivalries/rivalry-math"
import { PageEmpty, PageError, SectionCard } from "@/components/pages/states"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import type { PlayerRef } from "@/lib/pages/types"

const HIGHLIGHT_ICON: Record<string, LucideIcon> = { most: SwordsIcon, lopsided: SkullIcon, closest: ScaleIcon }
const MATRIX_SIZE = 14

function HighlightCard({ highlight, players, onOpen }: { highlight: Highlight; players: Map<string, PlayerRef>; onOpen: () => void }) {
  const leader = players.get(highlight.leader)
  const trailer = players.get(highlight.trailer)
  if (!leader || !trailer) return null
  const Icon = HIGHLIGHT_ICON[highlight.id] ?? SwordsIcon
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full flex-col gap-3 rounded-xl border border-[var(--color-gold)]/20 bg-card p-3 text-left transition-colors outline-none hover:border-[var(--color-gold)]/40 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-[var(--color-gold)] uppercase">
        <Icon className="size-3.5" aria-hidden />
        {highlight.label}
      </span>
      <span className="flex items-center gap-2">
        <span className="flex -space-x-2">
          <PlayerAvatar name={leader.name} src={leader.avatarUrl} size="sm" className="ring-2 ring-card" />
          <PlayerAvatar name={trailer.name} src={trailer.avatarUrl} size="sm" className="ring-2 ring-card" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-gold-light)]">
          {leader.name} <span className="font-normal text-muted-foreground">vs</span> {trailer.name}
        </span>
        <span className="font-display text-lg font-semibold text-[var(--color-gold-light)] tabular-nums">{highlight.score}</span>
      </span>
      <span className="text-[11px] text-muted-foreground">
        {highlight.quip} {plural(highlight.rivalry.games, "game")}.
      </span>
    </button>
  )
}

function RivalriesSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Opening the feud files">
      <Skeleton className="h-72 w-full rounded-2xl" />
      <div className="grid gap-2 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  )
}

export function RivalriesView() {
  const query = useRivalries()
  const { profile } = useAuth()
  const [picked, setPicked] = useState<string | null>(null)
  const [pair, setPair] = useState<[string, string] | null>(null)
  const [matrixScope, setMatrixScope] = useState<"regulars" | "everyone">("regulars")
  const data = query.data

  const players = useMemo(() => new Map((data?.players ?? []).map((p) => [p.id, p])), [data])
  const gamesOf = useMemo(() => {
    const totals = new Map<string, number>()
    for (const r of data?.rivalries ?? []) {
      totals.set(r.a, (totals.get(r.a) ?? 0) + r.games)
      totals.set(r.b, (totals.get(r.b) ?? 0) + r.games)
    }
    return totals
  }, [data])
  const byActivity = useMemo(
    () => [...(data?.players ?? [])].sort((x, y) => (gamesOf.get(y.id) ?? 0) - (gamesOf.get(x.id) ?? 0)),
    [data, gamesOf]
  )

  const own = profile?.player_id && players.has(profile.player_id) ? profile.player_id : null
  const focus = picked ?? own ?? byActivity[0]?.id ?? null
  const feuds = useMemo(() => (focus && data ? feudsOf(data.rivalries, focus) : []), [data, focus])
  const nemesis = archNemesisOf(data?.rivalries ?? [])
  const highlights = useMemo(() => highlightsOf(data?.rivalries ?? []), [data])
  const matrixPlayers = matrixScope === "regulars" ? byActivity.slice(0, MATRIX_SIZE) : byActivity
  const focusPlayer = focus ? players.get(focus) ?? null : null
  const sortedNames = useMemo(() => [...(data?.players ?? [])].sort((x, y) => x.name.localeCompare(y.name)), [data])

  const openPair = (x: string, y: string) => setPair(x < y ? [x, y] : [y, x])

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        eyebrow="Blood Feuds"
        title="Rivalries"
        description="Who beats whom, lane by lane. Grudges are permanent. So is the match history."
        actions={<LiveStamp updatedAt={query.dataUpdatedAt} fetching={query.isFetching && !query.isPending} />}
      />

      {query.isPending ? (
        <RivalriesSkeleton />
      ) : !data ? (
        <PageError title="The feud files are sealed" message={query.error?.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : data.rivalries.length === 0 ? (
        <PageEmpty icon={SwordsIcon} title="No feuds yet">
          Rivalries start the moment two people land on opposite sides. Go start one.
        </PageEmpty>
      ) : (
        <>
          {nemesis && players.get(nemesis.a) && players.get(nemesis.b) ? (
            <ArchNemesisCard
              rivalry={nemesis}
              a={players.get(nemesis.a) as PlayerRef}
              b={players.get(nemesis.b) as PlayerRef}
              onOpen={() => openPair(nemesis.a, nemesis.b)}
            />
          ) : null}

          {highlights.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-3">
              {highlights.map((h) => (
                <li key={h.id}>
                  <HighlightCard highlight={h} players={players} onOpen={() => openPair(h.rivalry.a, h.rivalry.b)} />
                </li>
              ))}
            </ul>
          ) : null}

          <SectionCard
            id="feud-finder"
            eyebrow="Feud finder"
            title={focusPlayer ? `${focusPlayer.name} against the court` : "Pick a player"}
            description={focusPlayer ? `${plural(feuds.length, "opponent")}, most frequent first. Tap one for every game they played.` : undefined}
            action={<PlayerSelect value={focus} onChange={setPicked} players={sortedNames} label="Show the feuds of" everyoneLabel={own ? "Back to me" : "Most active player"} className="w-48" />}
          >
            {feuds.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No opponents yet.</p>
            ) : (
              <FeudList feuds={feuds} players={players} onOpen={(opponent) => focus && openPair(focus, opponent)} />
            )}
          </SectionCard>

          <SectionCard
            id="war-table"
            eyebrow="The war table"
            title="Everyone against everyone"
            description="Each cell reads as the row player's record against the column player."
            className="hidden lg:block"
            action={
              <Segmented
                label="Players in the table"
                value={matrixScope}
                onChange={setMatrixScope}
                options={[
                  { value: "regulars", label: `Top ${MATRIX_SIZE}` },
                  { value: "everyone", label: "Everyone" },
                ]}
              />
            }
          >
            <RivalryMatrix players={matrixPlayers} rivalries={data.rivalries} onSelect={openPair} focus={focus} />
          </SectionCard>
        </>
      )}

      <RivalryDetailDialog
        open={pair !== null}
        onOpenChange={(open) => !open && setPair(null)}
        playerAId={pair?.[0] ?? null}
        playerBId={pair?.[1] ?? null}
        playerAName={pair ? players.get(pair[0])?.name ?? "" : ""}
        playerBName={pair ? players.get(pair[1])?.name ?? "" : ""}
      />
    </div>
  )
}
