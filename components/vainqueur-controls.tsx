"use client"

import { useEffect, useState, useCallback } from "react"
import type { VainqueurState } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface VainqueurControlsProps {
  isAdmin: boolean
  currentPlayerId: string | null
  sessionResolved: boolean
  onNextGame?: () => void
}

export function VainqueurControls({
  isAdmin,
  currentPlayerId,
  sessionResolved,
  onNextGame,
}: VainqueurControlsProps) {
  const [state, setState] = useState<VainqueurState | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/vainqueur")
      const data = await res.json()
      setState(data.state)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchState()
  }, [fetchState])

  const doAction = async (action: string, extra?: Record<string, string>) => {
    setActing(true)
    try {
      const res = await fetch("/api/vainqueur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      if (res.ok) {
        if (action === "next_game") {
          onNextGame?.()
        }
        fetchState()
      } else {
        const err = await res.json()
        toast.error(err.error || "Action failed")
      }
    } catch {
      toast.error("Action failed")
    } finally {
      setActing(false)
    }
  }

  if (loading) return null

  if (!state) return null

  if (!state.is_active && isAdmin) {
    return (
      <Button
        onClick={() => doAction("activate")}
        disabled={acting}
        variant="outline"
        size="sm"
        className="border-[var(--color-gold)]/30 text-[var(--color-gold-light)]"
      >
        Activate Vainqueur Mode
      </Button>
    )
  }

  if (!state.is_active) return null

  const isWinner = currentPlayerId
    ? (state.winning_player_ids || []).includes(currentPlayerId)
    : false
  const isLoser = currentPlayerId
    ? (state.losing_player_ids || []).includes(currentPlayerId)
    : false
  const hasVolunteered = currentPlayerId
    ? (state.loser_volunteers || []).includes(currentPlayerId)
    : false

  const winnersCount = (state.winning_player_ids || []).length
  const losersCount = (state.losing_player_ids || []).length

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--color-gold)]">Vainqueur Mode</span>
        {isAdmin && (
          <Button
            onClick={() => doAction("deactivate")}
            disabled={acting}
            variant="ghost"
            size="sm"
            className="text-xs text-red-400/60 hover:text-red-400"
          >
            Deactivate
          </Button>
        )}
      </div>

      {sessionResolved && winnersCount > 0 && (
        <>
          <div className="text-xs text-[var(--color-gold-light)]/60">
            {winnersCount} winner{winnersCount !== 1 ? "s" : ""} stay,{" "}
            {losersCount} loser{losersCount !== 1 ? "s" : ""} rotate out
          </div>

          {isWinner && (
            <Button
              onClick={() => doAction("sit_out", { player_id: currentPlayerId! })}
              disabled={acting}
              variant="outline"
              size="sm"
              className="w-full border-yellow-500/30 text-xs text-yellow-400"
            >
              Sit Out (join queue instead)
            </Button>
          )}

          {isLoser && (
            <Button
              onClick={() =>
                hasVolunteered
                  ? doAction("unvolunteer", { player_id: currentPlayerId! })
                  : doAction("volunteer", { player_id: currentPlayerId! })
              }
              disabled={acting}
              variant="outline"
              size="sm"
              className={cn(
                "w-full text-xs",
                hasVolunteered
                  ? "border-green-500/40 text-green-400"
                  : "border-[var(--color-gold)]/30 text-[var(--color-gold-light)]"
              )}
            >
              {hasVolunteered ? "Volunteered to Stay (click to undo)" : "Volunteer to Stay"}
            </Button>
          )}

          {isAdmin && (
            <Button
              onClick={() => doAction("next_game")}
              disabled={acting}
              className="w-full bg-[var(--color-gold)] font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
            >
              Next Game (Rotate)
            </Button>
          )}
        </>
      )}

      {!sessionResolved && (
        <div className="text-xs text-[var(--color-gold-light)]/40">
          Waiting for game to finish...
        </div>
      )}
    </div>
  )
}
