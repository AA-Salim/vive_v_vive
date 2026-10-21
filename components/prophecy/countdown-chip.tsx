"use client"

import { TimerIcon } from "lucide-react"
import { formatClock } from "@/components/prophecy/use-now"
import { cn } from "@/lib/utils"

const URGENT_MS = 30_000

export function CountdownChip({ msLeft, label = "Ballots close in" }: { msLeft: number; label?: string }) {
  const urgent = msLeft <= URGENT_MS
  const clock = formatClock(msLeft)
  return (
    <span
      role="timer"
      aria-label={`${label} ${clock}`}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold tabular-nums",
        urgent ? "bg-destructive/15 text-destructive motion-safe:animate-pulse" : "bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
      )}
    >
      <TimerIcon className="size-4" aria-hidden />
      {clock}
    </span>
  )
}

export function TimeBar({ msLeft, totalMs }: { msLeft: number; totalMs: number }) {
  const ratio = totalMs > 0 ? Math.max(0, Math.min(1, msLeft / totalMs)) : 0
  return (
    <div aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-linear",
          msLeft <= URGENT_MS ? "bg-destructive" : "bg-[var(--color-gold)]"
        )}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}
