"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2Icon, LockIcon, PinIcon, PinOffIcon, RotateCcwIcon, SwordsIcon, Undo2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { useTurnCue } from "@/components/lobby/coach-draft/use-turn-cue"
import { ChampionGrid } from "@/components/lobby/champion-pick/champion-grid"
import { CHAMPION_HELP } from "@/components/lobby/champion-pick/help"
import { PickBanner } from "@/components/lobby/champion-pick/pick-banner"
import { PickOrder } from "@/components/lobby/champion-pick/pick-order"
import { TeamBoard } from "@/components/lobby/champion-pick/team-board"
import { useChampionActions } from "@/components/lobby/champion-pick/use-champion-actions"
import { ROLE_LABELS } from "@/lib/champions"
import { LANE_ORDER, championBlock, type ChampionPickView, type ChampionRequestView, type ChampionSlot } from "@/lib/lobby/champion-pick"
import { useChampionCatalog, useChampionDraft, useFearlessToday } from "@/lib/lobby/champion-queries"
import { useCoachProfiles, useRoster } from "@/lib/lobby/queries"
import type { GameSession, Side } from "@/lib/types"
import { cn } from "@/lib/utils"

const PANEL = "relative rounded-2xl border border-[var(--color-gold)]/25 bg-card p-4 shadow-[0_18px_48px_-28px_var(--color-gold)] sm:p-5"
const EMPTY_FEARLESS: ReadonlySet<string> = new Set()

const byLane = (a: ChampionSlot, b: ChampionSlot) =>
  (a.lane ? LANE_ORDER.indexOf(a.lane) : 9) - (b.lane ? LANE_ORDER.indexOf(b.lane) : 9)

function PanelSkeleton() {
  return (
    <section className={PANEL} aria-busy="true" aria-label="Loading champion select">
      <Skeleton className="h-6 w-44" />
      <div className="mt-4 flex gap-1">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="aspect-square flex-1 rounded-md sm:max-w-11" />
        ))}
      </div>
      <Skeleton className="mt-3 h-16 w-full rounded-xl" />
      <div className="mt-4 grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }, (_, col) => (
          <div key={col} className="flex flex-col gap-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

interface ChampionPickPanelProps {
  session: GameSession
  userId: string | null
}

export function ChampionPickPanel({ session, userId }: ChampionPickPanelProps) {
  const board = useChampionDraft(session.id)
  const catalog = useChampionCatalog()
  const fearlessQuery = useFearlessToday()
  const roster = useRoster()
  const profiles = useCoachProfiles(true)
  const actions = useChampionActions(session.id, userId)
  const [chosenPlayer, setChosenPlayer] = useState<string | null>(null)
  const [chosenChampion, setChosenChampion] = useState<string | null>(null)

  const { refetch } = board
  const seenVersion = useRef(session.updated_at)
  useEffect(() => {
    if (seenVersion.current === session.updated_at) return
    seenVersion.current = session.updated_at
    refetch()
  }, [session.updated_at, refetch])

  const view = board.data
  const slots = useMemo(() => view?.slots ?? [], [view?.slots])
  const picks = useMemo<ChampionPickView[]>(() => view?.picks ?? [], [view?.picks])
  const picksByPlayer = useMemo(() => new Map(picks.map((p) => [p.player_id, p])), [picks])
  const requestsByPlayer = useMemo(() => new Map<string, ChampionRequestView>((view?.requests ?? []).map((r) => [r.player_id, r])), [view?.requests])
  const fearless = useMemo(() => (fearlessQuery.data ? new Set(fearlessQuery.data) : EMPTY_FEARLESS), [fearlessQuery.data])
  const nameById = useMemo(() => new Map(slots.map((s) => [s.player_id, s.name])), [slots])
  const nameOf = (playerId: string) => nameById.get(playerId) ?? "a player"
  const wishes = useMemo(() => {
    const out = new Map<string, string[]>()
    for (const r of view?.requests ?? []) out.set(r.champion, [...(out.get(r.champion) ?? []), nameById.get(r.player_id) ?? "A teammate"])
    return out
  }, [view?.requests, nameById])

  const coachSide: Side | null = !view || !userId ? null : userId === view.blueCoachId ? "blue" : userId === view.redCoachId ? "red" : null
  const turn = view?.turn ?? null
  const isMyTurn = !!coachSide && turn?.side === coachSide && !actions.pick.isPending
  useTurnCue(isMyTurn)

  if (board.isPending) return <PanelSkeleton />
  if (!view || !view.supported) {
    return (
      <section className={PANEL} role="alert">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="font-display text-base font-semibold text-[var(--color-gold)]">The champion board slipped off the table</p>
          <Button variant="outline" className="h-10" onClick={() => refetch()} disabled={board.isFetching}>
            <RotateCcwIcon className={board.isFetching ? "animate-spin" : undefined} aria-hidden />
            Try again
          </Button>
        </div>
      </section>
    )
  }

  const players = roster.data ?? []
  const coachName = (side: Side) => {
    const id = side === "blue" ? view.blueCoachId : view.redCoachId
    return (
      players.find((p) => p.auth_user_id === id)?.name ??
      profiles.data?.find((p) => p.id === id)?.discord_username ??
      (side === "blue" ? "Blue coach" : "Red coach")
    )
  }
  const team = (side: Side) => slots.filter((s) => s.side === side).sort(byLane)
  const done = !view.open && view.status === "draft"

  const mySlot = userId ? (slots.find((s) => s.user_id === userId) ?? null) : null
  const myPick = mySlot ? picksByPlayer.get(mySlot.player_id) : undefined
  const myRequest = mySlot ? requestsByPlayer.get(mySlot.player_id) : undefined
  const requesting = !coachSide && !!mySlot && !myPick && view.open

  const myOpen = coachSide ? team(coachSide).filter((s) => !picksByPlayer.has(s.player_id)) : []
  const activeSlot = coachSide
    ? (myOpen.find((s) => s.player_id === chosenPlayer) ?? myOpen[0] ?? null)
    : requesting
      ? mySlot
      : null
  const activeRequest = activeSlot ? requestsByPlayer.get(activeSlot.player_id) : undefined
  const picking = !!coachSide && view.open && myOpen.length > 0
  const showGrid = picking || requesting

  const catalogByName = new Map((catalog.data ?? []).map((c) => [c.name, c]))
  const chosen = chosenChampion && !championBlock(chosenChampion, picks, fearless) ? (catalogByName.get(chosenChampion) ?? null) : null
  const requestOption =
    coachSide && activeRequest && activeRequest.champion !== chosen?.name && !championBlock(activeRequest.champion, picks, fearless)
      ? (catalogByName.get(activeRequest.champion) ?? null)
      : null

  const latest = picks[picks.length - 1] ?? null
  const canUndo = view.open && !!latest && !latest.auto && !!userId && latest.picked_by === userId && !latest.id.startsWith("pending-")
  const busy = actions.pick.isPending || actions.undo.isPending

  const lockIn = () => {
    if (!isMyTurn || !turn || !activeSlot || !chosen) return
    actions.pick.mutate(
      { playerId: activeSlot.player_id, champion: chosen, pickNumber: turn.pickNumber },
      {
        onSuccess: () => {
          setChosenChampion(null)
          setChosenPlayer(null)
        },
      }
    )
  }

  const teamBoard = (side: Side) => (
    <TeamBoard
      side={side}
      coachName={coachName(side)}
      slots={team(side)}
      picks={picksByPlayer}
      requests={requestsByPlayer}
      selectable={coachSide === side && view.open && !busy}
      selectedId={coachSide === side ? (activeSlot?.player_id ?? null) : null}
      onSelect={setChosenPlayer}
      meUserId={userId}
      onClock={turn?.side === side}
      unavailable={(champion) => !!championBlock(champion, picks, fearless)}
    />
  )

  const gridTitle = coachSide
    ? activeSlot
      ? `For ${activeSlot.name}${activeSlot.lane ? ` · ${ROLE_LABELS[activeSlot.lane]}` : ""}`
      : "Champions"
    : "Pin the champion you want"

  return (
    <section aria-labelledby="champion-select-title" className={PANEL}>
      <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/70 to-transparent" />
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="champion-select-title" className="flex items-center gap-2 font-display text-xl font-semibold tracking-wide text-[var(--color-gold)]">
            <SwordsIcon className="size-5" aria-hidden />
            Champion Select
            <InfoTip help={CHAMPION_HELP.phase} side="bottom" align="start" />
          </h2>
          <p className="text-xs text-muted-foreground">
            {coachName("blue")} and {coachName("red")} pick every champion. Free, and no dice.
          </p>
        </div>
      </header>

      <div className="mt-4 flex flex-col gap-3">
        <PickOrder picks={picks} current={turn?.pickNumber ?? null} nameOf={nameOf} />
        <PickBanner turn={turn} isMyTurn={isMyTurn} coachName={coachName} serverTimeDelta={view.serverTimeDelta} done={done} onExpired={() => refetch()} />
      </div>

      <div
        className={cn(
          "mt-4 grid gap-3",
          showGrid ? "grid-cols-2 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,15rem)]" : "grid-cols-2"
        )}
      >
        <div className={cn("min-w-0", showGrid && "lg:order-1")}>{teamBoard("blue")}</div>
        <div className={cn("min-w-0", showGrid && "lg:order-3")}>{teamBoard("red")}</div>
        {showGrid && (
          <div className="col-span-2 flex min-w-0 flex-col gap-2 lg:order-2 lg:col-span-1">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="truncate">{gridTitle}</span>
              <InfoTip help={CHAMPION_HELP.requests} />
            </h3>
            {coachSide && myOpen.length > 1 && (
              <p className="text-[11px] text-muted-foreground">Tap one of your players to choose who this pick is for.</p>
            )}
            <ChampionGrid
              catalog={catalog.data}
              loading={catalog.isPending}
              failed={catalog.isError}
              onRetry={() => catalog.refetch()}
              lane={activeSlot?.lane ?? null}
              picks={picks}
              fearless={fearless}
              selected={chosen?.name ?? null}
              interactive={!busy && !actions.request.isPending}
              wishes={wishes}
              nameOf={nameOf}
              onSelect={(champion) => setChosenChampion((name) => (name === champion.name ? null : champion.name))}
            />
          </div>
        )}
      </div>

      {picking || canUndo || requesting ? (
        <div className="sticky bottom-[calc(var(--app-tabbar-height)+env(safe-area-inset-bottom,0px)+0.75rem)] z-10 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-gold)]/25 bg-card/95 p-2 shadow-2xl shadow-black/50 backdrop-blur">
          {picking && (
            <Button className="h-12 w-full min-w-0 gap-2 text-base font-semibold sm:w-auto sm:flex-[2_1_0%]" disabled={!isMyTurn || !chosen || !activeSlot || busy} onClick={lockIn}>
              {actions.pick.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : <LockIcon aria-hidden />}
              <span className="truncate">
                {!isMyTurn
                  ? turn
                    ? chosen && activeSlot
                      ? `Ready: ${chosen.name} for ${activeSlot.name}`
                      : `Waiting for ${coachName(turn.side)}`
                    : "Locking in..."
                  : chosen && activeSlot
                    ? `Lock in ${chosen.name} for ${activeSlot.name}`
                    : `Pick a champion for ${activeSlot?.name ?? "your player"}`}
              </span>
            </Button>
          )}
          {requestOption && (
            <Button variant="outline" className="h-11 min-w-0 flex-1 gap-2 sm:h-12" disabled={busy} onClick={() => setChosenChampion(requestOption.name)}>
              <PinIcon aria-hidden />
              <span className="truncate">Use {activeSlot?.name}&apos;s request: {requestOption.name}</span>
            </Button>
          )}
          {canUndo && latest && (
            <span className="flex min-w-0 flex-1 items-center gap-1">
              <Button variant="outline" className="h-11 min-w-0 flex-1 gap-2 sm:h-12" disabled={busy} onClick={() => actions.undo.mutate()}>
                {actions.undo.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : <Undo2Icon aria-hidden />}
                <span className="truncate">Take back {latest.champion}</span>
              </Button>
              <InfoTip help={CHAMPION_HELP.undo} align="end" />
            </span>
          )}
          {requesting && mySlot && (
            <>
              <Button
                className="h-12 w-full min-w-0 gap-2 text-base font-semibold sm:w-auto sm:flex-[2_1_0%]"
                disabled={!chosen || chosen.name === myRequest?.champion || actions.request.isPending}
                onClick={() => chosen && actions.request.mutate({ playerId: mySlot.player_id, champion: chosen }, { onSuccess: () => setChosenChampion(null) })}
              >
                {actions.request.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : <PinIcon aria-hidden />}
                <span className="truncate">
                  {chosen
                    ? chosen.name === myRequest?.champion
                      ? `${chosen.name} is pinned`
                      : `${myRequest ? "Change my request to" : "Pin"} ${chosen.name}`
                    : myRequest
                      ? `Your request: ${myRequest.champion}`
                      : "Tap a champion to request it"}
                </span>
              </Button>
              {myRequest && (
                <Button
                  variant="outline"
                  className="h-11 min-w-0 flex-1 gap-2 sm:h-12"
                  disabled={actions.request.isPending}
                  onClick={() => actions.request.mutate({ playerId: mySlot.player_id, champion: null })}
                >
                  <PinOffIcon aria-hidden />
                  Clear request
                </Button>
              )}
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}
