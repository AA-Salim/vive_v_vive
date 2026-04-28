"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { Assignment, Player, Role, SessionWithAssignments } from "@/lib/types"
import { getAssignmentsByLane } from "@/lib/randomizer"
import { CHAMPION_POOLS, getChampionImageUrl } from "@/lib/champions"
import { RosterManager } from "@/components/roster-manager"
import { MapView } from "@/components/map-view"
import { TeamList } from "@/components/team-list"
import { FearlessPanel } from "@/components/fearless-panel"
import { SessionControls } from "@/components/session-controls"
import { BettingTimer } from "@/components/betting-timer"
import { BettingPanel } from "@/components/betting-panel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSession } from "@/hooks/use-session"
import { toast } from "sonner"

const SHUFFLE_INTERVAL = 80
const SHUFFLE_DURATION = 1000
const LOCK_PAUSE = 400
const LANE_PAUSE = 300

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
    case "draft": return "Draft"
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
    case "draft": return "bg-[var(--color-gold)]/20 text-[var(--color-gold)]"
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
  const [fearlessKey, setFearlessKey] = useState(0)
  const [winFlash, setWinFlash] = useState<"blue" | "red" | null>(null)
  const [creating, setCreating] = useState(false)

  const [isRevealing, setIsRevealing] = useState(false)
  const [revealDone, setRevealDone] = useState(false)
  const [visiblePlayerIds, setVisiblePlayerIds] = useState<Set<string>>(new Set())
  const [shufflingPlayerIds, setShufflingPlayerIds] = useState<Set<string>>(new Set())
  const [shuffleImageUrls, setShuffleImageUrls] = useState<Map<string, string>>(new Map())
  const [isCreator, setIsCreator] = useState(false)

  const skipRef = useRef(false)
  const revealAbortRef = useRef<(() => void) | null>(null)
  const lastSessionId = useRef<string | null>(null)

  const assignments = session ? sessionToAssignments(session) : null
  const isActive = session && ["draft", "betting", "in_game"].includes(session.status)
  const isResolved = session && ["blue_win", "red_win", "canceled", "expired"].includes(session.status)

  useEffect(() => {
    if (!session) {
      lastSessionId.current = null
      setIsCreator(false)
      return
    }

    if (session.id !== lastSessionId.current) {
      lastSessionId.current = session.id

      if (!isCreator) {
        if (assignments) {
          setVisiblePlayerIds(new Set(assignments.map((a) => a.player.id)))
        }
        setRevealDone(true)
        setIsRevealing(false)
      }
    }
  }, [session, assignments, isCreator])

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
    const pool = CHAMPION_POOLS[lane]
    const filtered = excludeInternal
      ? pool.filter((c) => c.internal !== excludeInternal)
      : pool
    const candidates = filtered.length > 0 ? filtered : pool
    const random = candidates[Math.floor(Math.random() * candidates.length)]
    return getChampionImageUrl(random.internal)
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

      for (let i = 0; i < laneGroups.length; i++) {
        if (aborted) break
        const group = laneGroups[i]

        for (const side of ["blue", "red"] as const) {
          if (aborted || skipRef.current) break
          const assignment = side === "blue" ? group.blue : group.red
          const playerId = assignment.player.id

          setVisiblePlayerIds((prev) => new Set([...prev, playerId]))
          setShufflingPlayerIds((prev) => new Set([...prev, playerId]))

          if (!skipRef.current) {
            const shuffleEnd = Date.now() + SHUFFLE_DURATION
            while (Date.now() < shuffleEnd && !skipRef.current && !aborted) {
              setShuffleImageUrls((prev) => {
                const next = new Map(prev)
                next.set(playerId, getRandomChampionImage(assignment.lane, assignment.championInternal))
                return next
              })
              await sleep(SHUFFLE_INTERVAL)
            }
          }

          setShufflingPlayerIds((prev) => {
            const next = new Set(prev)
            next.delete(playerId)
            return next
          })
          setShuffleImageUrls((prev) => {
            const next = new Map(prev)
            next.delete(playerId)
            return next
          })

          if (!skipRef.current && !aborted) {
            await sleep(LOCK_PAUSE)
          }
        }

        if (!skipRef.current && !aborted && i < laneGroups.length - 1) {
          await sleep(LANE_PAUSE)
        }
      }

      setIsRevealing(false)
      setRevealDone(true)
      setVisiblePlayerIds(new Set(allAssignments.map((a) => a.player.id)))
      revealAbortRef.current = null
    },
    [getRandomChampionImage]
  )

  const handleSkip = () => {
    skipRef.current = true
    if (assignments) {
      setVisiblePlayerIds(new Set(assignments.map((a) => a.player.id)))
      setShufflingPlayerIds(new Set())
      setShuffleImageUrls(new Map())
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
        toast.error(err.error || "Failed to create session")
        return
      }
      const newSession = await res.json()
      setIsCreator(true)
      setVisiblePlayerIds(new Set())
      setShufflingPlayerIds(new Set())
      setShuffleImageUrls(new Map())
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
    setVisiblePlayerIds(new Set())
    setShufflingPlayerIds(new Set())
    setShuffleImageUrls(new Map())
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
    setVisiblePlayerIds(new Set())
    setShufflingPlayerIds(new Set())
    setShuffleImageUrls(new Map())
    setIsRevealing(false)
    setRevealDone(false)
    setIsCreator(false)
    lastSessionId.current = null
    refetch()
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
              disabled={isRevealing || creating}
            />
          )}
          <FearlessPanel refreshKey={fearlessKey} />
        </div>

        <div className="space-y-6">
          {assignments && isActive && (
            <>
              <MapView
                assignments={assignments}
                visiblePlayerIds={visiblePlayerIds}
                shufflingPlayerIds={shufflingPlayerIds}
                shuffleImageUrls={shuffleImageUrls}
              />

              <TeamList
                assignments={assignments}
                visiblePlayerIds={visiblePlayerIds}
                shufflingPlayerIds={shufflingPlayerIds}
                shuffleImageUrls={shuffleImageUrls}
                onToggleLock={
                  session.status === "draft" && revealDone
                    ? handleToggleLock
                    : undefined
                }
                showLocks={session.status === "draft" && revealDone}
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

              {session.status === "betting" && session.betting_ends_at && (
                <BettingTimer
                  bettingEndsAt={session.betting_ends_at}
                  serverTimeDelta={serverTimeDelta}
                  onExpired={handleCloseBetting}
                />
              )}

              {session.status === "draft" && revealDone && (
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
                  <BettingPanel sessionId={session.id} />
                  <SessionControls
                    session={session}
                    onAction={handleSessionAction}
                  />
                </>
              )}

              {session.status === "in_game" && (
                <SessionControls
                  session={session}
                  onAction={handleSessionAction}
                />
              )}
            </>
          )}

          {assignments && isResolved && (
            <>
              <MapView assignments={assignments} />

              <TeamList assignments={assignments} />

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
    </div>
  )
}
