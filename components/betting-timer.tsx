"use client"

import { PhaseTimer } from "@/components/session/phase-timer"
import { BETTING_DURATION_MS } from "@/lib/session/constants"

interface BettingTimerProps {
  bettingEndsAt: string
  serverTimeDelta: number
  onExpired?: () => void
}

export function BettingTimer({ bettingEndsAt, serverTimeDelta, onExpired }: BettingTimerProps) {
  return (
    <PhaseTimer
      endsAt={Date.parse(bettingEndsAt)}
      durationMs={BETTING_DURATION_MS}
      serverTimeDelta={serverTimeDelta}
      label="Bets lock in"
      onExpired={onExpired}
    />
  )
}
