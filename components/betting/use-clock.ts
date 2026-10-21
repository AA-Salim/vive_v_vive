"use client"

import { useEffect, useState } from "react"
import { BET_RULES } from "@/lib/betting/rules"
import type { MarketSession } from "@/lib/betting/types"

export function useServerNow(serverTimeDelta: number, active: boolean, intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now() - serverTimeDelta)
  useEffect(() => {
    if (!active) return
    const tick = () => setNow(Date.now() - serverTimeDelta)
    const id = setInterval(tick, intervalMs)
    const first = setTimeout(tick, 0)
    return () => {
      clearInterval(id)
      clearTimeout(first)
    }
  }, [serverTimeDelta, active, intervalMs])
  return now
}

export interface MarketClock {
  remainingMs: number | null
  earlyRemainingMs: number
  isEarly: boolean
  isLastCall: boolean
  isExpired: boolean
}

export function marketClock(session: MarketSession | null, now: number): MarketClock {
  const endsAt = session?.betting_ends_at ? new Date(session.betting_ends_at).getTime() : null
  const earlyEndsAt = session?.early_ends_at ? new Date(session.early_ends_at).getTime() : null
  const remainingMs = endsAt != null ? Math.max(0, endsAt - now) : null
  const earlyRemainingMs = earlyEndsAt != null ? Math.max(0, earlyEndsAt - now) : 0
  return {
    remainingMs,
    earlyRemainingMs,
    isEarly: earlyRemainingMs > 0 && (remainingMs == null || remainingMs > 0),
    isLastCall: remainingMs != null && remainingMs > 0 && remainingMs <= BET_RULES.lastCallSeconds * 1000,
    isExpired: remainingMs != null && remainingMs <= 0,
  }
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
