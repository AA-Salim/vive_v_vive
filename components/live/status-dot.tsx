"use client"

import { useSyncExternalStore } from "react"
import { motion, useReducedMotion } from "motion/react"
import type { LiveStatus } from "@/components/live/live-context"
import { cn } from "@/lib/utils"

export type LiveDisplayState = LiveStatus | "offline"

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

export function useLiveDisplayState(status: LiveStatus): LiveDisplayState {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
  return online ? status : "offline"
}

export const LIVE_LABELS: Record<LiveDisplayState, string> = {
  connecting: "Connecting",
  live: "Live",
  degraded: "Reconnecting",
  offline: "Offline",
}

const DOT: Record<LiveDisplayState, string> = {
  connecting: "bg-muted-foreground",
  live: "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60",
  degraded: "bg-amber-400",
  offline: "bg-[var(--color-red-team)]",
}

// pulseKey changes (e.g. the last event time) trigger a one-shot ripple: the dot flashes when news arrives.
export function StatusDot({
  state,
  pulseKey,
  className,
}: {
  state: LiveDisplayState
  pulseKey?: number | null
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)} aria-hidden>
      {state === "connecting" && (
        <span className="absolute inset-0 rounded-full bg-muted-foreground opacity-60 motion-safe:animate-ping" />
      )}
      {state === "live" && pulseKey && !reduceMotion ? (
        <motion.span
          key={pulseKey}
          className="absolute inset-0 rounded-full bg-emerald-400"
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      ) : null}
      <span className={cn("relative inline-flex size-2 rounded-full", DOT[state])} />
    </span>
  )
}
