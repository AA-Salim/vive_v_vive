"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowRightIcon, CoinsIcon, CrownIcon, HandHeartIcon, ScaleIcon, ScrollTextIcon, TrendingDownIcon, UsersIcon } from "lucide-react"
import { KissBoard } from "@/components/leaderboard-kisses"
import { displayName, LeaderboardPodium } from "@/components/leaderboard-podium"
import { LeaderboardTable } from "@/components/leaderboard-table"
import { useLiveSignal } from "@/components/live/live-context"
import { PlayerAvatar } from "@/components/pages/avatars"
import { formatNumber, plural } from "@/components/pages/format"
import { LiveStamp } from "@/components/pages/live-stamp"
import { PageHeader } from "@/components/pages/page-header"
import { PlayerSheet } from "@/components/pages/player-sheet"
import { PAGE_KEYS, useLeaderboard } from "@/components/pages/queries"
import { SeasonPicker, TREASURY_HELP } from "@/components/pages/season-picker"
import { PageEmpty, PageError } from "@/components/pages/states"
import { TotalTiles } from "@/components/pages/total-tiles"
import { InfoTip } from "@/components/ui/info-tip"
import { useSeasonParam, type SeasonKey } from "@/components/pages/use-season"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthUser } from "@/hooks/use-auth"
import { domainOf, type LiveDomain } from "@/lib/live/events"
import { COURT_LIST_HELP, LEADERBOARD_HELP, TREASURY_TOTALS_HELP } from "@/lib/pages/help"
import type { LeaderboardEntry, PlayerRef } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

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

function TreasuryTotals({ entries, sealed }: { entries: LeaderboardEntry[]; sealed: boolean }) {
  const total = entries.reduce((sum, e) => sum + e.balance, 0)
  const debtors = entries.filter((e) => e.balance < 0).length
  const moved = entries.reduce((sum, e) => sum + Math.abs(e.delta_24h), 0)
  return (
    <TotalTiles
      items={[
        { icon: CoinsIcon, label: sealed ? "Final treasury" : "Coin in play", value: formatNumber(total), help: TREASURY_TOTALS_HELP.coin },
        sealed
          ? {
              icon: UsersIcon,
              label: "Nobles",
              value: formatNumber(entries.length),
              help: { title: "Nobles", does: "How many players held a treasury when this act was sealed.", cost: "Free to look at." },
            }
          : { icon: ScaleIcon, label: "Moved today", value: formatNumber(moved), help: TREASURY_TOTALS_HELP.moved },
        {
          icon: TrendingDownIcon,
          label: "In debt",
          value: debtors === 0 ? "Nobody" : plural(debtors, "noble"),
          help: TREASURY_TOTALS_HELP.debt,
        },
      ]}
    />
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

type Board = "treasury" | "kisses"

const BOARD_PARAM = "board"

// The board stays in the URL (?board=kisses) so the Hall of Kisses can be linked; the treasury needs no param.
function useBoardParam(): [Board, (next: Board) => void] {
  const pathname = usePathname()
  const board: Board = useSearchParams().get(BOARD_PARAM) === "kisses" ? "kisses" : "treasury"
  const setBoard = useCallback(
    (next: Board) => {
      const params = new URLSearchParams(window.location.search)
      if (next === "kisses") params.set(BOARD_PARAM, next)
      else params.delete(BOARD_PARAM)
      const query = params.toString()
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname)
    },
    [pathname]
  )
  return [board, setBoard]
}

const TAB_TRIGGER = "h-10 flex-1 px-3 text-sm data-active:text-[var(--color-gold-light)] sm:flex-none sm:px-5"

export function LeaderboardView() {
  const [board, setBoard] = useBoardParam()
  const [picked, setSeason] = useSeasonParam()
  return (
    <Tabs value={board} onValueChange={(value) => setBoard(value as Board)} className="mx-auto max-w-5xl gap-6">
      <TabsList className="h-12 w-full bg-[var(--color-navy-light)] p-1 sm:w-fit">
        <TabsTrigger value="treasury" className={TAB_TRIGGER}>
          <CoinsIcon aria-hidden />
          The Treasury
        </TabsTrigger>
        <TabsTrigger value="kisses" className={TAB_TRIGGER}>
          <HandHeartIcon aria-hidden />
          Hall of Kisses
        </TabsTrigger>
      </TabsList>
      <TabsContent value="treasury" className="space-y-6">
        <TreasuryBoard picked={picked} setSeason={setSeason} />
      </TabsContent>
      <TabsContent value="kisses" className="space-y-6">
        <KissBoard season={picked} onSeasonChange={setSeason} />
      </TabsContent>
    </Tabs>
  )
}

function TreasuryBoard({ picked, setSeason }: { picked: SeasonKey; setSeason: (next: SeasonKey) => void }) {
  // Balances restart every act, so the treasury has no all-time view: "all" from another tab reads the live act.
  const season = picked === "all" ? "current" : picked
  const query = useLeaderboard(season)
  const sealed = query.data?.sealed ?? false
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
    <>
      <PageHeader
        eyebrow="The kingdom"
        title="The Treasury"
        description="Every coin in the kingdom, counted twice. Salaxe counts it a third time, in his little notebook."
        help={LEADERBOARD_HELP}
        actions={<LiveStamp updatedAt={query.dataUpdatedAt} fetching={query.isFetching && !query.isPending} />}
      />
      <div className="flex flex-wrap items-center gap-2">
        <SeasonPicker value={season} onChange={setSeason} served={query.data?.season} allowAll={false} help={TREASURY_HELP} className="w-full sm:w-auto" />
        {sealed && act ? (
          <Link
            href={`/archives/${act.id}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--color-gold)]/25 px-3 text-sm font-medium text-[var(--color-gold-light)] transition-colors outline-none hover:bg-[var(--color-gold)]/10 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ScrollTextIcon className="size-4" aria-hidden />
            The act&apos;s full archive
          </Link>
        ) : null}
        {picked === "all" ? (
          <p className="w-full text-xs text-muted-foreground">The treasury restarts with every act, so it has no all-time view. Here is the act being played.</p>
        ) : null}
      </div>

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
        sealed ? (
          <PageEmpty icon={ScrollTextIcon} title="No standings were sealed">
            This act closed without a final count of the treasury. Its games still live in the stats and the history.
          </PageEmpty>
        ) : (
          <PageEmpty icon={CrownIcon} title="The vault is empty">
            No coin has changed hands yet. Sign in, claim your daily stipend and play a game to open the books.
          </PageEmpty>
        )
      ) : (
        <>
          <LeaderboardPodium entries={entries.slice(0, 3)} onOpen={setOpen} />
          <TreasuryTotals entries={entries} sealed={sealed} />
          {sealed ? null : <YourStanding entries={entries} />}
          {entries.length > 3 ? (
            <section aria-labelledby="court-title" className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <h2 id="court-title" className="font-display text-lg font-semibold text-[var(--color-gold-light)]">
                    The rest of the court
                  </h2>
                  <InfoTip help={COURT_LIST_HELP} />
                </div>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {sealed ? "Final standings, sealed when the act closed" : "Arrows: movement in the last 24 hours"}
                </span>
              </div>
              <LeaderboardTable entries={entries.slice(3)} onOpen={setOpen} sealed={sealed} />
            </section>
          ) : null}
        </>
      )}
      <PlayerSheet player={open} onClose={() => setOpen(null)} season={season} />
    </>
  )
}
