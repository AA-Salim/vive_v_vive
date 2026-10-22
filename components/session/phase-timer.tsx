"use client"

import { useEffect, useEffectEvent } from "react"
import { HourglassIcon } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import { useServerNow } from "@/components/session/use-clock"
import { formatCountdown } from "@/components/session/copy"
import type { HelpEntry } from "@/lib/help"
import { cn } from "@/lib/utils"

interface PhaseTimerProps {
  endsAt: number
  durationMs: number
  serverTimeDelta: number
  label: string
  help?: HelpEntry
  onExpired?: () => void
  className?: string
}

const URGENT_MS = 10_000
const MAX_EXPIRY_POKES = 6

export function PhaseTimer({ endsAt, durationMs, serverTimeDelta, label, help, onExpired, className }: PhaseTimerProps) {
  const serverNow = useServerNow(serverTimeDelta, 250)
  const remaining = serverNow === null ? null : Math.max(0, endsAt - serverNow)
  const expired = remaining !== null && remaining <= 0
  const urgent = remaining !== null && remaining <= URGENT_MS && !expired
  const progress = remaining === null ? 1 : Math.min(1, remaining / durationMs)

  const poke = useEffectEvent(() => onExpired?.())
  useEffect(() => {
    if (!expired) return
    let attempts = 0
    let timer = setTimeout(function retry() {
      poke()
      attempts += 1
      if (attempts < MAX_EXPIRY_POKES) timer = setTimeout(retry, 1500 + Math.random() * 700)
    }, 150 + Math.random() * 450)
    return () => clearTimeout(timer)
  }, [expired])

  return (
    <div
      role="timer"
      aria-label={`${label}: ${remaining === null ? "loading" : formatCountdown(remaining)} left`}
      className={cn("flex min-w-[9.5rem] flex-col gap-1.5", className)}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        <HourglassIcon className={cn("size-3.5", urgent && "text-[var(--color-red-team)]")} aria-hidden />
        {expired ? "Time is up" : label}
        {help && <InfoTip help={help} align="end" className="-my-1" />}
      </span>
      <span
        className={cn(
          "font-display text-4xl leading-none font-semibold tabular-nums sm:text-5xl",
          urgent || expired ? "text-[var(--color-red-team)]" : "text-[var(--color-gold)]",
          urgent && "animate-pulse"
        )}
      >
        {remaining === null ? "-:--" : formatCountdown(remaining)}
      </span>
      <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-300 ease-linear",
            urgent || expired ? "bg-[var(--color-red-team)]" : "bg-[var(--color-gold)]"
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </span>
      {expired && <span className="text-xs text-muted-foreground">Sealing the phase...</span>}
    </div>
  )
}

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mmss = `${minutes.toString().padStart(hours ? 2 : 1, "0")}:${seconds.toString().padStart(2, "0")}`
  return hours ? `${hours}:${mmss}` : mmss
}

export function GameClock({ since, serverTimeDelta, className }: { since: number; serverTimeDelta: number; className?: string }) {
  const serverNow = useServerNow(serverTimeDelta, 1000)
  const elapsed = serverNow === null ? null : serverNow - since
  return (
    <div
      role="timer"
      aria-label={`Live for ${elapsed === null ? "a moment" : formatElapsed(elapsed)}`}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-[var(--color-red-team)]" />
        Live for
      </span>
      <span className="font-display text-4xl leading-none font-semibold tabular-nums text-[var(--color-gold)] sm:text-5xl">
        {elapsed === null ? "-:--" : formatElapsed(elapsed)}
      </span>
    </div>
  )
}
