"use client"

import { SwordsIcon } from "lucide-react"
import { toast } from "sonner"
import { useLiveSignal } from "@/components/live/live-context"
import { LiveToast } from "@/components/live/live-toast"
import { safeNarrate } from "@/lib/live/coalesce"
import type { LiveEvent, LiveEventPayloads } from "@/lib/live/events"
import { isPersonal } from "@/lib/live/policy"
import { liveTone } from "@/lib/live/tone"
import { narrateDuelEvent } from "@/lib/duels/narration"

const DURATION_MS = 8_500

// lib/live/policy.ts knows the four original duel events; withdrawals and expiries also name who they touch.
function aimedAt(event: LiveEvent, viewerId: string): boolean {
  if (event.type === "duel.withdrawn") {
    return (event.data as LiveEventPayloads["duel.withdrawn"]).opponentUserId === viewerId
  }
  if (event.type === "duel.expired") {
    const ids = (event.data as LiveEventPayloads["duel.expired"]).userIds
    return Array.isArray(ids) && ids.includes(viewerId)
  }
  return isPersonal(event, { userId: viewerId, names: [] })
}

// A gauntlet thrown at you must never go unannounced. The herald (lib/live/narration.ts) normally voices duel
// events; while it has no line for one, this speaks for it, under the herald's own toast id so it never doubles.
export function useDuelFallbackAlerts(viewerId: string | null) {
  useLiveSignal((signal) => {
    if (signal.kind !== "event" || !viewerId) return
    const event = signal.event
    if (!event.type.startsWith("duel.") || event.actor?.userId === viewerId) return
    if (!aimedAt(event, viewerId)) return
    if (safeNarrate(event)) return
    const line = narrateDuelEvent(event)
    if (!line) return
    const tone = liveTone(line.tone)
    toast.custom(
      (id) => (
        <LiveToast
          toastId={id}
          tone={tone}
          kicker="Duel"
          title={line.title}
          description={line.description}
          actor={event.actor}
          icon={SwordsIcon}
          duration={DURATION_MS}
          version={0}
          count={1}
          personal
        />
      ),
      { id: `live-${event.id}`, duration: DURATION_MS }
    )
  })
}
