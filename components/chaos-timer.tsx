"use client"

import { PhaseTimer } from "@/components/session/phase-timer"
import { CHAOS_DURATION_MS } from "@/lib/session/constants"

interface ChaosTimerProps {
  chaosEndsAt: string
  serverTimeDelta: number
  onExpired?: () => void
}

export function ChaosTimer({ chaosEndsAt, serverTimeDelta, onExpired }: ChaosTimerProps) {
  return (
    <PhaseTimer
      endsAt={Date.parse(chaosEndsAt)}
      durationMs={CHAOS_DURATION_MS}
      serverTimeDelta={serverTimeDelta}
      label="Decrees close in"
      onExpired={onExpired}
    />
  )
}
