"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import type { Player } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface ClaimPlayerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClaimPlayerDialog({
  open,
  onOpenChange,
}: ClaimPlayerDialogProps) {
  const { refetchProfile } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch("/api/players")
      .then((r) => r.json())
      .then((data: Array<Player & { auth_user_id?: string | null }>) => {
        setPlayers(data.filter((p) => !p.auth_user_id))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  const handleClaim = async (playerId: string) => {
    setClaiming(true)
    try {
      const res = await fetch("/api/auth/link-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId }),
      })
      if (res.ok) {
        toast.success("Player claimed!")
        await refetchProfile()
        onOpenChange(false)
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to claim player")
      }
    } catch {
      toast.error("Failed to claim player")
    } finally {
      setClaiming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--color-gold)]">
            Claim Your Player
          </DialogTitle>
          <DialogDescription className="text-[var(--color-gold-light)]/60">
            Link your Discord account to a player in the roster.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-4 text-center text-sm text-[var(--color-gold-light)]/50">
            Loading players...
          </div>
        ) : players.length === 0 ? (
          <div className="py-4 text-center text-sm text-[var(--color-gold-light)]/50">
            No unclaimed players available.
          </div>
        ) : (
          <div className="grid gap-2 py-2">
            {players.map((player) => (
              <Button
                key={player.id}
                onClick={() => handleClaim(player.id)}
                disabled={claiming}
                variant="outline"
                className="justify-start border-[var(--color-gold)]/20 text-[var(--color-gold-light)] hover:bg-[var(--color-navy-lighter)] hover:text-[var(--color-gold)]"
              >
                {player.name}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
