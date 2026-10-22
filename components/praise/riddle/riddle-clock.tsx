"use client"

import { useEffect, useState } from "react"
import { TimerIcon } from "lucide-react"
import { formatClock } from "@/lib/praise/format"
import { cn } from "@/lib/utils"

const WARN_MS = 10_000
const TICK_MS = 250

interface RiddleClockProps {
  deadline: string
  // Seconds on the clock for this riddle, for the bar.
  limit: number
  clockOffset: number
  onExpire: () => void
}

// The riddle's countdown on server time, with a draining bar that turns red in the last 10 seconds. The server
// holds the real deadline; onExpire fires once when the clock reaches zero on screen.
export function RiddleClock({ deadline, limit, clockOffset, onExpire }: RiddleClockProps) {
  const [now, setNow] = useState(() => Date.now())
  const left = Math.max(0, Date.parse(deadline) - (now - clockOffset))
  const expired = left <= 0
  const warn = left <= WARN_MS
  const fill = Math.min(100, (left / (limit * 1000)) * 100)

  useEffect(() => {
    if (expired) return
    const interval = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(interval)
  }, [expired])

  useEffect(() => {
    if (expired) onExpire()
  }, [expired, onExpire])

  return (
    <div className="min-w-0 flex-1 space-y-1" role="timer" aria-label={`Time left: ${formatClock(left)}`}>
      <div className={cn("flex items-center justify-end gap-1 text-xs font-semibold tabular-nums", warn ? "text-destructive" : "text-foreground")}>
        <TimerIcon className={cn("size-3.5", warn && !expired && "motion-safe:animate-pulse")} aria-hidden />
        {formatClock(left)}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full transition-[width,background-color] duration-300 ease-linear",
            warn ? "bg-destructive" : "bg-[var(--color-hextech)]"
          )}
          style={{ width: `${fill}%` }}
        />
      </div>
    </div>
  )
}
