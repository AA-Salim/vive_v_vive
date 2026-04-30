"use client"

import { useState, useEffect, useCallback } from "react"

interface ChaosTimerProps {
  chaosEndsAt: string
  serverTimeDelta: number
  onExpired: () => void
}

export function ChaosTimer({
  chaosEndsAt,
  serverTimeDelta,
  onExpired,
}: ChaosTimerProps) {
  const getRemaining = useCallback(() => {
    const serverNow = Date.now() - serverTimeDelta
    return Math.max(0, new Date(chaosEndsAt).getTime() - serverNow)
  }, [chaosEndsAt, serverTimeDelta])

  const [remaining, setRemaining] = useState(getRemaining)

  useEffect(() => {
    setRemaining(getRemaining())
    const interval = setInterval(() => {
      const r = getRemaining()
      setRemaining(r)
      if (r <= 0) {
        clearInterval(interval)
        onExpired()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [getRemaining, onExpired])

  const totalSeconds = Math.ceil(remaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  const totalDuration = 90 * 1000
  const progress = Math.max(0, remaining / totalDuration)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-sm font-medium text-red-400/70">
        Royal Decrees close in
      </div>
      <div className="text-3xl font-bold tabular-nums text-red-400">
        {minutes}:{seconds.toString().padStart(2, "0")}
      </div>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-[var(--color-navy-lighter)]">
        <div
          className="h-full rounded-full bg-red-500 transition-all duration-1000"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}
