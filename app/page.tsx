"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { Assignment, Player, Role } from "@/lib/types"
import {
  splitTeams,
  assignLanes,
  assignChampions,
  getAssignmentsByLane,
} from "@/lib/randomizer"
import { CHAMPION_POOLS, getChampionImageUrl } from "@/lib/champions"
import { RosterManager } from "@/components/roster-manager"
import { MapView } from "@/components/map-view"
import { TeamList } from "@/components/team-list"
import { FearlessPanel } from "@/components/fearless-panel"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const SHUFFLE_INTERVAL = 80
const SHUFFLE_DURATION = 1000
const LOCK_PAUSE = 400
const LANE_PAUSE = 300

export default function HomePage() {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null)
  const [fearlessBanned, setFearlessBanned] = useState<Set<string>>(new Set())
  const [visiblePlayerIds, setVisiblePlayerIds] = useState<Set<string>>(
    new Set()
  )
  const [shufflingPlayerIds, setShufflingPlayerIds] = useState<Set<string>>(
    new Set()
  )
  const [shuffleImageUrls, setShuffleImageUrls] = useState<
    Map<string, string>
  >(new Map())
  const [gameRecorded, setGameRecorded] = useState(false)
  const [fearlessKey, setFearlessKey] = useState(0)
  const [winFlash, setWinFlash] = useState<"blue" | "red" | null>(null)
  const [isRevealing, setIsRevealing] = useState(false)
  const [revealDone, setRevealDone] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const skipRef = useRef(false)
  const revealAbortRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    fetch("/api/fearless")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFearlessBanned(new Set(data))
      })
      .catch(() => {})
  }, [fearlessKey])

  const getRandomChampionImage = useCallback((lane: Role) => {
    const pool = CHAMPION_POOLS[lane]
    const random = pool[Math.floor(Math.random() * pool.length)]
    return getChampionImageUrl(random.internal)
  }, [])

  const revealSequence = useCallback(
    async (allAssignments: Assignment[]) => {
      const laneGroups = getAssignmentsByLane(allAssignments)
      setIsRevealing(true)
      setRevealDone(false)
      skipRef.current = false

      let aborted = false
      revealAbortRef.current = () => {
        aborted = true
      }

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
                next.set(playerId, getRandomChampionImage(assignment.lane))
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
      setVisiblePlayerIds(
        new Set(allAssignments.map((a) => a.player.id))
      )
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

  const handleRandomize = (selectedPlayers: Player[]) => {
    if (selectedPlayers.length !== 10) {
      toast.error("Select exactly 10 players")
      return
    }

    const { blue, red } = splitTeams(selectedPlayers)
    const blueWithLanes = assignLanes(blue)
    const redWithLanes = assignLanes(red)

    const lockedAssignments = new Map<string, Assignment>()
    if (assignments) {
      for (const a of assignments) {
        if (a.locked) lockedAssignments.set(a.player.id, a)
      }
    }

    const result = assignChampions(
      blueWithLanes,
      redWithLanes,
      fearlessBanned,
      lockedAssignments
    )

    const hasOverride = result.some((a) => a.fearlessOverride)
    if (hasOverride) {
      toast.warning(
        "Some roles had no available champions. Fearless draft overridden for those picks."
      )
    }

    setAssignments(result)
    setGameRecorded(false)
    setVisiblePlayerIds(new Set())
    setShufflingPlayerIds(new Set())
    setShuffleImageUrls(new Map())

    revealSequence(result)
  }

  const handleReroll = () => {
    if (!assignments) return

    const lockedAssignments = new Map<string, Assignment>()
    for (const a of assignments) {
      if (a.locked) lockedAssignments.set(a.player.id, a)
    }

    const blueTeam = assignments
      .filter((a) => a.side === "blue")
      .map((a) => ({ player: a.player, lane: a.lane }))
    const redTeam = assignments
      .filter((a) => a.side === "red")
      .map((a) => ({ player: a.player, lane: a.lane }))

    const result = assignChampions(
      blueTeam,
      redTeam,
      fearlessBanned,
      lockedAssignments
    )

    setAssignments(result)
    setVisiblePlayerIds(new Set())
    setShufflingPlayerIds(new Set())
    setShuffleImageUrls(new Map())

    revealSequence(result)
  }

  const handleToggleLock = (playerId: string) => {
    if (!assignments || isRevealing) return
    setAssignments((prev) =>
      prev?.map((a) =>
        a.player.id === playerId ? { ...a, locked: !a.locked } : a
      ) ?? null
    )
  }

  const handleWin = async (winner: "blue" | "red") => {
    if (!assignments || gameRecorded || isSaving) return
    setIsSaving(true)

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winner_side: winner,
          assignments: assignments.map((a) => ({
            player: { id: a.player.id },
            side: a.side,
            lane: a.lane,
            champion: a.champion,
          })),
        }),
      })

      if (res.ok) {
        setGameRecorded(true)
        setFearlessKey((k) => k + 1)
        setWinFlash(winner)
        setTimeout(() => setWinFlash(null), 800)
        toast.success(
          `${winner === "blue" ? "Blue" : "Red"} side wins! Game recorded.`
        )
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to save game")
      }
    } catch {
      toast.error("Failed to save game")
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (revealAbortRef.current) revealAbortRef.current()
    setAssignments(null)
    setVisiblePlayerIds(new Set())
    setShufflingPlayerIds(new Set())
    setShuffleImageUrls(new Map())
    setGameRecorded(false)
    setIsRevealing(false)
    setRevealDone(false)
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

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <RosterManager
            onRandomize={handleRandomize}
            disabled={isRevealing}
          />
          <FearlessPanel refreshKey={fearlessKey} />
        </div>

        <div className="space-y-6">
          {assignments && (
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
                onToggleLock={revealDone ? handleToggleLock : undefined}
                showLocks={revealDone && !gameRecorded}
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

              {revealDone && !gameRecorded && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button
                    onClick={() => handleWin("blue")}
                    disabled={isSaving}
                    className="bg-[var(--color-blue-team)] font-bold text-white hover:bg-[var(--color-blue-team)]/80 disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Blue Side Wins"}
                  </Button>
                  <Button
                    onClick={() => handleWin("red")}
                    disabled={isSaving}
                    className="bg-[var(--color-red-team)] font-bold text-white hover:bg-[var(--color-red-team)]/80 disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Red Side Wins"}
                  </Button>
                  <Button
                    onClick={handleReroll}
                    disabled={isSaving}
                    variant="outline"
                    className="border-[var(--color-gold)]/20 text-[var(--color-gold-light)]"
                  >
                    Re-roll
                  </Button>
                  <Button
                    onClick={handleReset}
                    disabled={isSaving}
                    variant="ghost"
                    className="text-[var(--color-gold-light)]/50"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {gameRecorded && (
                <div className="flex justify-center">
                  <Button
                    onClick={handleReset}
                    className="bg-[var(--color-gold)] font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
                  >
                    Next Game
                  </Button>
                </div>
              )}
            </>
          )}

          {!assignments && (
            <MapView assignments={[]} />
          )}
        </div>
      </div>
    </div>
  )
}
