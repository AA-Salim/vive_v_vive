"use client"

import { useEffect, useRef, useState } from "react"
import { formatCountdown } from "@/lib/praise/format"

const HOUR = 60 * 60 * 1000

interface PraiseCountdownProps {
  target: string
  clockOffset: number
  onElapsed?: () => void
  className?: string
}

export function PraiseCountdown({ target, clockOffset, onElapsed, className }: PraiseCountdownProps) {
  const [now, setNow] = useState(() => Date.now())
  const firedFor = useRef<string | null>(null)
  const remaining = Date.parse(target) - (now - clockOffset)
  const fast = remaining < HOUR

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), fast ? 1000 : 15_000)
    return () => clearInterval(interval)
  }, [fast])

  useEffect(() => {
    if (remaining > 0 || firedFor.current === target) return
    firedFor.current = target
    onElapsed?.()
  }, [remaining, target, onElapsed])

  return (
    <time dateTime={target} className={className}>
      {formatCountdown(remaining)}
    </time>
  )
}
