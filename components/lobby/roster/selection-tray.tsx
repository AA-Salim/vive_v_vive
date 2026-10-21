"use client"

import { AnimatePresence, motion } from "motion/react"
import { RotateCcwIcon, UsersRoundIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LOBBY_SIZE } from "@/lib/lobby/constants"
import type { RosterPlayer } from "@/lib/lobby/types"
import { cn } from "@/lib/utils"

interface SelectionTrayProps {
  selected: RosterPlayer[]
  queueReady: number
  canRematch: boolean
  onRemove: (player: RosterPlayer) => void
  onSeatQueue: () => void
  onRematch: () => void
  onClear: () => void
}

function Pips({ count }: { count: number }) {
  const full = count === LOBBY_SIZE
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: LOBBY_SIZE }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-3 rounded-full transition-colors duration-300 sm:w-4",
            i < count
              ? full
                ? "bg-[var(--color-gold)] shadow-[0_0_8px_var(--color-gold)]"
                : count > LOBBY_SIZE
                  ? "bg-[var(--color-red-team)]/80"
                  : "bg-[var(--color-gold)]/80"
              : "bg-muted"
          )}
        />
      ))}
    </span>
  )
}

export function SelectionTray({ selected, queueReady, canRematch, onRemove, onSeatQueue, onRematch, onClear }: SelectionTrayProps) {
  const count = selected.length
  const seats = Array.from({ length: Math.max(LOBBY_SIZE, count) }, (_, i) => selected[i] ?? null)
  const status =
    count === LOBBY_SIZE
      ? "Ten souls. Ready to roll."
      : count > LOBBY_SIZE
        ? `${count - LOBBY_SIZE} too many to roll. A coach draft can pick ten of them.`
        : `${LOBBY_SIZE - count} seat${LOBBY_SIZE - count === 1 ? "" : "s"} left.`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3">
          <Pips count={count} />
          <span
            className={cn(
              "font-display text-lg leading-none font-semibold tabular-nums",
              count === LOBBY_SIZE ? "text-[var(--color-gold)]" : count > LOBBY_SIZE ? "text-[var(--color-red-team)]" : "text-foreground"
            )}
            aria-live="polite"
          >
            {count}/{LOBBY_SIZE}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{status}</p>
      </div>

      <ul className="grid grid-cols-5 gap-1.5" aria-label="Selected players">
        <AnimatePresence initial={false} mode="popLayout">
          {seats.map((player, i) =>
            player ? (
              <motion.li
                key={player.id}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.18 }}
              >
                <button
                  type="button"
                  onClick={() => onRemove(player)}
                  title={`Remove ${player.name}`}
                  aria-label={`Remove ${player.name}`}
                  className={cn(
                    "group/seat relative flex h-10 w-full items-center justify-center rounded-lg border px-1 text-xs font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    i < LOBBY_SIZE
                      ? "border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 text-[var(--color-gold-light)] hover:border-[var(--color-red-team)]/50 hover:bg-[var(--color-red-team)]/10"
                      : "border-[var(--color-red-team)]/40 bg-[var(--color-red-team)]/10 text-[var(--color-gold-light)]/80"
                  )}
                >
                  <span className="truncate">{player.name}</span>
                  <XIcon
                    className="absolute top-0.5 right-0.5 size-3 text-muted-foreground opacity-0 transition-opacity group-hover/seat:opacity-100 group-focus-visible/seat:opacity-100"
                    aria-hidden
                  />
                </button>
              </motion.li>
            ) : (
              <motion.li key={`seat-${i}`} layout aria-hidden>
                <span className="flex h-10 w-full items-center justify-center rounded-lg border border-dashed border-[var(--color-gold)]/20 text-[11px] tabular-nums text-muted-foreground/60">
                  {i + 1}
                </span>
              </motion.li>
            )
          )}
        </AnimatePresence>
      </ul>

      {(queueReady > 0 || canRematch || count > 0) && (
        <div className="flex flex-wrap gap-2">
          {queueReady > 0 && (
            <Button variant="outline" className="h-10 gap-2 rounded-full px-3.5 text-xs" onClick={onSeatQueue}>
              <UsersRoundIcon aria-hidden />
              Seat the queue
              <span className="rounded-full bg-[var(--color-gold)]/15 px-1.5 tabular-nums text-[var(--color-gold)]">{queueReady}</span>
            </Button>
          )}
          {canRematch && (
            <Button variant="outline" className="h-10 gap-2 rounded-full px-3.5 text-xs" onClick={onRematch}>
              <RotateCcwIcon aria-hidden />
              Same ten as last game
            </Button>
          )}
          {count > 0 && (
            <Button variant="ghost" className="h-10 rounded-full px-3.5 text-xs text-muted-foreground hover:text-[var(--color-red-team)]" onClick={onClear}>
              <XIcon aria-hidden />
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
