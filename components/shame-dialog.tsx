"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Player } from "@/lib/types"

interface ShameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  balance: number
  onSuccess: () => void
}

export function ShameDialog({ open, onOpenChange, balance, onSuccess }: ShameDialogProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [targetId, setTargetId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch("/api/players")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPlayers(data.filter((p: Player) => p.is_active))
      })
  }, [open])

  useEffect(() => {
    if (open) {
      setTargetId(null)
      setMessage("")
    }
  }, [open])

  const handleSubmit = async () => {
    if (!targetId) {
      toast.error("Select a player to shame")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/shame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_player_id: targetId, message }),
      })
      if (res.ok) {
        toast.success("Shame deployed!")
        onSuccess()
        onOpenChange(false)
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to shame")
      }
    } catch {
      toast.error("Failed to shame")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Shame a Player</DialogTitle>
          <DialogDescription>
            Cost: 234 pts. Their worst stats will be displayed for 48 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium text-[var(--color-gold-light)]/70">
              Target
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-[var(--color-gold)]/10 bg-[var(--color-navy)] p-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setTargetId(p.id)}
                  className={cn(
                    "w-full rounded-md px-3 py-1.5 text-left text-sm transition-all",
                    targetId === p.id
                      ? "bg-red-500/20 text-red-400"
                      : "text-[var(--color-gold-light)]/70 hover:bg-[var(--color-navy-lighter)]"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--color-gold-light)]/70">
                Message
              </span>
              <span className="text-xs text-[var(--color-gold-light)]/40">
                {message.length}/200
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 200))}
              placeholder="Add a message to the shame board..."
              rows={3}
              className="w-full rounded-md border border-[var(--color-gold)]/10 bg-[var(--color-navy)] px-3 py-2 text-sm text-[var(--color-gold-light)] placeholder:text-[var(--color-gold-light)]/30"
            />
          </div>

          <div className="text-center text-xs text-[var(--color-gold-light)]/50">
            Your balance: {balance} pts
            {balance < 234 && (
              <span className="ml-2 text-red-400">(need 234)</span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!targetId || balance < 234 || submitting}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {submitting ? "Shaming..." : "Shame (234 pts)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
