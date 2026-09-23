"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { SessionWithAssignments, Prophecy, ProphecyType, Role, Side } from "@/lib/types"

interface ProphecyPanelProps {
  session: SessionWithAssignments
  isBettingOpen: boolean
}

const PREDICTION_TYPES: {
  type: ProphecyType
  label: string
  multiplier: string
  description: string
}[] = [
  {
    type: "player_gets_lane",
    label: "Lane Call",
    multiplier: "2x",
    description: "Predict a player is on a specific lane",
  },
  {
    type: "player_most_kills",
    label: "Kill Leader",
    multiplier: "2.5x",
    description: "Predict who gets the most kills",
  },
  {
    type: "side_wins_fast",
    label: "Fast Victory",
    multiplier: "3x",
    description: "Predict a side wins in under 25 min",
  },
]

const LANES: { value: Role; label: string }[] = [
  { value: "top", label: "TOP" },
  { value: "jungle", label: "JNG" },
  { value: "mid", label: "MID" },
  { value: "adc", label: "ADC" },
  { value: "support", label: "SUP" },
]

interface ProphecyWithUser extends Prophecy {
  discord_username: string
  discord_avatar_url: string | null
}

export function ProphecyPanel({ session, isBettingOpen }: ProphecyPanelProps) {
  const { user } = useAuth()
  const [prophecies, setProphecies] = useState<ProphecyWithUser[]>([])
  const [selectedType, setSelectedType] = useState<ProphecyType | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState("")
  const [selectedLane, setSelectedLane] = useState<Role | "">("")
  const [selectedSide, setSelectedSide] = useState<Side | "">("")
  const [submitting, setSubmitting] = useState(false)

  const fetchProphecies = () => {
    fetch(`/api/sessions/${session.id}/prophecies`)
      .then((r) => r.json())
      .then((data) => setProphecies(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  useEffect(() => {
    fetchProphecies()
  }, [session.id])

  const myProphecy = prophecies.find((p) => p.user_id === user?.id)

  const handleSubmit = async () => {
    if (!selectedType) return
    setSubmitting(true)

    let prediction_value: Record<string, unknown> = {}
    if (selectedType === "player_gets_lane") {
      if (!selectedPlayerId || !selectedLane) return
      prediction_value = { player_id: selectedPlayerId, lane: selectedLane }
    } else if (selectedType === "player_most_kills") {
      if (!selectedPlayerId) return
      prediction_value = { player_id: selectedPlayerId }
    } else if (selectedType === "side_wins_fast") {
      if (!selectedSide) return
      prediction_value = { side: selectedSide }
    }

    try {
      const res = await fetch(`/api/sessions/${session.id}/prophecies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prediction_type: selectedType, prediction_value }),
      })
      const data = await res.json()
      if (data.placed) {
        toast.success("Prophecy sealed")
        fetchProphecies()
        setSelectedType(null)
        setSelectedPlayerId("")
        setSelectedLane("")
        setSelectedSide("")
      } else {
        toast.error(data.error ?? "Failed to place prophecy")
      }
    } catch {
      toast.error("Failed to place prophecy")
    } finally {
      setSubmitting(false)
    }
  }

  const getPlayerName = (playerId: string) => {
    const a = session.session_assignments.find((a) => a.player_id === playerId)
    return a?.players.name ?? "Unknown"
  }

  const describeProphecy = (p: ProphecyWithUser) => {
    const pv = p.prediction_value as Record<string, string>
    const type = PREDICTION_TYPES.find((t) => t.type === p.prediction_type)
    switch (p.prediction_type) {
      case "player_gets_lane":
        return `${getPlayerName(pv.player_id)} plays ${pv.lane?.toUpperCase()}`
      case "player_most_kills":
        return `${getPlayerName(pv.player_id)} gets most kills`
      case "side_wins_fast":
        return `${pv.side === "blue" ? "Blue" : "Red"} wins in <25 min`
      default:
        return type?.label ?? "Unknown"
    }
  }

  const prophecyStatus = (p: ProphecyWithUser) => {
    if (p.correct === null) return null
    if (p.correct) return "text-green-400"
    return "text-red-400/60"
  }

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-[var(--color-navy-light)] p-4">
      <h3 className="mb-3 text-center text-sm font-bold tracking-wider text-cyan-400">
        PROPHECIES
      </h3>

      {prophecies.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {prophecies.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded border border-cyan-500/10 bg-[var(--color-navy)]/50 px-2.5 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <span className="text-xs text-[var(--color-gold-light)]/70">
                  {p.discord_username}:
                </span>{" "}
                <span className={`text-xs font-medium ${prophecyStatus(p) ?? "text-cyan-300/80"}`}>
                  {describeProphecy(p)}
                </span>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-1">
                <span className="text-[10px] font-bold text-cyan-400/60">
                  {PREDICTION_TYPES.find((t) => t.type === p.prediction_type)?.multiplier}
                </span>
                {p.correct === true && (
                  <span className="text-[10px] font-bold text-green-400">HIT</span>
                )}
                {p.correct === false && (
                  <span className="text-[10px] font-bold text-red-400/60">MISS</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isBettingOpen && user && !myProphecy && (
        <div className="space-y-3">
          {!selectedType && (
            <div className="space-y-2">
              <div className="text-center text-xs text-[var(--color-gold-light)]/50">
                Free prediction — amplifies your bet payout if correct
              </div>
              {PREDICTION_TYPES.map((pt) => (
                <button
                  key={pt.type}
                  onClick={() => setSelectedType(pt.type)}
                  className="w-full rounded-lg border border-cyan-500/20 bg-[var(--color-navy)]/50 p-2.5 text-left transition-all hover:border-cyan-500/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-cyan-300">
                      {pt.label}
                    </span>
                    <span className="text-xs font-bold text-cyan-400">
                      {pt.multiplier}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--color-gold-light)]/40">
                    {pt.description}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedType === "player_gets_lane" && (
            <div className="space-y-2">
              <div className="text-center text-xs text-cyan-300/60">
                Predict a player&apos;s lane (2x bet multiplier)
              </div>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full rounded border border-cyan-500/20 bg-[var(--color-navy)] px-3 py-2 text-sm text-[var(--color-gold-light)]"
              >
                <option value="">Select player...</option>
                {session.session_assignments.map((a) => (
                  <option key={a.player_id} value={a.player_id}>
                    {a.players.name}
                  </option>
                ))}
              </select>
              <div className="flex justify-center gap-1.5">
                {LANES.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setSelectedLane(l.value)}
                    className={`rounded px-3 py-1.5 text-xs font-bold transition-all ${
                      selectedLane === l.value
                        ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                        : "bg-[var(--color-navy)] text-[var(--color-gold-light)]/50 hover:text-cyan-300/70"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedType === "player_most_kills" && (
            <div className="space-y-2">
              <div className="text-center text-xs text-cyan-300/60">
                Predict who gets the most kills (2.5x bet multiplier)
              </div>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full rounded border border-cyan-500/20 bg-[var(--color-navy)] px-3 py-2 text-sm text-[var(--color-gold-light)]"
              >
                <option value="">Select player...</option>
                {session.session_assignments.map((a) => (
                  <option key={a.player_id} value={a.player_id}>
                    {a.players.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedType === "side_wins_fast" && (
            <div className="space-y-2">
              <div className="text-center text-xs text-cyan-300/60">
                Predict a side wins under 25 min (3x bet multiplier)
              </div>
              <div className="flex justify-center gap-3">
                <Button
                  size="sm"
                  variant={selectedSide === "blue" ? "default" : "outline"}
                  onClick={() => setSelectedSide("blue")}
                  className={
                    selectedSide === "blue"
                      ? "bg-[var(--color-blue-team)] text-white"
                      : "border-[var(--color-blue-team)]/30 text-[var(--color-blue-team)]"
                  }
                >
                  Blue
                </Button>
                <Button
                  size="sm"
                  variant={selectedSide === "red" ? "default" : "outline"}
                  onClick={() => setSelectedSide("red")}
                  className={
                    selectedSide === "red"
                      ? "bg-[var(--color-red-team)] text-white"
                      : "border-[var(--color-red-team)]/30 text-[var(--color-red-team)]"
                  }
                >
                  Red
                </Button>
              </div>
            </div>
          )}

          {selectedType && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedType(null)
                  setSelectedPlayerId("")
                  setSelectedLane("")
                  setSelectedSide("")
                }}
                className="border-[var(--color-gold)]/20 text-xs text-[var(--color-gold-light)]/60"
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  (selectedType === "player_gets_lane" && (!selectedPlayerId || !selectedLane)) ||
                  (selectedType === "player_most_kills" && !selectedPlayerId) ||
                  (selectedType === "side_wins_fast" && !selectedSide)
                }
                className="flex-1 bg-cyan-500 font-bold text-[var(--color-navy)] hover:bg-cyan-600 disabled:opacity-50"
              >
                {submitting ? "Sealing..." : "Seal Prophecy (Free)"}
              </Button>
            </div>
          )}
        </div>
      )}

      {isBettingOpen && user && myProphecy && (
        <div className="rounded-md bg-cyan-500/5 p-2 text-center">
          <div className="text-[10px] text-[var(--color-gold-light)]/40">
            Your prophecy is sealed
          </div>
          <div className="text-xs font-medium text-cyan-300">
            {describeProphecy(myProphecy)}
          </div>
        </div>
      )}

      {prophecies.length === 0 && !isBettingOpen && (
        <p className="text-center text-xs text-[var(--color-gold-light)]/40">
          No prophecies were made
        </p>
      )}
    </div>
  )
}
