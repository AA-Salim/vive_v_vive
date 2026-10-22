"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChevronDownIcon, HistoryIcon } from "lucide-react"
import { useLiveSignal } from "@/components/live/live-context"
import { PlayerSelect } from "@/components/pages/controls"
import { formatDay, localDayKey, plural } from "@/components/pages/format"
import { FormDots, StreakChip, WinRateMeter } from "@/components/pages/indicators"
import { LiveStamp } from "@/components/pages/live-stamp"
import { MatchCard } from "@/components/pages/history/match-card"
import { PageHeader } from "@/components/pages/page-header"
import { PAGE_KEYS, useHistory, useStats } from "@/components/pages/queries"
import { PageEmpty, PageError } from "@/components/pages/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { HistoryGame } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Night {
  key: string
  label: string
  games: HistoryGame[]
  blue: number
  red: number
}

function groupNights(games: HistoryGame[]): Night[] {
  const nights: Night[] = []
  for (const game of games) {
    const key = localDayKey(game.playedAt)
    let night = nights[nights.length - 1]
    if (!night || night.key !== key) {
      night = { key, label: formatDay(game.playedAt), games: [], blue: 0, red: 0 }
      nights.push(night)
    }
    night.games.push(game)
    night[game.winner]++
  }
  return nights
}

function HistorySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Unrolling the chronicle">
      <Skeleton className="h-5 w-48" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-2xl" />
      ))}
    </div>
  )
}

export function HistoryView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requested = searchParams.get("player")
  const playerId = requested && PLAYER_ID.test(requested) ? requested : null
  const reduced = useReducedMotion()
  const queryClient = useQueryClient()

  const stats = useStats()
  const history = useHistory(playerId)
  const games = useMemo(() => history.data?.pages.flatMap((p) => p.games) ?? [], [history.data])
  const nights = useMemo(() => groupNights(games), [games])
  const focus = playerId ? stats.data?.players.find((p) => p.id === playerId) ?? null : null
  const players = useMemo(() => {
    const list: { id: string; name: string }[] = [...(stats.data?.players ?? [])]
    if (playerId && !list.some((p) => p.id === playerId)) {
      const seat = games.flatMap((g) => g.players).find((p) => p.playerId === playerId)
      if (seat) list.push({ id: seat.playerId, name: seat.name })
    }
    return list.sort((x, y) => x.name.localeCompare(y.name))
  }, [stats.data, playerId, games])

  // The Tribunal's MVP and Inter land after the game itself: refresh the verdicts the moment the vote closes.
  useLiveSignal((signal) => {
    if (signal.kind === "event" && signal.event.type === "vote.closed") {
      void queryClient.invalidateQueries({ queryKey: PAGE_KEYS.history(playerId) })
    }
  })

  const setPlayer = (next: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set("player", next)
    else params.delete("player")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        eyebrow="The Chronicle"
        title="Match History"
        description="Every game ever played on the Rift. Every gank, every throw, every delayed victory."
        actions={<LiveStamp updatedAt={history.dataUpdatedAt} fetching={history.isFetching && !history.isPending && !history.isFetchingNextPage} />}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PlayerSelect value={playerId} onChange={setPlayer} players={players} label="Show the games of" everyoneLabel="Every match" className="w-full sm:w-56" />
        {focus ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[var(--color-gold-light)]/80">
            <span className="font-semibold text-[var(--color-gold-light)] tabular-nums">
              {focus.wins}W {focus.losses}L
            </span>
            <WinRateMeter rate={focus.winRate} games={focus.games} />
            <FormDots form={focus.form} />
            <StreakChip streak={focus.streak} />
          </div>
        ) : stats.data ? (
          <p className="text-sm text-muted-foreground">
            {plural(stats.data.totals.games, "game")} · Blue {stats.data.totals.blueWins} - {stats.data.totals.redWins} Red
          </p>
        ) : null}
      </div>

      {history.isPending ? (
        <HistorySkeleton />
      ) : history.isError && games.length === 0 ? (
        <PageError
          title="The chronicle is smudged"
          message={history.error.message}
          onRetry={() => void history.refetch()}
          retrying={history.isFetching}
        />
      ) : games.length === 0 ? (
        <PageEmpty icon={HistoryIcon} title={focus ? `${focus.name} has not played yet` : "No games played yet"}>
          {focus ? "His chapter of the chronicle is still blank." : "The first game will be written here the moment a winner is declared."}
        </PageEmpty>
      ) : (
        <div className={cn("space-y-6 transition-opacity", history.isPlaceholderData && "opacity-60")}>
          {nights.map((night) => (
            <section key={night.key} aria-label={night.label} className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2 border-b border-[var(--color-gold)]/10 pb-1.5">
                <h2 className="font-display text-base font-semibold text-[var(--color-gold-light)] sm:text-lg">{night.label}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {plural(night.games.length, "game")} · <span className="text-[var(--color-blue-team)]">{night.blue}</span>
                  {" - "}
                  <span className="text-[var(--color-red-team)]">{night.red}</span>
                </span>
              </div>
              <ol className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {night.games.map((game) => (
                    <motion.li
                      key={game.id}
                      initial={reduced ? false : { opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35 }}
                    >
                      <MatchCard game={game} defaultOpen={game.id === games[0]?.id} highlight={playerId} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            </section>
          ))}

          {history.hasNextPage ? (
            <Button
              variant="outline"
              className="h-11 w-full"
              disabled={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            >
              <ChevronDownIcon className={cn(history.isFetchingNextPage && "animate-bounce")} aria-hidden />
              {history.isFetchingNextPage ? "Unrolling older pages..." : "Older games"}
            </Button>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {focus ? `That is every game ${focus.name} ever played.` : "You have reached the first page of the chronicle."}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
