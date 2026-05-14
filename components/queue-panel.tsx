"use client"

import { useEffect, useState, useCallback } from "react"
import type { QueueEntry } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface QueuePanelProps {
  currentPlayerId: string | null
  onUpdate?: () => void
}

export function QueuePanel({ currentPlayerId, onUpdate }: QueuePanelProps) {
  const [queue, setQueue] = useState<(QueueEntry & { players?: { id: string; name: string } })[]>([])
  const [loading, setLoading] = useState(true)

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/queue")
      const data = await res.json()
      if (Array.isArray(data)) setQueue(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // Re-fetch on external updates
  useEffect(() => {
    fetchQueue()
  }, [onUpdate, fetchQueue])

  const isInQueue = currentPlayerId
    ? queue.some((q) => q.player_id === currentPlayerId)
    : false

  const handleJoin = async () => {
    if (!currentPlayerId) return
    const res = await fetch("/api/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", player_id: currentPlayerId }),
    })
    if (res.ok) {
      fetchQueue()
    } else {
      const err = await res.json()
      toast.error(err.error || "Failed to join queue")
    }
  }

  const handleLeave = async () => {
    if (!currentPlayerId) return
    const res = await fetch("/api/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave", player_id: currentPlayerId }),
    })
    if (res.ok) {
      fetchQueue()
    } else {
      const err = await res.json()
      toast.error(err.error || "Failed to leave queue")
    }
  }

  if (loading) {
    return <div className="text-xs text-[var(--color-gold-light)]/40">Loading queue...</div>
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-gold)]">
          Queue ({queue.length})
        </span>
        <span className="text-xs text-[var(--color-gold-light)]/50">
          {queue.length >= 5 ? "Full rotation ready" : `${5 - queue.length} more for full rotation`}
        </span>
      </div>

      {queue.length > 0 && (
        <div className="space-y-1">
          {queue.map((entry, i) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 text-xs text-[var(--color-gold-light)]/70"
            >
              <span className="w-4 text-[var(--color-gold-light)]/40">{i + 1}.</span>
              <span>{entry.players?.name || "Unknown"}</span>
            </div>
          ))}
        </div>
      )}

      {queue.length === 0 && (
        <div className="text-xs text-[var(--color-gold-light)]/40">No players waiting</div>
      )}

      {currentPlayerId && (
        <div className="pt-1">
          {isInQueue ? (
            <Button
              onClick={handleLeave}
              size="sm"
              variant="outline"
              className="w-full border-red-500/30 text-xs text-red-400 hover:border-red-500/60"
            >
              Leave Queue
            </Button>
          ) : (
            <Button
              onClick={handleJoin}
              size="sm"
              variant="outline"
              className="w-full border-[var(--color-gold)]/30 text-xs text-[var(--color-gold-light)] hover:border-[var(--color-gold)]/60"
            >
              Join Queue
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
