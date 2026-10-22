"use client"

import { useState } from "react"
import { HandshakeIcon, SwordsIcon } from "lucide-react"
import { LaneIcon } from "@/components/lane-icon"
import { ChampionIcon, PlayerAvatar } from "@/components/pages/avatars"
import { Segmented } from "@/components/pages/controls"
import { formatShortDay, plural } from "@/components/pages/format"
import { useRivalryDetail } from "@/components/pages/queries"
import { PageError } from "@/components/pages/states"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { ROLE_LABELS } from "@/lib/champions"
import type { MatchupGame, MatchupSide, RivalryDetailResponse } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

export type PairView = "versus" | "allied"

interface RivalryDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  playerAId: string | null
  playerBId: string | null
  playerAName: string
  playerBName: string
  initialView?: PairView
}

function Seat({ seat, won, align }: { seat: MatchupSide; won: boolean; align: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <ChampionIcon name={seat.champion} internal={seat.internal} size={36} side={seat.side} dimmed={!won} />
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-medium", won ? "text-[var(--color-gold-light)]" : "text-muted-foreground")}>{seat.champion}</p>
        <p className={cn("flex items-center gap-1 text-[11px] text-muted-foreground", align === "right" && "justify-end")}>
          <LaneIcon lane={seat.lane} size={11} className="text-[var(--color-gold)]/60" />
          {ROLE_LABELS[seat.lane]}
        </p>
      </div>
    </div>
  )
}

function GameRow({ game, allied }: { game: MatchupGame; allied: boolean }) {
  const aWon = game.winner === game.a.side
  const bWon = game.winner === game.b.side
  const chip = allied ? (aWon ? "W" : "L") : aWon ? "W - L" : "L - W"
  return (
    <li className="rounded-xl border border-[var(--color-gold)]/10 bg-[var(--color-navy)]/50 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <time dateTime={game.playedAt}>{formatShortDay(game.playedAt)}</time>
        {game.laneDuel ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-gold)]/10 px-2 py-0.5 font-semibold text-[var(--color-gold)]">
            <SwordsIcon className="size-3" aria-hidden />
            Lane duel
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <Seat seat={game.a} won={aWon} align="left" />
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
            aWon ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"
          )}
        >
          {chip}
        </span>
        <Seat seat={game.b} won={bWon} align="right" />
      </div>
    </li>
  )
}

function Scoreboard({ data, view }: { data: RivalryDetailResponse; view: PairView }) {
  const aWins = data.versus.filter((g) => g.winner === g.a.side).length
  const bWins = data.versus.length - aWins
  const left = view === "versus" ? aWins : data.together.wins
  const right = view === "versus" ? bWins : data.together.games - data.together.wins
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-[var(--color-gold)]/15 bg-[var(--color-navy)]/60 p-3">
      {[data.a, data.b].map((player, i) => (
        <div key={player.id} className={cn("flex min-w-0 flex-col items-center gap-1.5 text-center", i === 1 && "order-3")}>
          <PlayerAvatar
            name={player.name}
            src={player.avatarUrl}
            size="lg"
            ring={view === "versus" && (i === 0 ? aWins > bWins : bWins > aWins) ? "gold" : null}
          />
          <span className="w-full truncate text-sm font-semibold text-[var(--color-gold-light)]">{player.name}</span>
        </div>
      ))}
      <div className="order-2 text-center">
        <p className="font-display text-3xl leading-none font-semibold tabular-nums">
          <span className={view === "allied" ? "text-emerald-300" : left >= right ? "text-[var(--color-gold)]" : "text-muted-foreground"}>{left}</span>
          <span className="mx-1.5 text-muted-foreground">-</span>
          <span className={view === "allied" ? "text-rose-300" : right >= left ? "text-[var(--color-gold)]" : "text-muted-foreground"}>{right}</span>
        </p>
        <p className="mt-1 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{view === "versus" ? "head to head" : "side by side"}</p>
      </div>
    </div>
  )
}

function PairFile({ playerAId, playerBId, initialView }: { playerAId: string; playerBId: string; initialView: PairView }) {
  const detail = useRivalryDetail(playerAId, playerBId)
  const [view, setView] = useState<PairView>(initialView)
  const data = detail.data

  if (detail.isPending) {
    return (
      <div className="space-y-2 p-4" aria-busy="true">
        <Skeleton className="h-24 w-full rounded-xl" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }
  if (!data) {
    return (
      <div className="p-4">
        <PageError title="The feud file is sealed" message={detail.error?.message} onRetry={() => void detail.refetch()} retrying={detail.isFetching} className="py-6" />
      </div>
    )
  }

  const duels = data.versus.filter((g) => g.laneDuel)
  const aDuelWins = duels.filter((g) => g.winner === g.a.side).length
  const games = view === "versus" ? data.versus : data.allied

  return (
    <div className="space-y-4 p-4">
      <Segmented
        label="Which games"
        value={view}
        onChange={setView}
        options={[
          { value: "versus", label: `Against (${data.versus.length})` },
          { value: "allied", label: `Together (${data.allied.length})` },
        ]}
        className="flex w-full"
      />
      <Scoreboard data={data} view={view} />
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {view === "versus" ? (
          <>
            <SwordsIcon className="size-3.5 text-[var(--color-gold)]/70" aria-hidden />
            {duels.length === 0 ? "They have never met in lane." : `Lane duels: ${aDuelWins}-${duels.length - aDuelWins} for ${aDuelWins >= duels.length - aDuelWins ? data.a.name : data.b.name}.`}
          </>
        ) : (
          <>
            <HandshakeIcon className="size-3.5 text-[var(--color-gold)]/70" aria-hidden />
            {data.together.games === 0
              ? "Never on the same team. The randomizer keeps them apart."
              : `${Math.round((data.together.wins / data.together.games) * 100)}% together over ${plural(data.together.games, "game")}.`}
          </>
        )}
      </p>
      {games.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{view === "versus" ? "They have never faced each other. Yet." : "No games side by side yet."}</p>
      ) : (
        <ol className="space-y-2" aria-label={view === "versus" ? "Games against each other, newest first" : "Games together, newest first"}>
          {games.map((game) => (
            <GameRow key={game.gameId} game={game} allied={view === "allied"} />
          ))}
        </ol>
      )}
    </div>
  )
}

export function RivalryDetailDialog({
  open,
  onOpenChange,
  playerAId,
  playerBId,
  playerAName,
  playerBName,
  initialView = "versus",
}: RivalryDetailDialogProps) {
  // The last pair stays on screen while the dialog animates out, even once the parent has cleared it.
  const [pair, setPair] = useState({ a: playerAId, b: playerBId, aName: playerAName, bName: playerBName, view: initialView })
  const opened = open && playerAId && playerBId
  if (
    opened &&
    (pair.a !== playerAId || pair.b !== playerBId || pair.aName !== playerAName || pair.bName !== playerBName || pair.view !== initialView)
  ) {
    setPair({ a: playerAId, b: playerBId, aName: playerAName, bName: playerBName, view: initialView })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-[var(--color-gold)]/10 p-4 pr-12">
          <DialogTitle className="font-display text-lg font-semibold text-[var(--color-gold-light)]">
            {pair.aName} <span className="text-muted-foreground">{pair.view === "allied" ? "&" : "vs"}</span> {pair.bName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Every game they shared, as enemies and as allies.</DialogDescription>
        </DialogHeader>
        {pair.a && pair.b ? <PairFile key={`${pair.a}:${pair.b}:${pair.view}`} playerAId={pair.a} playerBId={pair.b} initialView={pair.view} /> : null}
      </DialogContent>
    </Dialog>
  )
}
