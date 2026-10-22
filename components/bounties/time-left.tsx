"use client"

import { useLive } from "@/components/live/live-context"
import { useLiveNow } from "@/hooks/use-live-now"

export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "any second"
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${Math.max(1, minutes)}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return hours % 24 === 0 ? `${days}d` : `${days}d ${hours % 24}h`
}

// Milliseconds until a server timestamp, on the server clock; null while rendering on the server.
export function useMsLeft(until: string | null): number | null {
  const now = useLiveNow()
  const { clockOffset } = useLive()
  if (!until || !now) return null
  const at = Date.parse(until)
  return Number.isNaN(at) ? null : at - (now - clockOffset)
}

export function TimeLeft({ until, suffix = " left", className }: { until: string; suffix?: string; className?: string }) {
  const ms = useMsLeft(until)
  return (
    <time dateTime={until} className={className} suppressHydrationWarning>
      {ms === null ? "" : `${formatTimeLeft(ms)}${ms > 0 ? suffix : ""}`}
    </time>
  )
}
