"use client"

import { useState, type ReactNode } from "react"
import { RotateCcwIcon, SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PlayerAvatar } from "@/components/bounties/player-avatar"
import type { RosterPlayer } from "@/lib/bounties/types"
import { cn } from "@/lib/utils"

interface PlayerPickerProps {
  id: string
  label: string
  players: RosterPlayer[] | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
  value: string | null
  onChange: (playerId: string) => void
  blockedReason?: (player: RosterPlayer) => string | null
  hint?: (player: RosterPlayer) => string | null
  meta?: (player: RosterPlayer) => ReactNode
  tone?: "danger" | "roast"
}

const TONES = {
  danger: {
    selected: "border-[var(--color-red-team)]/60 bg-[var(--color-red-team)]/15",
    ring: "focus-visible:ring-[var(--color-red-team)]/50",
  },
  roast: {
    selected: "border-[var(--color-gold)]/60 bg-[var(--color-gold)]/10",
    ring: "focus-visible:ring-[var(--color-gold)]/50",
  },
}

export function PlayerPicker({
  id,
  label,
  players,
  loading,
  error,
  onRetry,
  value,
  onChange,
  blockedReason,
  hint,
  meta,
  tone = "danger",
}: PlayerPickerProps) {
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const visible = (players ?? []).filter((p) => !needle || p.name.toLowerCase().includes(needle))
  const styles = TONES[tone]

  return (
    <div className="space-y-2">
      <label htmlFor={`${id}-search`} className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-gold-light)]/80">
        {label}
      </label>
      <div className="relative">
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={`${id}-search`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the court..."
          autoComplete="off"
          className="h-10 pl-9"
        />
      </div>
      <div role="radiogroup" aria-label={label} className="max-h-60 space-y-1 overflow-y-auto overscroll-contain pr-1">
        {loading ? (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)
        ) : error ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            The court roll could not be read.
            <Button variant="outline" className="h-10" onClick={onRetry}>
              <RotateCcwIcon aria-hidden />
              Retry
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="p-3 text-center text-xs text-muted-foreground">Nobody by that name. Lucky them.</p>
        ) : (
          visible.map((player) => {
            const blocked = blockedReason?.(player) ?? null
            const selected = player.playerId === value
            const sub = blocked ?? hint?.(player) ?? null
            return (
              <button
                key={player.playerId}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={!!blocked || undefined}
                disabled={!!blocked}
                onClick={() => onChange(player.playerId)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-lg border px-2.5 py-1.5 text-left transition-colors outline-none focus-visible:ring-2",
                  styles.ring,
                  selected ? styles.selected : "border-transparent hover:border-border hover:bg-[var(--color-navy)]/60",
                  blocked && "cursor-not-allowed opacity-50"
                )}
              >
                <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-[var(--color-gold-light)]">{player.name}</span>
                  {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
                </span>
                {meta?.(player)}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
