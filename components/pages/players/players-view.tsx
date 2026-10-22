"use client"

import { useMemo, useState } from "react"
import { ChevronDownIcon, CoinsIcon, ContactRoundIcon, ZapIcon } from "lucide-react"
import { SearchField, Segmented } from "@/components/pages/controls"
import { PlayerAvatar } from "@/components/pages/avatars"
import { formatNumber, formatPercent, plural } from "@/components/pages/format"
import { rateTone } from "@/components/pages/indicators"
import { LiveStamp } from "@/components/pages/live-stamp"
import { PageHeader } from "@/components/pages/page-header"
import { useLeaderboard, useStats } from "@/components/pages/queries"
import { PageEmpty, PageError } from "@/components/pages/states"
import { useOpenProfile } from "@/components/profile/profile-provider"
import { primaryTitleOf } from "@/components/profile/title-loadout"
import { usePrefetchProfile } from "@/components/profile/use-player-profile"
import { CurseChip, MiniChip, loadoutOf } from "@/components/titles/loadout-chips"
import { CATEGORY_ICON, RARITY_TEXT, iconKeyFor } from "@/components/titles/title-visuals"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import { useRoster } from "@/lib/lobby/queries"
import { RATE_MIN_GAMES } from "@/lib/pages/constants"
import { DIRECTORY_HELP } from "@/lib/profiles/help"
import { summarizeLoadout } from "@/lib/titles/effects"
import { MAX_EQUIPPED } from "@/lib/titles/loadout"
import type { PriceTier } from "@/lib/titles/pricing"
import type { CurseBadge, EquippedTitle, LoadoutEntry } from "@/lib/titles/types"
import { cn } from "@/lib/utils"

type SortKey = "games" | "winRate" | "loadout" | "name"

const SORTS: { value: SortKey; label: string }[] = [
  { value: "games", label: "Games" },
  { value: "winRate", label: "Win rate" },
  { value: "loadout", label: "Loadout" },
  { value: "name", label: "Name" },
]

const TIER_WEIGHT: Record<PriceTier, number> = { legendary: 4, epic: 3, rare: 2, common: 1 }

interface DirectoryPlayer {
  id: string
  name: string
  active: boolean
  claimed: boolean
  userId: string | null
  username: string | null
  avatarUrl: string | null
  games: number
  wins: number
  losses: number
  winRate: number
  allTimeGames: number
  balance: number | null
  rank: number | null
  entry: EquippedTitle | undefined
  loadout: LoadoutEntry[]
  curses: CurseBadge[]
  // Tier-weighted: a legendary outweighs a handful of commons.
  richness: number
  you: boolean
}

const byName = (a: DirectoryPlayer, b: DirectoryPlayer) => a.name.localeCompare(b.name)

const COMPARE: Record<SortKey, (a: DirectoryPlayer, b: DirectoryPlayer) => number> = {
  games: (a, b) => b.games - a.games || b.allTimeGames - a.allTimeGames || byName(a, b),
  // Under RATE_MIN_GAMES a win rate is a rumour: the regulars rank first.
  winRate: (a, b) =>
    Number(b.games >= RATE_MIN_GAMES) - Number(a.games >= RATE_MIN_GAMES) ||
    Number(b.games > 0) - Number(a.games > 0) ||
    b.winRate - a.winRate ||
    b.games - a.games ||
    byName(a, b),
  loadout: (a, b) => b.richness - a.richness || b.loadout.length - a.loadout.length || b.curses.length - a.curses.length || byName(a, b),
  name: byName,
}

function useDirectory() {
  const roster = useRoster()
  const stats = useStats("current")
  const board = useLeaderboard("current")
  const { entryFor } = useEquippedTitles()
  const { user, profile } = useAuth()

  const players = useMemo(() => {
    const statById = new Map((stats.data?.players ?? []).map((p) => [p.id, p]))
    const purseById = new Map((board.data?.leaderboard ?? []).flatMap((e) => (e.player_id ? [[e.player_id, e] as const] : [])))
    return (roster.data ?? []).map((p): DirectoryPlayer => {
      const stat = statById.get(p.id)
      const purse = purseById.get(p.id)
      const userId = p.auth_user_id ?? stat?.userId ?? purse?.user_id ?? null
      const entry = entryFor(p.id, userId)
      const loadout = entry ? loadoutOf(entry) : []
      return {
        id: p.id,
        name: p.name,
        active: p.is_active,
        claimed: !!userId,
        userId,
        username: purse?.username ?? null,
        avatarUrl: stat?.avatarUrl ?? purse?.avatar_url ?? null,
        games: stat?.games ?? 0,
        wins: stat?.wins ?? 0,
        losses: stat?.losses ?? 0,
        winRate: stat?.winRate ?? 0,
        allTimeGames: p.games_played,
        balance: purse?.balance ?? null,
        rank: purse?.rank ?? null,
        entry,
        loadout,
        curses: entry?.curses ?? [],
        richness: loadout.reduce((sum, t) => sum + TIER_WEIGHT[t.tier], 0),
        you: (!!user && userId === user.id) || profile?.player_id === p.id,
      }
    })
  }, [roster.data, stats.data, board.data, entryFor, user, profile?.player_id])

  return { roster, stats, players }
}

function PlayerCard({ player }: { player: DirectoryPlayer }) {
  const open = useOpenProfile()
  const prefetch = usePrefetchProfile()
  const primary = primaryTitleOf(player.entry)
  const EpithetIcon = primary ? CATEGORY_ICON[iconKeyFor(primary.category, primary.rarity)] : null
  const summary = player.claimed ? summarizeLoadout(player.entry).text : ""

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={() => open(player.id)}
        onPointerEnter={() => prefetch(player.id)}
        onFocus={() => prefetch(player.id)}
        aria-label={`Open the court file of ${player.name}`}
        className={cn(
          "flex h-full w-full flex-col gap-2.5 rounded-2xl border bg-card p-3 text-left transition-colors outline-none hover:border-[var(--color-gold)]/40 hover:bg-[var(--color-gold)]/[0.03] focus-visible:ring-3 focus-visible:ring-[var(--color-gold)]/50 sm:p-4",
          player.you ? "border-[var(--color-gold)]/45" : "border-[var(--color-gold)]/15",
          !player.active && "opacity-80"
        )}
      >
        <span className="flex w-full min-w-0 items-center gap-3">
          <PlayerAvatar name={player.name} src={player.avatarUrl} size="lg" ring={player.claimed ? "gold" : "silver"} className="size-12" />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-display text-lg leading-tight font-semibold text-[var(--color-gold-light)]">{player.name}</span>
              {player.you ? (
                <span className="shrink-0 rounded bg-[var(--color-gold)]/15 px-1.5 py-px text-[9px] font-bold tracking-wider text-[var(--color-gold)] uppercase">
                  You
                </span>
              ) : null}
            </span>
            {primary && EpithetIcon ? (
              <span className={cn("flex min-w-0 items-center gap-1 font-display text-sm leading-tight font-semibold italic", RARITY_TEXT[primary.rarity])}>
                <EpithetIcon aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{primary.title}</span>
              </span>
            ) : null}
            <span className="block truncate text-xs text-muted-foreground">
              {player.claimed ? (player.username ? `@${player.username}` : "Claimed seat") : "Unclaimed seat"}
            </span>
          </span>
        </span>

        <span className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-[var(--color-gold)]/10 pt-2 text-xs">
          {player.games > 0 ? (
            <span className="tabular-nums">
              <span className="font-semibold text-emerald-300">{player.wins}</span>
              <span className="mx-0.5 text-muted-foreground">-</span>
              <span className="font-semibold text-rose-300">{player.losses}</span>
              <span className={cn("ml-1.5 font-semibold", rateTone(player.winRate))}>{formatPercent(player.winRate)}</span>
              <span className="ml-1.5 text-muted-foreground">{plural(player.games, "game")}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              No games this act{player.allTimeGames > 0 ? ` · ${formatNumber(player.allTimeGames)} all time` : ""}
            </span>
          )}
          {player.balance !== null ? (
            <span className="inline-flex items-center gap-1 text-[var(--color-gold-light)]/80 tabular-nums">
              <CoinsIcon aria-hidden className="size-3 text-[var(--color-gold)]" />
              {formatNumber(player.balance)}
              {player.rank ? <span className="text-muted-foreground">#{player.rank}</span> : null}
            </span>
          ) : null}
        </span>

        {player.claimed ? (
          <>
            <span className="flex w-full min-w-0 flex-wrap items-center gap-1" aria-label={`${player.loadout.length} of ${MAX_EQUIPPED} titles worn`}>
              {player.loadout.map((t) => (
                <MiniChip key={t.title} name={t.title} category={t.category} rarity={t.rarity} />
              ))}
              {player.curses.map((c) => (
                <CurseChip key={c.title} name={c.title} />
              ))}
              {player.loadout.length === 0 && player.curses.length === 0 ? (
                <span className="text-[11px] text-muted-foreground">No banner raised.</span>
              ) : (
                <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                  {player.loadout.length}/{MAX_EQUIPPED}
                </span>
              )}
            </span>
            {summary ? (
              <span className="flex w-full items-start gap-1.5 text-[11px] leading-snug text-[var(--color-gold-light)]/80">
                <ZapIcon aria-hidden className="mt-px size-3 shrink-0 text-[var(--color-gold)]" />
                <span className="line-clamp-2 min-w-0">{summary}</span>
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground">No Discord account, so no purse and no banners.</span>
        )}
      </button>
    </li>
  )
}

function CardGrid({ players }: { players: DirectoryPlayer[] }) {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
      {players.map((p) => (
        <PlayerCard key={p.id} player={p} />
      ))}
    </ul>
  )
}

function DirectorySkeleton() {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3" aria-busy="true" aria-label="Calling the roll">
      {Array.from({ length: 9 }, (_, i) => (
        <Skeleton key={i} className="h-44 rounded-2xl" />
      ))}
    </div>
  )
}

export function PlayersView() {
  const { roster, stats, players } = useDirectory()
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("games")
  const [benchOpen, setBenchOpen] = useState(false)

  const { active, benched } = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const shown = players.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.username?.toLowerCase().includes(needle))
    const sorted = [...shown].sort(COMPARE[sort])
    return { active: sorted.filter((p) => p.active), benched: sorted.filter((p) => !p.active) }
  }, [players, search, sort])

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        eyebrow="The royal register"
        title="Players"
        description="Every noble at court: their record this act, their purse and the titles they wear into battle. Tap a card for the full file."
        help={DIRECTORY_HELP}
        actions={<LiveStamp updatedAt={Math.max(roster.dataUpdatedAt, stats.dataUpdatedAt)} fetching={roster.isFetching && !roster.isPending} />}
      />

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <SearchField value={search} onChange={setSearch} placeholder="Find a player" label="Find a player" className="md:w-64" />
        <Segmented label="Sort by" value={sort} onChange={setSort} options={SORTS} className="flex w-full md:w-auto" />
      </div>

      {roster.isPending ? (
        <DirectorySkeleton />
      ) : !roster.data ? (
        <PageError
          title="The royal register is locked"
          message={roster.error?.message}
          onRetry={() => void roster.refetch()}
          retrying={roster.isFetching}
        />
      ) : players.length === 0 ? (
        <PageEmpty icon={ContactRoundIcon} title="An empty court">
          Nobody is on the roster yet. The lobby adds the first noble.
        </PageEmpty>
      ) : (
        <>
          <section aria-labelledby="roster-active" className="space-y-2">
            <h2 id="roster-active" className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              On the roster · {active.length}
            </h2>
            {active.length > 0 ? (
              <CardGrid players={active} />
            ) : (
              <p className="rounded-2xl border border-dashed border-[var(--color-gold)]/20 p-6 text-center text-sm text-muted-foreground">
                Nobody by that name. Try another, or check the bench.
              </p>
            )}
          </section>

          {benched.length > 0 ? (
            <Collapsible open={benchOpen || !!search.trim()} onOpenChange={setBenchOpen} className="space-y-2">
              <CollapsibleTrigger className="group flex h-10 w-full items-center gap-2 rounded-lg px-1 text-left text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase outline-none hover:text-[var(--color-gold-light)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60">
                <ChevronDownIcon aria-hidden className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
                On the bench · {benched.length}
                <span className="font-normal tracking-normal normal-case">not in the lobby rotation</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardGrid players={benched} />
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </>
      )}
    </div>
  )
}
