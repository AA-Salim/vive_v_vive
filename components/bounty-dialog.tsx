"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import type { Player } from "@/lib/types"

interface BountyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPlaced: () => void
}

export function BountyDialog({
  open,
  onOpenChange,
  onPlaced,
}: BountyDialogProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState("")
  const [amount, setAmount] = useState(50)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetch("/api/players")
        .then((r) => r.json())
        .then((data) => setPlayers(data.players ?? []))
        .catch(() => {})
    }
  }, [open])

  const handlePlace = async () => {
    if (!selectedPlayer || amount < 10) return
    setLoading(true)
    try {
      const res = await fetch("/api/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_player_id: selectedPlayer,
          amount,
        }),
      })
      const data = await res.json()
      if (data.placed) {
        const target = players.find((p) => p.id === selectedPlayer)
        toast.success(
          `Bounty placed on ${target?.name ?? "target"} for ${amount} pts`
        )
        onPlaced()
        onOpenChange(false)
        setSelectedPlayer("")
        setAmount(50)
      } else {
        toast.error(data.error ?? "Failed to place bounty")
      }
    } catch {
      toast.error("Failed to place bounty")
    } finally {
      setLoading(false)
    }
  }

  const payout = Math.floor(amount * 1.5)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-red-400">Place a Bounty</DialogTitle>
          <DialogDescription>
            If the target loses their next game, you get 1.5x back. If they win,
            your bounty is gone. Bounty expires in 7 days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-gold-light)]/50">
              Target
            </label>
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="w-full rounded border border-[var(--color-gold)]/20 bg-[var(--color-navy)] px-3 py-2 text-sm text-[var(--color-gold-light)]"
            >
              <option value="">Select a player...</option>
              {players
                .filter((p) => p.is_active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-gold-light)]/50">
              Amount (10 - 500)
            </label>
            <input
              type="number"
              min={10}
              max={500}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full rounded border border-[var(--color-gold)]/20 bg-[var(--color-navy)] px-3 py-2 text-sm text-[var(--color-gold-light)]"
            />
          </div>

          <div className="rounded border border-red-500/20 bg-red-500/5 p-3 text-center">
            <div className="text-xs text-[var(--color-gold-light)]/50">
              If target loses, you receive
            </div>
            <div className="text-lg font-bold text-red-400">{payout} pts</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePlace}
            disabled={!selectedPlayer || amount < 10 || loading}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            {loading ? "Placing..." : `Place Bounty (${amount} pts)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
