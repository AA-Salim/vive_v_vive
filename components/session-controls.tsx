"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { SessionWithAssignments } from "@/lib/types"

interface SessionControlsProps {
  session: SessionWithAssignments
  onAction: () => void
}

export function SessionControls({ session, onAction }: SessionControlsProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  const isCreator = user && session.created_by === user.id

  const patchSession = async (
    action: string,
    extra?: Record<string, string>
  ) => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || `Failed to ${action}`)
      }
      onAction()
    } catch {
      toast.error(`Failed to ${action}`)
    } finally {
      setLoading(false)
    }
  }

  if (!isCreator) return null

  if (session.status === "draft") {
    return (
      <>
        <Button
          onClick={() => patchSession("start_game")}
          disabled={loading}
          className="bg-[var(--color-gold)] font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
        >
          {loading ? "Starting..." : "Start Game"}
        </Button>
        <Button
          onClick={() => patchSession("cancel")}
          disabled={loading}
          variant="ghost"
          className="text-[var(--color-gold-light)]/50"
        >
          Cancel
        </Button>
      </>
    )
  }

  if (session.status === "betting") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => patchSession("close_betting")}
          disabled={loading}
          className="bg-[var(--color-gold)] font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
        >
          {loading ? "Closing..." : "Close Betting Early"}
        </Button>
        <Button
          onClick={() => patchSession("cancel")}
          disabled={loading}
          variant="ghost"
          className="text-[var(--color-gold-light)]/50"
        >
          Cancel
        </Button>
      </div>
    )
  }

  if (session.status === "in_game") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => patchSession("declare_winner", { winner_side: "blue" })}
          disabled={loading}
          className="bg-[var(--color-blue-team)] font-bold text-white hover:bg-[var(--color-blue-team)]/80"
        >
          {loading ? "Saving..." : "Blue Side Wins"}
        </Button>
        <Button
          onClick={() => patchSession("declare_winner", { winner_side: "red" })}
          disabled={loading}
          className="bg-[var(--color-red-team)] font-bold text-white hover:bg-[var(--color-red-team)]/80"
        >
          {loading ? "Saving..." : "Red Side Wins"}
        </Button>
        <Button
          onClick={() => patchSession("cancel")}
          disabled={loading}
          variant="ghost"
          className="text-[var(--color-gold-light)]/50"
        >
          Cancel
        </Button>
      </div>
    )
  }

  return null
}
