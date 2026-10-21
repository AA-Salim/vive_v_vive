"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { LayoutGroup } from "motion/react"
import { DicesIcon, GavelIcon, Loader2Icon, LockIcon, RotateCcwIcon, Undo2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DraftRules } from "@/components/lobby/coach-draft/draft-rules"
import { PickTrack } from "@/components/lobby/coach-draft/pick-track"
import { PlayerPool, sortPool, type PoolSort } from "@/components/lobby/coach-draft/player-pool"
import { TeamColumn } from "@/components/lobby/coach-draft/team-column"
import { TurnBanner } from "@/components/lobby/coach-draft/turn-banner"
import { useCoachDraftActions } from "@/components/lobby/coach-draft/use-coach-draft-actions"
import { useTurnCue } from "@/components/lobby/coach-draft/use-turn-cue"
import { useAuth } from "@/hooks/use-auth"
import { LANES, sideForPick } from "@/lib/lobby/constants"
import { useCoachPicks, useCoachProfiles, useRoster } from "@/lib/lobby/queries"
import type { CoachDraftPickView, RosterPlayer } from "@/lib/lobby/types"
import type { RoomSession } from "@/lib/session/types"
import type { GameSession, Side } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CoachDraftPanelProps {
  session: GameSession
  userId: string | null
}

const PANEL = "relative rounded-2xl border border-[var(--color-gold)]/25 bg-card p-4 shadow-[0_18px_48px_-28px_var(--color-gold)] sm:p-5"

function lanesSet(picks: CoachDraftPickView[], side: Side): number {
  return new Set(picks.filter((p) => p.side === side && p.lane).map((p) => p.lane)).size
}

function DraftSkeleton() {
  return (
    <section className={PANEL} aria-busy="true" aria-label="Loading the coach draft">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-4 h-7 w-full" />
      <Skeleton className="mt-3 h-16 w-full rounded-xl" />
      <div className="mt-4 grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }, (_, col) => (
          <div key={col} className="flex flex-col gap-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

export function CoachDraftPanel({ session, userId }: CoachDraftPanelProps) {
  const picksQuery = useCoachPicks(session.id)
  const roster = useRoster()
  const profiles = useCoachProfiles(true)
  const { isAdmin, profile } = useAuth()
  const actions = useCoachDraftActions(session.id)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [sort, setSort] = useState<PoolSort>("rate")

  const { refetch } = picksQuery
  const seenVersion = useRef(session.updated_at)
  useEffect(() => {
    if (seenVersion.current === session.updated_at) return
    seenVersion.current = session.updated_at
    refetch()
  }, [session.updated_at, refetch])

  const picks = useMemo(() => picksQuery.data ?? [], [picksQuery.data])
  const players = useMemo(() => roster.data ?? [], [roster.data])
  const rosterById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const pool = (session as GameSession & { coach_pool?: string[] | null }).coach_pool ?? null
  const undoSupported = Object.prototype.hasOwnProperty.call(session, "coach_pool")

  const available = useMemo(() => {
    const picked = new Set(picks.map((p) => p.player_id))
    const candidates = pool && pool.length > 0 ? pool.map((id) => rosterById.get(id)).filter((p): p is RosterPlayer => !!p) : players
    return sortPool(
      candidates.filter((p) => p.is_active && !picked.has(p.id)),
      sort
    )
  }, [picks, pool, players, rosterById, sort])

  const mySide: Side | null = userId && userId === session.blue_coach_id ? "blue" : userId && userId === session.red_coach_id ? "red" : null
  const pickCount = picks.length
  const lanesPhase = pickCount >= 10
  const turnSide = lanesPhase ? null : sideForPick(pickCount + 1)
  const isMyTurn = !!mySide && turnSide === mySide
  useTurnCue(isMyTurn)

  if (picksQuery.isPending || roster.isPending) return <DraftSkeleton />
  if (picksQuery.isError && !picksQuery.data) {
    return (
      <section className={PANEL} role="alert">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="font-display text-base font-semibold text-[var(--color-gold)]">The draft board slipped off the table</p>
          <Button variant="outline" className="h-10" onClick={() => refetch()}>
            <RotateCcwIcon aria-hidden />
            Try again
          </Button>
        </div>
      </section>
    )
  }

  const coachId = (side: Side) => (side === "blue" ? session.blue_coach_id : session.red_coach_id)
  const coachName = (side: Side) => {
    const id = coachId(side)
    return (
      players.find((p) => p.auth_user_id === id)?.name ??
      profiles.data?.find((p) => p.id === id)?.discord_username ??
      (side === "blue" ? "Blue coach" : "Red coach")
    )
  }
  const chosen = chosenId ? (available.find((p) => p.id === chosenId) ?? null) : null
  const latest = picks[picks.length - 1] ?? null
  const canUndo = undoSupported && !!latest && !latest.id.startsWith("pending-") && latest.side === mySide
  const lanesDone = { blue: lanesSet(picks, "blue"), red: lanesSet(picks, "red") }
  const teamsReady = lanesPhase && lanesDone.blue === LANES.length && lanesDone.red === LANES.length
  const canEditLanes = (side: Side) => mySide === side || (isAdmin && !mySide)
  const host = (session as RoomSession).creator?.name ?? "The host"
  const meId = profile?.player_id ?? null
  const busy = actions.pick.isPending || actions.undo.isPending || actions.confirm.isPending

  const lockIn = () => {
    if (!chosen || !isMyTurn) return
    actions.pick.mutate({ id: chosen.id, name: chosen.name }, { onSettled: () => setChosenId(null) })
  }
  const team = (side: Side) => (
    <TeamColumn
      side={side}
      coachName={coachName(side)}
      picks={picks.filter((p) => p.side === side)}
      rosterById={rosterById}
      lanesPhase={lanesPhase}
      canEditLanes={lanesPhase && canEditLanes(side)}
      lanePending={actions.lane.isPending || actions.autoLanes.isPending}
      meId={meId}
      latestPickId={canUndo ? latest?.id ?? null : null}
      onLane={(playerId, lane) => actions.lane.mutate({ playerId, lane })}
    />
  )
  const myLanesMissing = mySide ? LANES.length - lanesDone[mySide] : 0

  return (
    <section aria-labelledby="coach-draft-title" className={PANEL}>
      <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/70 to-transparent" />
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="coach-draft-title" className="flex items-center gap-2 font-display text-xl font-semibold tracking-wide text-[var(--color-gold)]">
            <GavelIcon className="size-5" aria-hidden />
            The Draft Board
          </h2>
          <p className="text-xs text-muted-foreground">
            {coachName("blue")} and {coachName("red")} pick the teams. {pool && pool.length > 0 ? `${pool.length} players in the pool.` : "Every active player is fair game."}
          </p>
        </div>
        <DraftRules host={host} undoSupported={undoSupported} />
      </header>

      <div className="mt-4 flex flex-col gap-3">
        <PickTrack picks={picks} />
        <TurnBanner pickCount={pickCount} turnSide={turnSide} isMyTurn={isMyTurn} coachName={coachName} lanesDone={lanesDone} mySide={mySide} />
      </div>

      <LayoutGroup id={`coach-draft-${session.id}`}>
        <div
          className={cn(
            "mt-4 grid gap-3",
            lanesPhase ? "sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,14rem)]"
          )}
        >
          <div className={cn("min-w-0", !lanesPhase && "lg:order-1", lanesPhase && mySide === "red" && "order-2")}>{team("blue")}</div>
          <div className={cn("min-w-0", !lanesPhase && "lg:order-3", lanesPhase && mySide === "red" && "order-1")}>{team("red")}</div>
          {!lanesPhase && (
            <div className="col-span-2 flex min-w-0 flex-col gap-2 lg:order-2 lg:col-span-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Available · {available.length}</h3>
                <div className="flex gap-1" role="group" aria-label="Sort the pool">
                  {(["rate", "name"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={sort === value}
                      onClick={() => setSort(value)}
                      className="h-10 rounded-full border border-border px-3 text-[11px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-[var(--color-gold)]/50 aria-pressed:text-[var(--color-gold)]"
                    >
                      {value === "rate" ? "Win rate" : "A-Z"}
                    </button>
                  ))}
                </div>
              </div>
              {roster.isError && players.length === 0 ? (
                <div
                  role="alert"
                  className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  The roster scroll is unreadable right now.
                  <Button variant="outline" className="h-10" onClick={() => roster.refetch()} disabled={roster.isFetching}>
                    <RotateCcwIcon className={roster.isFetching ? "animate-spin" : undefined} aria-hidden />
                    Try again
                  </Button>
                </div>
              ) : (
                <PlayerPool
                  players={available}
                  selectable={isMyTurn && !busy}
                  chosenId={chosen?.id ?? null}
                  meId={meId}
                  onChoose={(player) => setChosenId((id) => (id === player.id ? null : player.id))}
                />
              )}
            </div>
          )}
        </div>
      </LayoutGroup>

      {(isMyTurn || canUndo || (lanesPhase && (mySide || isAdmin))) && (
        <div className="sticky bottom-3 z-10 mt-4 flex flex-col gap-2 rounded-xl border border-[var(--color-gold)]/25 bg-card/95 p-2 shadow-2xl shadow-black/50 backdrop-blur sm:flex-row">
          {isMyTurn && (
            <Button className="h-12 gap-2 text-base font-semibold sm:flex-1" disabled={!chosen || busy} onClick={lockIn}>
              {actions.pick.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : <LockIcon aria-hidden />}
              {chosen ? `Lock in ${chosen.name}` : "Tap a player to pick"}
            </Button>
          )}
          {canUndo && latest && (
            <Button variant="outline" className="h-12 gap-2" disabled={busy} onClick={() => actions.undo.mutate()}>
              {actions.undo.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : <Undo2Icon aria-hidden />}
              Take back {latest.players?.name ?? "the last pick"}
            </Button>
          )}
          {lanesPhase && mySide && myLanesMissing > 0 && (
            <Button variant="outline" className="h-12 gap-2" disabled={actions.autoLanes.isPending} onClick={() => actions.autoLanes.mutate()}>
              {actions.autoLanes.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : <DicesIcon aria-hidden />}
              Fill my {myLanesMissing} open lane{myLanesMissing === 1 ? "" : "s"} at random
            </Button>
          )}
          {lanesPhase && (mySide || isAdmin) && (
            <Button className="h-12 gap-2 text-base font-semibold sm:flex-1" disabled={!teamsReady || busy} onClick={() => actions.confirm.mutate()}>
              {actions.confirm.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : <GavelIcon aria-hidden />}
              {teamsReady ? "Lock the teams and deal" : "Waiting for all ten lanes"}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
