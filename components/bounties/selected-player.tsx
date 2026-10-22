"use client"

import { Button } from "@/components/ui/button"
import { PlayerAvatar } from "@/components/bounties/player-avatar"
import type { RosterPlayer } from "@/lib/bounties/types"
import { cn } from "@/lib/utils"

interface SelectedPlayerProps {
  label: string
  player: RosterPlayer
  hint?: string | null
  tone?: "danger" | "roast"
  disabled?: boolean
  onChange: () => void
}

export function SelectedPlayer({ label, player, hint, tone = "danger", disabled = false, onChange }: SelectedPlayerProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-gold-light)]/80">{label}</p>
      <div
        className={cn(
          "flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2",
          tone === "danger" ? "border-[var(--color-red-team)]/50 bg-[var(--color-red-team)]/10" : "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/10"
        )}
      >
        <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-semibold text-[var(--color-gold-light)]">{player.name}</span>
          {hint && <span className="block truncate text-[11px] text-muted-foreground">{hint}</span>}
        </span>
        <Button type="button" variant="ghost" className="h-10 shrink-0 text-xs" onClick={onChange} disabled={disabled}>
          Change
        </Button>
      </div>
    </div>
  )
}
