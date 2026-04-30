"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import { useChaos } from "@/hooks/use-chaos"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import type { SessionWithAssignments, Side, ChaosActionWithNames } from "@/lib/types"

interface ChaosPanelProps {
  session: SessionWithAssignments
  isOpen: boolean
}

const TIER_CONFIG = {
  medium: {
    label: "GAMBLE",
    cost: 49,
    payout: "98",
    description: "Double or Nothing",
    detail: "Pick a side. Win = 2x back. Lose = gone.",
    color: "text-yellow-400",
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/5",
    hoverBg: "hover:bg-yellow-500/10",
    maxPerSession: 3,
  },
  high: {
    label: "SWAP",
    cost: 89,
    payout: null,
    description: "Swap with Teammate",
    detail: "Trade your lane + champ with a teammate.",
    color: "text-orange-400",
    border: "border-orange-500/30",
    bg: "bg-orange-500/5",
    hoverBg: "hover:bg-orange-500/10",
    maxPerSession: 1,
  },
  super: {
    label: "CHAOS",
    cost: 139,
    payout: null,
    description: "Nuclear Option",
    detail: "Shuffle lanes, reroll champs, or target someone.",
    color: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    hoverBg: "hover:bg-red-500/10",
    maxPerSession: null,
  },
} as const

type TierKey = keyof typeof TIER_CONFIG
type DialogMode = null | "medium" | "high" | "super"
type SuperAction = "shuffle_lanes" | "reroll_champs" | "target_reroll"

export function ChaosPanel({ session, isOpen }: ChaosPanelProps) {
  const { user, profile, signIn } = useAuth()
  const { balance, refetch: refetchPoints } = usePoints(user?.id ?? null)
  const { actions, refetch: refetchActions } = useChaos(session.id)
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [selectedSide, setSelectedSide] = useState<Side | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [superAction, setSuperAction] = useState<SuperAction | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const userPlayerId = profile?.player_id ?? null

  const myAssignment = session.session_assignments.find(
    (a) => a.player_id === userPlayerId
  )

  const teammates = myAssignment
    ? session.session_assignments.filter(
        (a) => a.side === myAssignment.side && a.player_id !== myAssignment.player_id
      )
    : []

  const userDonCount = actions.filter(
    (a) => a.user_id === user?.id && a.action_type === "double_or_nothing" && a.status !== "refunded"
  ).length
  const userSwapCount = actions.filter(
    (a) => a.user_id === user?.id && a.action_type === "swap_teammate" && a.status !== "refunded"
  ).length

  const canAfford = (tier: TierKey) => balance >= TIER_CONFIG[tier].cost
  const isLimitReached = (tier: TierKey) => {
    if (tier === "medium") return userDonCount >= 3
    if (tier === "high") return userSwapCount >= 1
    return false
  }

  const isDisabled = (tier: TierKey) => {
    if (!user) return true
    if (!isOpen) return true
    if (!canAfford(tier)) return true
    if (isLimitReached(tier)) return true
    if (tier === "high" && !myAssignment) return true
    return false
  }

  const resetDialog = () => {
    setDialogMode(null)
    setSelectedSide(null)
    setSelectedPlayerId(null)
    setSuperAction(null)
  }

  const submitAction = async (body: Record<string, unknown>) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}/chaos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success("Decree issued")
        await refetchActions()
        await refetchPoints()
        resetDialog()
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to issue decree")
      }
    } catch {
      toast.error("Failed to issue decree")
    } finally {
      setSubmitting(false)
    }
  }

  const handleMediumConfirm = () => {
    if (!selectedSide) return
    submitAction({ action_type: "double_or_nothing", side: selectedSide })
  }

  const handleHighConfirm = () => {
    if (!selectedPlayerId) return
    submitAction({ action_type: "swap_teammate", target_player_id: selectedPlayerId })
  }

  const handleSuperConfirm = () => {
    if (!superAction) return
    if (superAction === "target_reroll") {
      if (!selectedPlayerId) return
      submitAction({ action_type: "target_reroll", target_player_id: selectedPlayerId })
    } else {
      if (!selectedSide) return
      submitAction({ action_type: superAction, target_team: selectedSide })
    }
  }

  const formatAction = (a: ChaosActionWithNames) => {
    const name = a.discord_username
    switch (a.action_type) {
      case "double_or_nothing":
        return `${name} wagered 49 on ${a.side === "blue" ? "Blue" : "Red"}`
      case "swap_teammate":
        return `${name} swapped with ${a.target_player_2_name ?? "?"}`
      case "shuffle_lanes":
        return `${name} shuffled all ${a.target_team === "blue" ? "Blue" : "Red"} lanes`
      case "reroll_champs":
        return `${name} rerolled all ${a.target_team === "blue" ? "Blue" : "Red"} champs`
      case "target_reroll":
        return `${name} rerolled ${a.target_player_name ?? "?"}'s champion`
      default:
        return `${name} issued a decree`
    }
  }

  const tierStatusLabel = (tier: TierKey) => {
    if (tier === "medium") return `${userDonCount}/3`
    if (tier === "high") {
      if (!myAssignment) return "Players only"
      return userSwapCount >= 1 ? "Used" : "Available"
    }
    return "Available"
  }

  return (
    <>
      <div className="rounded-lg border border-red-500/20 bg-[var(--color-navy-light)] p-4">
        <h3 className="mb-4 text-center text-sm font-bold tracking-wider text-red-400">
          ROYAL DECREES
        </h3>

        <div className="grid grid-cols-3 gap-3">
          {(["medium", "high", "super"] as TierKey[]).map((tier) => {
            const config = TIER_CONFIG[tier]
            const disabled = isDisabled(tier)

            return (
              <button
                key={tier}
                onClick={() => !disabled && setDialogMode(tier)}
                disabled={disabled}
                className={`rounded-lg border ${config.border} ${config.bg} ${config.hoverBg} p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <div className={`text-[10px] font-bold tracking-wider ${config.color}`}>
                  {config.label}
                </div>
                <div className="mt-1 text-lg font-bold text-[var(--color-gold)]">
                  {config.cost}
                </div>
                <div className="text-[10px] text-[var(--color-gold-light)]/50">
                  {config.description}
                </div>
                {config.payout && (
                  <div className="mt-1 text-[10px] font-semibold text-green-400/70">
                    Win: {config.payout}
                  </div>
                )}
                <div className="mt-2 text-[10px] text-[var(--color-gold-light)]/40">
                  {tierStatusLabel(tier)}
                </div>
              </button>
            )
          })}
        </div>

        {actions.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-center text-[10px] font-semibold tracking-wider text-[var(--color-gold)]/50">
              DECREE LOG
            </div>
            <ScrollArea className="h-24">
              <div className="space-y-1">
                {[...actions].reverse().map((a) => (
                  <div
                    key={a.id}
                    className="rounded px-2 py-1 text-xs text-[var(--color-gold-light)]/60"
                  >
                    {formatAction(a)}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {!user && isOpen && (
          <div className="mt-3 text-center">
            <button
              onClick={signIn}
              className="text-xs text-[var(--color-gold-light)]/50 underline"
            >
              Login with Discord to issue decrees
            </button>
          </div>
        )}
      </div>

      {/* Medium: Double or Nothing */}
      <Dialog open={dialogMode === "medium"} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="border-yellow-500/20 bg-[var(--color-navy)]">
          <DialogHeader>
            <DialogTitle className="text-yellow-400">Double or Nothing</DialogTitle>
            <DialogDescription className="text-[var(--color-gold-light)]/60">
              Pick a side. If they win, you get 98 back. Cost: 49 pts.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-3 py-4">
            <Button
              size="lg"
              variant={selectedSide === "blue" ? "default" : "outline"}
              onClick={() => setSelectedSide("blue")}
              className={
                selectedSide === "blue"
                  ? "bg-[var(--color-blue-team)] text-white"
                  : "border-[var(--color-blue-team)]/30 text-[var(--color-blue-team)]"
              }
            >
              Blue Side
            </Button>
            <Button
              size="lg"
              variant={selectedSide === "red" ? "default" : "outline"}
              onClick={() => setSelectedSide("red")}
              className={
                selectedSide === "red"
                  ? "bg-[var(--color-red-team)] text-white"
                  : "border-[var(--color-red-team)]/30 text-[var(--color-red-team)]"
              }
            >
              Red Side
            </Button>
          </div>
          <Button
            onClick={handleMediumConfirm}
            disabled={!selectedSide || submitting}
            className="w-full bg-yellow-500 font-bold text-[var(--color-navy)] hover:bg-yellow-600 disabled:opacity-50"
          >
            {submitting ? "Placing..." : "Confirm Wager"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* High: Swap with Teammate */}
      <Dialog open={dialogMode === "high"} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="border-orange-500/20 bg-[var(--color-navy)]">
          <DialogHeader>
            <DialogTitle className="text-orange-400">Swap with Teammate</DialogTitle>
            <DialogDescription className="text-[var(--color-gold-light)]/60">
              Trade your lane + champion with a teammate. Cost: 89 pts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {teammates.map((t) => (
              <button
                key={t.player_id}
                onClick={() => setSelectedPlayerId(t.player_id)}
                className={`w-full rounded-lg border p-3 text-left transition-all ${
                  selectedPlayerId === t.player_id
                    ? "border-orange-500/50 bg-orange-500/10"
                    : "border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] hover:border-orange-500/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--color-gold-light)]">
                    {t.players.name}
                  </span>
                  <span className="text-xs text-[var(--color-gold-light)]/50">
                    {t.lane.toUpperCase()} - {t.champion}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <Button
            onClick={handleHighConfirm}
            disabled={!selectedPlayerId || submitting}
            className="w-full bg-orange-500 font-bold text-[var(--color-navy)] hover:bg-orange-600 disabled:opacity-50"
          >
            {submitting ? "Swapping..." : "Confirm Swap"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Super: Nuclear Options */}
      <Dialog open={dialogMode === "super"} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="border-red-500/20 bg-[var(--color-navy)]">
          <DialogHeader>
            <DialogTitle className="text-red-400">Nuclear Option</DialogTitle>
            <DialogDescription className="text-[var(--color-gold-light)]/60">
              Choose your chaos. Cost: 139 pts.
            </DialogDescription>
          </DialogHeader>

          {!superAction && (
            <div className="space-y-2 py-4">
              <button
                onClick={() => setSuperAction("shuffle_lanes")}
                className="w-full rounded-lg border border-red-500/20 bg-[var(--color-navy-light)] p-3 text-left transition-all hover:border-red-500/40"
              >
                <div className="font-medium text-red-400">Shuffle Lanes</div>
                <div className="text-xs text-[var(--color-gold-light)]/50">
                  Randomize all lane assignments on a team (champs stay)
                </div>
              </button>
              <button
                onClick={() => setSuperAction("reroll_champs")}
                className="w-full rounded-lg border border-red-500/20 bg-[var(--color-navy-light)] p-3 text-left transition-all hover:border-red-500/40"
              >
                <div className="font-medium text-red-400">Reroll Champs</div>
                <div className="text-xs text-[var(--color-gold-light)]/50">
                  Reroll all 5 champions on a team (lanes stay)
                </div>
              </button>
              <button
                onClick={() => setSuperAction("target_reroll")}
                className="w-full rounded-lg border border-red-500/20 bg-[var(--color-navy-light)] p-3 text-left transition-all hover:border-red-500/40"
              >
                <div className="font-medium text-red-400">Target Reroll</div>
                <div className="text-xs text-[var(--color-gold-light)]/50">
                  Reroll one specific player's champion (ally or enemy)
                </div>
              </button>
            </div>
          )}

          {superAction && superAction !== "target_reroll" && (
            <div className="py-4">
              <div className="mb-3 text-center text-sm text-[var(--color-gold-light)]/60">
                Choose a team
              </div>
              <div className="flex justify-center gap-3">
                <Button
                  size="lg"
                  variant={selectedSide === "blue" ? "default" : "outline"}
                  onClick={() => setSelectedSide("blue")}
                  className={
                    selectedSide === "blue"
                      ? "bg-[var(--color-blue-team)] text-white"
                      : "border-[var(--color-blue-team)]/30 text-[var(--color-blue-team)]"
                  }
                >
                  Blue Side
                </Button>
                <Button
                  size="lg"
                  variant={selectedSide === "red" ? "default" : "outline"}
                  onClick={() => setSelectedSide("red")}
                  className={
                    selectedSide === "red"
                      ? "bg-[var(--color-red-team)] text-white"
                      : "border-[var(--color-red-team)]/30 text-[var(--color-red-team)]"
                  }
                >
                  Red Side
                </Button>
              </div>
            </div>
          )}

          {superAction === "target_reroll" && (
            <div className="space-y-2 py-4">
              <div className="mb-2 text-center text-sm text-[var(--color-gold-light)]/60">
                Choose a player
              </div>
              {session.session_assignments.map((a) => (
                <button
                  key={a.player_id}
                  onClick={() => setSelectedPlayerId(a.player_id)}
                  className={`w-full rounded-lg border p-3 text-left transition-all ${
                    selectedPlayerId === a.player_id
                      ? "border-red-500/50 bg-red-500/10"
                      : "border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] hover:border-red-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold ${
                          a.side === "blue" ? "text-[var(--color-blue-team)]" : "text-[var(--color-red-team)]"
                        }`}
                      >
                        {a.side === "blue" ? "B" : "R"}
                      </span>
                      <span className="font-medium text-[var(--color-gold-light)]">
                        {a.players.name}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-gold-light)]/50">
                      {a.lane.toUpperCase()} - {a.champion}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {superAction && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSuperAction(null)
                  setSelectedSide(null)
                  setSelectedPlayerId(null)
                }}
                className="border-[var(--color-gold)]/20 text-[var(--color-gold-light)]/60"
              >
                Back
              </Button>
              <Button
                onClick={handleSuperConfirm}
                disabled={
                  submitting ||
                  (superAction === "target_reroll" ? !selectedPlayerId : !selectedSide)
                }
                className="flex-1 bg-red-500 font-bold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {submitting ? "Executing..." : "Confirm (139 pts)"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
