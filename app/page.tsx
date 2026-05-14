"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { Assignment, Player, PlayerRevealState, Role, SessionWithAssignments } from "@/lib/types"
import { getAssignmentsByLane } from "@/lib/randomizer"
import { CHAMPION_POOLS, getChampionImageUrl, type Champion } from "@/lib/champions"
import { RosterManager } from "@/components/roster-manager"
import { CoachDraftPanel } from "@/components/coach-draft-panel"
import { MapView } from "@/components/map-view"
import { TeamList } from "@/components/team-list"
import { FearlessPanel } from "@/components/fearless-panel"
import { SessionControls } from "@/components/session-controls"
import { BettingTimer } from "@/components/betting-timer"
import { BettingPanel } from "@/components/betting-panel"
import { ChaosTimer } from "@/components/chaos-timer"
import { ChaosPanel } from "@/components/chaos-panel"
import { KissTheHand } from "@/components/kiss-the-hand"
import { CoachSelectDialog } from "@/components/coach-select-dialog"
import { QueuePanel } from "@/components/queue-panel"
import { VainqueurControls } from "@/components/vainqueur-controls"
import { ShameBoard } from "@/components/shame-board"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSession } from "@/hooks/use-session"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import { toast } from "sonner"

const SHUFFLE_INTERVAL = 50
const SHUFFLE_DURATION = 1100
const LOCK_PAUSE = 200
const LANE_PAUSE = 200
const SILHOUETTE_HOLD = 1000
const LOCK_IN_HOLD = 450

function sessionToAssignments(session: SessionWithAssignments): Assignment[] {
  return session.session_assignments.map((sa) => ({
    player: {
      id: sa.players.id,
      name: sa.players.name,
      is_active: true,
      wins: 0,
      losses: 0,
      games_played: 0,
      created_at: "",
    },
    side: sa.side,
    lane: sa.lane,
    champion: sa.champion,
    championInternal: sa.champion_internal,
    locked: sa.locked,
    fearlessOverride: sa.fearless_override,
  }))
}

function statusLabel(status: string) {
  switch (status) {
    case "coach_draft": return "Coach Draft"
    case "draft": return "Draft"
    case "chaos": return "Royal Decrees"
    case "betting": return "Betting Open"
    case "in_game": return "In Game"
    case "blue_win": return "Blue Wins"
    case "red_win": return "Red Wins"
    case "canceled": return "Canceled"
    case "expired": return "Expired"
    default: return status
  }
}

function statusColor(status: string) {
  switch (status) {
    case "coach_draft": return "bg-purple-500/20 text-purple-400"
    case "draft": return "bg-[var(--color-gold)]/20 text-[var(--color-gold)]"
    case "chaos": return "bg-red-500/20 text-red-400"
    case "betting": return "bg-yellow-500/20 text-yellow-400"
    case "in_game": return "bg-green-500/20 text-green-400"
    case "blue_win": return "bg-[var(--color-blue-team)]/20 text-[var(--color-blue-team)]"
    case "red_win": return "bg-[var(--color-red-team)]/20 text-[var(--color-red-team)]"
    case "canceled": return "bg-gray-500/20 text-gray-400"
    default: return "bg-gray-500/20 text-gray-400"
  }
}

export default function HomePage() {
  const { session, isLoading, refetch, serverTimeDelta } = useSession()
  const { user, profile, isAdmin, signIn } = useAuth()
  const { kissRemaining, kissTheHand } = usePoints(user?.id ?? null)
  const [fearlessKey, setFearlessKey] = useState(0)
  const [winFlash, setWinFlash] = useState<"blue" | "red" | null>(null)
  const [creating, setCreating] = useState(false)
  const [coachDialogOpen, setCoachDialogOpen] = useState(false)

  const [isRevealing, setIsRevealing] = useState(false)
  const [revealDone, setRevealDone] = useState(false)
  const [playerStates, setPlayerStates] = useState<Map<string, PlayerRevealState>>(new Map())
  const [shuffleImageUrls, setShuffleImageUrls] = useState<Map<string, string>>(new Map())
  const [activeLane, setActiveLane] = useState<Role | null>(null)
  const [localCreator, setLocalCreator] = useState(false)
  const [pools, setPools] = useState<Record<Role, Champion[]>>(CHAMPION_POOLS)

  const skipRef = useRef(false)
  const revealAbortRef = useRef<(() => void) | null>(null)
  const lastSessionId = useRef<string | null>(null)

  useEffect(() => {
    fetch("/api/champions").then(res => res.json()).then(data => {
      if (data && !data.error) setPools(data)
    })
  }, [])

  const assignments = session ? sessionToAssignments(session) : null
  const isActive = session && ["coach_draft", "draft", "chaos", "betting", "in_game"].includes(session.status)
  const isResolved = session && ["blue_win", "red_win", "canceled", "expired"].includes(session.status)
  const isCreator = localCreator || isAdmin || (!!user && !!session && session.created_by === user.id)

  useEffect(() => {
    if (!session) {
      lastSessionId.current = null
      setLocalCreator(false)
      return
    }

    if (session.id !== lastSessionId.current) {
      lastSessionId.current = session.id

      if (!localCreator) {
        if (assignments) {
          const states = new Map<string, PlayerRevealState>()
          assignments.forEach((a) => states.set(a.player.id, "revealed"))
          setPlayerStates(states)
        }
        setRevealDone(true)
        setIsRevealing(false)
      }
    }
  }, [session, assignments, localCreator])

  useEffect(() => {
    if (isResolved && session) {
      const winner = session.status === "blue_win" ? "blue" : session.status === "red_win" ? "red" : null
      if (winner) {
        setWinFlash(winner)
        setTimeout(() => setWinFlash(null), 800)
        setFearlessKey((k) => k + 1)
      }
    }
  }, [isResolved, session?.status, session?.id])

  const getRandomChampionImage = useCallback((lane: Role, excludeInternal?: string) => {
    const pool = pools[lane]
    const filtered = excludeInternal
      ? pool.filter((c) => c.internal !== excludeInternal)
      : pool
    const candidates = filtered.length > 0 ? filtered : pool
    const random = candidates[Math.floor(Math.random() * candidates.length)]
    return getChampionImageUrl(random.internal)
  }, [pools])

  const setPlayerState = useCallback((playerId: string, state: PlayerRevealState) => {
    setPlayerStates((prev) => {
      const next = new Map(prev)
      next.set(playerId, state)
      return next
    })
  }, [])

  const revealSequence = useCallback(
    async (allAssignments: Assignment[]) => {
      const laneGroups = getAssignmentsByLane(allAssignments)
      setIsRevealing(true)
      setRevealDone(false)
      skipRef.current = false

      let aborted = false
      revealAbortRef.current = () => { aborted = true }

      const sleep = (ms: number) =>
        new Promise<void>((resolve) => {
          const t = setTimeout(resolve, ms)
          const check = setInterval(() => {
            if (skipRef.current || aborted) {
              clearTimeout(t)
              clearInterval(check)
              resolve()
            }
          }, 50)
        })

      // Stage 1: All silhouettes appear
      const initialStates = new Map<string, PlayerRevealState>()
      allAssignments.forEach((a) => initialStates.set(a.player.id, "silhouette"))
      setPlayerStates(initialStates)
      setActiveLane(null)

      if (!skipRef.current && !aborted) {
        await sleep(SILHOUETTE_HOLD)
      }

      // Stage 2: Lane-by-lane reveal
      for (let i = 0; i < laneGroups.length; i++) {
        if (aborted || skipRef.current) break
        const group = laneGroups[i]

        setActiveLane(group.lane)

        for (const side of ["blue", "red"] as const) {
          if (aborted || skipRef.current) break
          const assignment = side === "blue" ? group.blue : group.red
          const playerId = assignment.player.id

          // Start shuffle
          setPlayerState(playerId, "shuffling")
          setShuffleImageUrls((prev) => {
            const next = new Map(prev)
            next.set(playerId, getRandomChampionImage(assignment.lane, assignment.championInternal))
            return next
          })

          if (!skipRef.current && !aborted) {
            // Slot machine: fast cycling that decelerates
            const shuffleEnd = Date.now() + SHUFFLE_DURATION
            let interval = SHUFFLE_INTERVAL

            while (Date.now() < shuffleEnd && !skipRef.current && !aborted) {
              setShuffleImageUrls((prev) => {
                const next = new Map(prev)
                next.set(playerId, getRandomChampionImage(assignment.lane, assignment.championInternal))
                return next
              })

              const remaining = shuffleEnd - Date.now()
              if (remaining < 500) {
                const progress = 1 - remaining / 500
                interval = SHUFFLE_INTERVAL + Math.floor(progress * progress * 250)
              }

              await sleep(interval)
            }
          }

          // Lock in: scale + flash
          setShuffleImageUrls((prev) => {
            const next = new Map(prev)
            next.delete(playerId)
            return next
          })
          setPlayerState(playerId, "locking")

          if (!skipRef.current && !aborted) {
            await sleep(LOCK_IN_HOLD)
          }

          setPlayerState(playerId, "revealed")

          if (!skipRef.current && !aborted) {
            await sleep(LOCK_PAUSE)
          }
        }

        if (!skipRef.current && !aborted && i < laneGroups.length - 1) {
          await sleep(LANE_PAUSE)
        }
      }

      // Stage 3: All revealed
      setActiveLane(null)
      const finalStates = new Map<string, PlayerRevealState>()
      allAssignments.forEach((a) => finalStates.set(a.player.id, "revealed"))
      setPlayerStates(finalStates)
      setShuffleImageUrls(new Map())
      setIsRevealing(false)
      setRevealDone(true)
      revealAbortRef.current = null
    },
    [getRandomChampionImage, setPlayerState]
  )

  const handleSkip = () => {
    skipRef.current = true
    if (assignments) {
      const states = new Map<string, PlayerRevealState>()
      assignments.forEach((a) => states.set(a.player.id, "revealed"))
      setPlayerStates(states)
      setShuffleImageUrls(new Map())
      setActiveLane(null)
      setIsRevealing(false)
      setRevealDone(true)
    }
  }

  const handleRandomize = async (selectedPlayers: Player[]) => {
    if (selectedPlayers.length !== 10) {
      toast.error("Select exactly 10 players")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_ids: selectedPlayers.map((p) => p.id),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        if (res.status === 401) {
          toast.error("Login to create a session")
          signIn()
        } else {
          toast.error(err.error || "Failed to create session")
        }
        return
      }
      const newSession = await res.json()
      setLocalCreator(true)
      setPlayerStates(new Map())
      setShuffleImageUrls(new Map())
      setActiveLane(null)
      setRevealDone(false)

      await refetch()
      const newAssignments = sessionToAssignments(newSession)
      revealSequence(newAssignments)
    } catch {
      toast.error("Failed to create session")
    } finally {
      setCreating(false)
    }
  }

  const handleToggleLock = async (playerId: string) => {
    if (!session || session.status !== "draft" || isRevealing) return
    const sa = session.session_assignments.find(
      (a) => a.players.id === playerId
    )
    if (!sa) return

    await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_lock", assignment_id: sa.id }),
    })
  }

  const handleReroll = async () => {
    if (!session) return
    setPlayerStates(new Map())
    setShuffleImageUrls(new Map())
    setActiveLane(null)
    setRevealDone(false)

    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reroll" }),
    })
    if (res.ok) {
      const updated = await res.json()
      const newAssignments = sessionToAssignments(updated)
      revealSequence(newAssignments)
    }
  }

  const handleSessionAction = () => {
    refetch()
  }

  const handleCloseChaos = async () => {
    if (!session) return
    await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close_chaos" }),
    })
  }

  const handleCloseBetting = async () => {
    if (!session) return
    await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close_betting" }),
    })
  }

  const handleReset = () => {
    if (revealAbortRef.current) revealAbortRef.current()
    setPlayerStates(new Map())
    setShuffleImageUrls(new Map())
    setActiveLane(null)
    setIsRevealing(false)
    setRevealDone(false)
    setLocalCreator(false)
    lastSessionId.current = null
    refetch()
  }

  const handleStartCoachDraft = async (blueCoachId: string, redCoachId: string) => {
    try {
      const res = await fetch("/api/sessions/coach-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blue_coach_id: blueCoachId, red_coach_id: redCoachId }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to start coach draft")
        return
      }
      await refetch()
    } catch {
      toast.error("Failed to start coach draft")
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-gold-light)]/50">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {winFlash && (
        <div
          className="animate-team-flash pointer-events-none fixed inset-0 z-50"
          style={{
            backgroundColor:
              winFlash === "blue"
                ? "rgba(10, 132, 255, 0.3)"
                : "rgba(255, 69, 58, 0.3)",
          }}
        />
      )}

      {session && (
        <div className="flex items-center justify-center gap-2">
          <Badge className={statusColor(session.status)}>
            {statusLabel(session.status)}
          </Badge>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          {!isActive && (
            <RosterManager
              onRandomize={handleRandomize}
              onCoachDraft={() => setCoachDialogOpen(true)}
              isAdmin={isAdmin}
              disabled={isRevealing || creating}
            />
          )}
          <FearlessPanel refreshKey={fearlessKey} />
          {user && (
            <KissTheHand
              kissRemaining={kissRemaining}
              onKiss={kissTheHand}
            />
          )}
          <QueuePanel currentPlayerId={profile?.player_id ?? null} />
          <VainqueurControls
            isAdmin={isAdmin}
            currentPlayerId={profile?.player_id ?? null}
            sessionResolved={!!isResolved}
            onNextGame={refetch}
          />
          <ShameBoard userId={user?.id ?? null} />
        </div>

        <div className="space-y-6">
          {session && session.status === "coach_draft" && (
            <>
              <CoachDraftPanel session={session} userId={user?.id ?? null} />
              <SessionControls session={session} onAction={handleSessionAction} />
            </>
          )}

          {assignments && isActive && session.status !== "coach_draft" && (
            <>
              <MapView
                assignments={assignments}
                playerStates={playerStates}
                shuffleImageUrls={shuffleImageUrls}
                activeLane={activeLane}
              />

              <TeamList
                assignments={assignments}
                playerStates={playerStates}
                shuffleImageUrls={shuffleImageUrls}
                onToggleLock={
                  session.status === "draft" && revealDone && isCreator
                    ? handleToggleLock
                    : undefined
                }
                showLocks={session.status === "draft" && revealDone && isCreator}
                activeLane={activeLane}
              />

              {isRevealing && (
                <div className="flex justify-center">
                  <Button
                    onClick={handleSkip}
                    variant="outline"
                    size="sm"
                    className="border-[var(--color-gold)]/20 text-[var(--color-gold-light)]/60"
                  >
                    Skip Animation
                  </Button>
                </div>
              )}

              {session.status === "chaos" && session.chaos_ends_at && (
                <ChaosTimer
                  chaosEndsAt={session.chaos_ends_at}
                  serverTimeDelta={serverTimeDelta}
                  onExpired={handleCloseChaos}
                />
              )}

              {session.status === "chaos" && (
                <>
                  <ChaosPanel session={session} isOpen={true} />
                  <SessionControls
                    session={session}
                    onAction={handleSessionAction}
                  />
                </>
              )}

              {session.status === "betting" && session.betting_ends_at && (
                <BettingTimer
                  bettingEndsAt={session.betting_ends_at}
                  serverTimeDelta={serverTimeDelta}
                  onExpired={handleCloseBetting}
                />
              )}

              {session.status === "draft" && revealDone && isCreator && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <SessionControls
                    session={session}
                    onAction={handleSessionAction}
                  />
                  <Button
                    onClick={handleReroll}
                    variant="outline"
                    className="border-[var(--color-gold)]/20 text-[var(--color-gold-light)]"
                  >
                    Re-roll
                  </Button>
                </div>
              )}

              {session.status === "betting" && (
                <>
                  <BettingPanel sessionId={session.id} isBettingOpen={true} />
                  <SessionControls
                    session={session}
                    onAction={handleSessionAction}
                  />
                </>
              )}

              {session.status === "in_game" && (
                <>
                  <BettingPanel sessionId={session.id} isBettingOpen={false} />
                  <SessionControls
                    session={session}
                    onAction={handleSessionAction}
                  />
                </>
              )}
            </>
          )}

          {assignments && isResolved && (
            <>
              <MapView assignments={assignments} />

              <TeamList assignments={assignments} />

              <BettingPanel sessionId={session.id} isBettingOpen={false} />

              <div className="flex flex-col items-center gap-3">
                <div className="text-lg font-bold text-[var(--color-gold)]">
                  {session.status === "blue_win" && "Blue Side Wins!"}
                  {session.status === "red_win" && "Red Side Wins!"}
                  {session.status === "canceled" && "Game Canceled"}
                  {session.status === "expired" && "Session Expired"}
                </div>
                <Button
                  onClick={handleReset}
                  className="bg-[var(--color-gold)] font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
                >
                  Next Game
                </Button>
              </div>
            </>
          )}

          {!session && <MapView assignments={[]} />}
        </div>
      </div>

      <CoachSelectDialog
        open={coachDialogOpen}
        onOpenChange={setCoachDialogOpen}
        currentUserId={user?.id ?? null}
        onConfirm={handleStartCoachDraft}
      />
    </div>
  )
}
