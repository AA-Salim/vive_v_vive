"use client"

import { useEffect, useState, useCallback } from "react"
import type { CoachDraftPick, GameSession, Player, Role, Side } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const SERPENTINE_ORDER: Side[] = [
  "blue", "red", "red", "blue", "blue",
  "red", "red", "blue", "blue", "red",
]

const LANES: Role[] = ["top", "jungle", "mid", "adc", "support"]

interface CoachDraftPanelProps {
  session: GameSession
  userId: string | null
}

export function CoachDraftPanel({ session, userId }: CoachDraftPanelProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [picks, setPicks] = useState<(CoachDraftPick & { players?: { id: string; name: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [picking, setPicking] = useState(false)

  const isBlueCoach = userId === session.blue_coach_id
  const isRedCoach = userId === session.red_coach_id
  const isCoach = isBlueCoach || isRedCoach
  const mySide: Side | null = isBlueCoach ? "blue" : isRedCoach ? "red" : null

  const currentPickNumber = picks.length + 1
  const allPicked = picks.length >= 10
  const currentTurn = currentPickNumber <= 10 ? SERPENTINE_ORDER[currentPickNumber - 1] : null
  const isMyTurn = currentTurn === mySide

  const pickedPlayerIds = new Set(picks.map((p) => p.player_id))
  const bluePicks = picks.filter((p) => p.side === "blue")
  const redPicks = picks.filter((p) => p.side === "red")

  const fetchData = useCallback(async () => {
    try {
      const [playersRes, picksRes] = await Promise.all([
        fetch("/api/players"),
        fetch(`/api/sessions/${session.id}/coach-draft`),
      ])
      const playersData = await playersRes.json()
      const picksData = await picksRes.json()
      if (Array.isArray(playersData)) setPlayers(playersData.filter((p: Player) => p.is_active))
      if (Array.isArray(picksData)) setPicks(picksData)
    } catch {
      toast.error("Failed to load draft data")
    } finally {
      setLoading(false)
    }
  }, [session.id])

  useEffect(() => {
    fetchData()
  }, [fetchData, session.updated_at])

  const handlePick = async (playerId: string) => {
    if (!isMyTurn || picking) return
    setPicking(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/coach-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pick", player_id: playerId }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to pick")
      }
    } catch {
      toast.error("Failed to pick player")
    } finally {
      setPicking(false)
    }
  }

  const handleAssignLane = async (playerId: string, lane: Role) => {
    try {
      const res = await fetch(`/api/sessions/${session.id}/coach-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_lane", player_id: playerId, lane }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to assign lane")
      }
    } catch {
      toast.error("Failed to assign lane")
    }
  }

  const handleConfirm = async () => {
    try {
      const res = await fetch(`/api/sessions/${session.id}/coach-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to confirm draft")
      } else {
        toast.success("Draft confirmed — champions randomized!")
      }
    } catch {
      toast.error("Failed to confirm draft")
    }
  }

  if (loading) {
    return <div className="text-center text-[var(--color-gold-light)]/50">Loading draft...</div>
  }

  const allLanesAssigned = picks.every((p) => p.lane !== null)
  const myTeamPicks = picks.filter((p) => p.side === mySide)
  const myTeamLanesAssigned = myTeamPicks.every((p) => p.lane !== null)

  return (
    <div className="space-y-4">
      {!allPicked && (
        <div className="text-center">
          <div className="text-sm text-[var(--color-gold-light)]/70">
            Pick {currentPickNumber}/10
          </div>
          <div className={cn(
            "text-lg font-bold",
            currentTurn === "blue" ? "text-[var(--color-blue-team)]" : "text-[var(--color-red-team)]"
          )}>
            {currentTurn === "blue" ? "Blue" : "Red"} Coach picks
            {isMyTurn && " (Your turn!)"}
          </div>
        </div>
      )}

      {allPicked && !allLanesAssigned && (
        <div className="text-center text-[var(--color-gold)]">
          All players picked — assign lanes to your team
        </div>
      )}

      {allPicked && allLanesAssigned && isCoach && (
        <div className="flex justify-center">
          <Button
            onClick={handleConfirm}
            className="bg-[var(--color-gold)] font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
          >
            Confirm Draft & Randomize Champions
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Blue team */}
        <div className="space-y-2">
          <div className="text-center text-sm font-bold text-[var(--color-blue-team)]">
            Blue Team ({bluePicks.length}/5)
          </div>
          {bluePicks.map((pick) => (
            <div
              key={pick.id}
              className="flex items-center justify-between rounded-md bg-[var(--color-blue-team)]/10 px-3 py-2"
            >
              <span className="text-sm text-[var(--color-gold-light)]">
                {pick.players?.name || "Unknown"}
              </span>
              {allPicked && isBlueCoach ? (
                <select
                  value={pick.lane || ""}
                  onChange={(e) => handleAssignLane(pick.player_id, e.target.value as Role)}
                  className="rounded bg-[var(--color-navy)] px-2 py-1 text-xs text-[var(--color-gold-light)]"
                >
                  <option value="">Lane...</option>
                  {LANES.map((lane) => (
                    <option key={lane} value={lane}>{lane}</option>
                  ))}
                </select>
              ) : (
                pick.lane && (
                  <Badge className="bg-[var(--color-blue-team)]/20 text-[var(--color-blue-team)]">
                    {pick.lane}
                  </Badge>
                )
              )}
            </div>
          ))}
        </div>

        {/* Red team */}
        <div className="space-y-2">
          <div className="text-center text-sm font-bold text-[var(--color-red-team)]">
            Red Team ({redPicks.length}/5)
          </div>
          {redPicks.map((pick) => (
            <div
              key={pick.id}
              className="flex items-center justify-between rounded-md bg-[var(--color-red-team)]/10 px-3 py-2"
            >
              <span className="text-sm text-[var(--color-gold-light)]">
                {pick.players?.name || "Unknown"}
              </span>
              {allPicked && isRedCoach ? (
                <select
                  value={pick.lane || ""}
                  onChange={(e) => handleAssignLane(pick.player_id, e.target.value as Role)}
                  className="rounded bg-[var(--color-navy)] px-2 py-1 text-xs text-[var(--color-gold-light)]"
                >
                  <option value="">Lane...</option>
                  {LANES.map((lane) => (
                    <option key={lane} value={lane}>{lane}</option>
                  ))}
                </select>
              ) : (
                pick.lane && (
                  <Badge className="bg-[var(--color-red-team)]/20 text-[var(--color-red-team)]">
                    {pick.lane}
                  </Badge>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Available players for picking */}
      {!allPicked && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-[var(--color-gold-light)]/70">
            Available Players
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {players
              .filter((p) => !pickedPlayerIds.has(p.id))
              .map((player) => (
                <button
                  key={player.id}
                  onClick={() => handlePick(player.id)}
                  disabled={!isMyTurn || picking}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm transition-all",
                    isMyTurn && !picking
                      ? "border-[var(--color-gold)]/30 bg-[var(--color-navy-light)] text-[var(--color-gold-light)] hover:border-[var(--color-gold)]/60 hover:bg-[var(--color-navy-lighter)]"
                      : "border-[var(--color-gold)]/10 bg-[var(--color-navy)] text-[var(--color-gold-light)]/40"
                  )}
                >
                  {player.name}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
