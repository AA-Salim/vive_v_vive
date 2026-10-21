"use client"

import { CheckIcon } from "lucide-react"
import { FormDots, WinRate, relativeDays } from "@/components/lobby/player-stats"
import { PlayerAdminMenu, type PlayerIntent } from "@/components/lobby/roster/player-admin-menu"
import type { RosterPlayer } from "@/lib/lobby/types"
import { cn } from "@/lib/utils"

interface RosterRowProps {
  player: RosterPlayer
  selected: boolean
  full: boolean
  isMe: boolean
  queuePosition: number | null
  isAdmin: boolean
  now: number
  onToggle: (player: RosterPlayer) => void
  onIntent: (intent: PlayerIntent, player: RosterPlayer) => void
}

export function RosterRow({ player, selected, full, isMe, queuePosition, isAdmin, now, onToggle, onIntent }: RosterRowProps) {
  const seen = relativeDays(player.last_played_at, now)
  const meta = [`${player.games_played} game${player.games_played === 1 ? "" : "s"}`, seen].filter(Boolean).join(" · ")

  if (!player.is_active) {
    return (
      <li className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-1.5 opacity-70">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-muted-foreground">{player.name}</span>
          <span className="block text-[11px] text-muted-foreground/80">Benched · {meta}</span>
        </span>
        {isAdmin && <PlayerAdminMenu player={player} queued={false} onIntent={onIntent} />}
      </li>
    )
  }

  return (
    <li
      className={cn(
        "flex items-center rounded-xl border transition-colors",
        selected
          ? "border-[var(--color-gold)]/45 bg-[var(--color-gold)]/[0.07]"
          : "border-transparent bg-muted/25 hover:border-border hover:bg-muted/45"
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        onClick={() => onToggle(player)}
        className={cn(
          "flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          full && !selected && "opacity-60"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
            selected ? "border-[var(--color-gold)] bg-[var(--color-gold)] text-[var(--color-navy)]" : "border-[var(--color-gold)]/30"
          )}
        >
          {selected && <CheckIcon className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn("truncate text-sm font-medium", selected ? "text-[var(--color-gold-light)]" : "text-[var(--color-gold-light)]/85")}>
              {player.name}
            </span>
            {isMe && (
              <span className="shrink-0 rounded-full bg-[var(--color-gold)]/15 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-gold)]">
                You
              </span>
            )}
            {queuePosition !== null && (
              <span className="shrink-0 rounded-full border border-[var(--color-gold)]/25 px-1.5 text-[10px] font-medium tabular-nums text-[var(--color-gold-light)]/80">
                Queue #{queuePosition}
              </span>
            )}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">{meta}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <WinRate player={player} />
          <FormDots form={player.form} />
        </span>
      </button>
      {isAdmin && (
        <span className="pr-1">
          <PlayerAdminMenu player={player} queued={queuePosition !== null} onIntent={onIntent} />
        </span>
      )}
    </li>
  )
}
