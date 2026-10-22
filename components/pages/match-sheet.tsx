"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { HistoryIcon, ScrollTextIcon } from "lucide-react"
import { formatDay, formatTime } from "@/components/pages/format"
import { MatchCard } from "@/components/pages/history/match-card"
import { PageApiError, useGameDetail } from "@/components/pages/queries"
import { PageError } from "@/components/pages/states"
import { seasonKeyOf, withSeason } from "@/components/pages/use-season"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { seasonShort } from "@/lib/pages/season-calendar"
import type { HistoryGame, PlayerRef } from "@/lib/pages/types"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

const SIDE_LABEL: Record<Side, string> = { blue: "Blue", red: "Red" }
const SIDE_CHIP: Record<Side, string> = {
  blue: "bg-[var(--color-blue-team)]/15 text-[var(--color-blue-team)] ring-[var(--color-blue-team)]/35",
  red: "bg-[var(--color-red-team)]/15 text-[var(--color-red-team)] ring-[var(--color-red-team)]/35",
}

export interface MatchPreview {
  gameId: string
  playedAt: string
  winner: Side
}

const names = (list: string[]) =>
  list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`

// Who stood where: the side of each focused player first, with the teammates they shared it with.
function Sides({ game, focus }: { game: HistoryGame; focus: PlayerRef[] }) {
  const first = game.players.find((p) => p.playerId === focus[0]?.id)?.side ?? "blue"
  const order: Side[] = first === "blue" ? ["blue", "red"] : ["red", "blue"]
  const focusIds = new Set(focus.map((f) => f.id))
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Who played on each side">
      {order.map((side) => {
        const leads = focus.filter((f) => game.players.some((p) => p.playerId === f.id && p.side === side))
        const others = game.players.filter((p) => p.side === side && !focusIds.has(p.playerId)).map((p) => p.name)
        const won = game.winner === side
        const heading =
          leads.length > 1
            ? `${names(leads.map((l) => l.name))} together`
            : leads.length === 1
              ? `${leads[0].name}'s side`
              : focus.length === 1
                ? `Against ${focus[0].name}`
                : "Against them"
        return (
          <li key={side} className="min-w-0 rounded-xl border border-[var(--color-gold)]/12 bg-[var(--color-navy)]/50 p-3">
            <p className="flex items-center gap-2">
              <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-bold tracking-wide uppercase ring-1", SIDE_CHIP[side])}>
                {SIDE_LABEL[side]}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-gold)]">{heading}</span>
              <span className={cn("shrink-0 text-[11px] font-bold tracking-wide uppercase", won ? "text-emerald-300" : "text-rose-300")}>
                {won ? "Victory" : "Defeat"}
              </span>
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-gold-light)]/80">
              {others.length === 0 ? "Nobody else on record." : leads.length > 0 ? `With ${names(others)}.` : `${names(others)}.`}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

function SheetBody({ gameId, focus, onLeave }: { gameId: string; focus: PlayerRef[]; onLeave: () => void }) {
  const detail = useGameDetail(gameId)
  const queryClient = useQueryClient()
  const gone = detail.error instanceof PageApiError && detail.error.status === 404
  const refreshed = useRef<string | null>(null)

  // A game removed from the chronicle (a double-recorded copy) still sits in lists fetched before: refresh them once.
  useEffect(() => {
    if (!gone || refreshed.current === gameId) return
    refreshed.current = gameId
    void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "games" && q.queryKey[1] !== "game" })
  }, [gone, gameId, queryClient])

  if (detail.isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Unrolling the match">
        <div className="grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    )
  }
  if (gone) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--color-gold)]/25 px-4 py-8 text-center">
        <ScrollTextIcon className="size-5 text-[var(--color-gold)]/80" aria-hidden />
        <p className="font-display text-base font-semibold text-[var(--color-gold)]">This game is no longer in the chronicle</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          It was most likely a copy recorded twice by accident, and the scribes struck it out. The real game still counts once.
        </p>
      </div>
    )
  }
  if (!detail.data) {
    return <PageError title="The match scroll is torn" message={detail.error?.message} onRetry={() => void detail.refetch()} retrying={detail.isFetching} className="py-6" />
  }

  const { game, season } = detail.data
  return (
    <div className="space-y-4">
      <Sides game={game} focus={focus} />
      <MatchCard game={game} defaultOpen highlight={focus.map((f) => f.id)} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{season ? `Played in ${seasonShort(season)} · ${season.name}` : "Played between two acts"}</p>
        <Link
          href={withSeason("/history", seasonKeyOf(season), new URLSearchParams({ game: game.id }))}
          onClick={onLeave}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border sm:w-auto border-[var(--color-gold)]/25 px-3 text-sm font-medium text-[var(--color-gold-light)] transition-colors outline-none hover:bg-[var(--color-gold)]/10 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <HistoryIcon className="size-4" aria-hidden />
          Open in history
        </Link>
      </div>
    </div>
  )
}

interface MatchSheetProps {
  // What the opening list already knows, so the header shows at once.
  match: MatchPreview | null
  onClose: () => void
  // Players to highlight: the first one's side is listed first.
  focus: PlayerRef[]
}

// The full match behind one row of a feud or duo list: both teams, lanes, champions and the verdict.
export function MatchSheet({ match: requested, onClose, focus }: MatchSheetProps) {
  // The last match stays on screen while the sheet animates out.
  const [match, setMatch] = useState(requested)
  if (requested && requested !== match) setMatch(requested)

  return (
    <Dialog open={requested !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] p-0 sm:max-w-2xl">
        {match ? (
          <>
            <DialogHeader className="border-b border-[var(--color-gold)]/10 p-4 pr-12">
              <DialogTitle className="font-display text-lg font-semibold text-[var(--color-gold-light)]">
                {SIDE_LABEL[match.winner]} victory
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {formatDay(match.playedAt)} at {formatTime(match.playedAt)}
              </DialogDescription>
            </DialogHeader>
            <div className="p-4">
              <SheetBody key={match.gameId} gameId={match.gameId} focus={focus} onLeave={onClose} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
