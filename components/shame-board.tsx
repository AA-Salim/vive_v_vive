"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import { Button } from "@/components/ui/button"
import { ShameDialog } from "@/components/shame-dialog"
import type { ShameEntry } from "@/lib/types"

interface ShameBoardProps {
  userId: string | null
}

function timeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return "expired"
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return "just now"
}

export function ShameBoard({ userId }: ShameBoardProps) {
  const { user } = useAuth()
  const { balance, refetch: refetchPoints } = usePoints(userId)
  const [entries, setEntries] = useState<ShameEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/shame")
      const data = await res.json()
      if (Array.isArray(data)) setEntries(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const handleSuccess = () => {
    fetchEntries()
    refetchPoints()
  }

  if (loading) return null

  return (
    <div className="space-y-2 rounded-lg border border-red-500/15 bg-[var(--color-navy-light)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-red-400">Shame Board</span>
        {user && (
          <Button
            onClick={() => setDialogOpen(true)}
            size="sm"
            variant="ghost"
            className="text-xs text-red-400/70 hover:text-red-400"
          >
            Shame (234 pts)
          </Button>
        )}
      </div>

      {entries.length === 0 && (
        <div className="py-2 text-center text-xs text-[var(--color-gold-light)]/30">
          No one on the board... yet
        </div>
      )}

      {entries.map((entry) => (
        <div
          key={entry.id}
          className="space-y-1.5 rounded-md border border-red-500/10 bg-red-500/5 p-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-red-400">
              {entry.target_player_name}
            </span>
            <span className="text-[10px] text-[var(--color-gold-light)]/40">
              {timeRemaining(entry.expires_at)}
            </span>
          </div>

          <div className="rounded bg-red-500/10 px-2 py-1">
            <span className="text-[10px] text-red-400/70">{entry.worst_stat_label}</span>
            <div className="text-sm font-bold text-red-300">{entry.worst_stat_value}</div>
          </div>

          {entry.recent_losses.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[10px] text-[var(--color-gold-light)]/40">Recent losses</div>
              {entry.recent_losses.slice(0, 3).map((loss, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-[var(--color-gold-light)]/50">
                  <span className="text-red-400/60">{loss.champion}</span>
                  <span>{loss.lane}</span>
                  <span className="ml-auto">{relativeTime(loss.played_at)}</span>
                </div>
              ))}
            </div>
          )}

          {entry.message && (
            <div className="text-xs italic text-[var(--color-gold-light)]/50">
              &ldquo;{entry.message}&rdquo;
            </div>
          )}

          <div className="text-[10px] text-[var(--color-gold-light)]/30">
            by {entry.shamer_username}
          </div>
        </div>
      ))}

      <ShameDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        balance={balance}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
