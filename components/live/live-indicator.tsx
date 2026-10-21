"use client"

import { useLive } from "@/components/live/live-provider"

const LABELS = { connecting: "Connecting", live: "Live", degraded: "Reconnecting" } as const

export function LiveIndicator() {
  const { status } = useLive()
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-gold-light)]/60" title={LABELS[status]}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "bg-green-400" : status === "degraded" ? "bg-amber-400" : "bg-gray-500"}`} />
      {LABELS[status]}
    </span>
  )
}
