"use client"

import { useEffect, useRef, useState } from "react"
import { formatCountdown } from "@/lib/praise/format"

const HOUR = 60 * 60 * 1000
const RETRY_MS = 5000

interface PraiseCountdownProps {
  target: string
  clockOffset: number
  onElapsed?: () => void
  className?: string
}

export function PraiseCountdown({ target, clockOffset, onElapsed, className }: PraiseCountdownProps) {
  const [now, setNow] = useState(() => Date.now())
  const lastFired = useRef<number | null>(null)
  const remaining = Date.parse(target) - (now - clockOffset)
  const fast = remaining < HOUR

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), fast ? 1000 : 15_000)
    return () => clearInterval(interval)
  }, [fast])

  // Keeps asking until the server agrees the day has turned: the local clock can run slightly ahead.
  useEffect(() => {
    if (remaining > 0) return
    if (lastFired.current !== null && now - lastFired.current < RETRY_MS) return
    lastFired.current = now
    onElapsed?.()
  }, [remaining, now, onElapsed])

  return (
    <time dateTime={target} className={className}>
      {formatCountdown(remaining)}
    </time>
  )
}
