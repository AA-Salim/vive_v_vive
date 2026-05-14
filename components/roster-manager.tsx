"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase-client"
import type { Player } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
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

interface RosterManagerProps {
  onRandomize: (players: Player[]) => void
  onCoachDraft?: () => void
  disabled?: boolean
}

export function RosterManager({ onRandomize, onCoachDraft, disabled }: RosterManagerProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null)

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch("/api/players")
      const data = await res.json()
      if (Array.isArray(data)) setPlayers(data)
    } catch {
      toast.error("Failed to load players")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlayers()
  }, [fetchPlayers])

  const addPlayer = async () => {
    const name = newName.trim()
    if (!name) return

    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })

    if (res.ok) {
      const player = await res.json()
      setPlayers((prev) => [...prev, player].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName("")
      toast.success(`${name} added`)
    } else {
      const err = await res.json()
      toast.error(err.error || "Failed to add player")
    }
  }

  const deletePlayer = async () => {
    if (!deleteTarget) return

    const res = await fetch(`/api/players/${deleteTarget.id}`, {
      method: "DELETE",
    })

    if (res.ok) {
      setPlayers((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(deleteTarget.id)
        return next
      })
      toast.success(`${deleteTarget.name} removed`)
    } else {
      toast.error("Failed to remove player")
    }
    setDeleteTarget(null)
  }

  const toggleActive = async (player: Player) => {
    const res = await fetch(`/api/players/${player.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !player.is_active }),
    })

    if (res.ok) {
      const updated = await res.json()
      setPlayers((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      )
      if (!updated.is_active) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(updated.id)
          return next
        })
      }
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const activePlayers = players.filter((p) => p.is_active)
  const inactivePlayers = players.filter((p) => !p.is_active)
  const selectedCount = selectedIds.size

  const selectAll = () => {
    setSelectedIds(new Set(activePlayers.map((p) => p.id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const handleRandomize = () => {
    const selected = players.filter((p) => selectedIds.has(p.id))
    onRandomize(selected)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPlayer()}
          placeholder="Player name..."
          className="bg-[var(--color-navy)]/50"
        />
        <Button onClick={addPlayer} size="sm" variant="outline">
          Add
        </Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search players..."
        className="bg-[var(--color-navy)]/30 text-sm"
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-sm font-medium",
                selectedCount === 10
                  ? "text-green-400"
                  : selectedCount > 10
                    ? "text-red-400"
                    : "text-[var(--color-gold-light)]/70"
              )}
            >
              {selectedCount}/10 selected
            </span>
            <div className="flex gap-2">
              <Button
                onClick={selectAll}
                size="sm"
                variant="ghost"
                className="text-xs"
              >
                Select All
              </Button>
              <Button
                onClick={deselectAll}
                size="sm"
                variant="ghost"
                className="text-xs"
              >
                Deselect
              </Button>
            </div>
          </div>

          <div className="max-h-[400px] space-y-1 overflow-y-auto pr-1">
            {activePlayers
              .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
              .map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--color-navy-lighter)]"
                >
                  <Checkbox
                    checked={selectedIds.has(player.id)}
                    onCheckedChange={() => toggleSelection(player.id)}
                  />
                  <span className="flex-1 truncate text-sm text-[var(--color-gold-light)]">
                    {player.name}
                  </span>
                  <Button
                    onClick={() => toggleActive(player)}
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1 text-[10px] text-[var(--color-gold-light)]/40"
                    title="Set inactive"
                  >
                    Bench
                  </Button>
                  <Button
                    onClick={() => setDeleteTarget(player)}
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1 text-[10px] text-red-400/60 hover:text-red-400"
                  >
                    X
                  </Button>
                </div>
              ))}

            {inactivePlayers.length > 0 && (
              <>
                <div className="pt-2 pb-1 text-xs text-[var(--color-gold-light)]/40">
                  Benched
                </div>
                {inactivePlayers
                  .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
                  .map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 opacity-50"
                    >
                      <span className="flex-1 truncate text-sm text-[var(--color-gold-light)]/60">
                        {player.name}
                      </span>
                      <Button
                        onClick={() => toggleActive(player)}
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1 text-[10px] text-green-400/60"
                        title="Reactivate"
                      >
                        Activate
                      </Button>
                      <Button
                        onClick={() => setDeleteTarget(player)}
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1 text-[10px] text-red-400/60 hover:text-red-400"
                      >
                        X
                      </Button>
                    </div>
                  ))}
              </>
            )}
          </div>

          <Button
            onClick={handleRandomize}
            disabled={selectedCount !== 10 || disabled}
            className="w-full bg-[var(--color-gold)] font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)] disabled:opacity-40"
          >
            {selectedCount !== 10
              ? `Select ${10 - selectedCount} more player${10 - selectedCount !== 1 ? "s" : ""}`
              : "Randomize Teams"}
          </Button>

          {onCoachDraft && (
            <Button
              onClick={onCoachDraft}
              disabled={disabled}
              variant="outline"
              className="w-full border-purple-500/30 text-purple-400 hover:border-purple-500/60 hover:bg-purple-500/10"
            >
              Coach Draft
            </Button>
          )}

          {selectedCount > 10 && (
            <p className="text-center text-xs text-red-400">
              Too many players selected. Deselect {selectedCount - 10}.
            </p>
          )}
        </>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              This will permanently delete this player and all their stats.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deletePlayer}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
