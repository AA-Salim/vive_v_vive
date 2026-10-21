"use client"

import { useEffect, useEffectEvent } from "react"

const SETTLE_RETRIES = 8
const SETTLE_RETRY_MS = 2_500
const SETTLE_GRACE_MS = 700

// Votes close lazily: the first read after closes_at settles them, so poke the server when the gavel is due.
export function useSettleWhenDue(
  closesAt: number | null,
  settled: boolean,
  clockOffset: number,
  refetch: () => unknown
) {
  const msUntilDue = useEffectEvent(() => (closesAt ?? 0) - (Date.now() - clockOffset))
  const poke = useEffectEvent(() => {
    void refetch()
  })
  useEffect(() => {
    if (closesAt === null || settled) return
    let attempts = 0
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      poke()
      attempts += 1
      if (attempts < SETTLE_RETRIES) timer = setTimeout(tick, SETTLE_RETRY_MS)
    }
    timer = setTimeout(tick, Math.max(0, msUntilDue()) + SETTLE_GRACE_MS)
    return () => clearTimeout(timer)
  }, [closesAt, settled])
}
