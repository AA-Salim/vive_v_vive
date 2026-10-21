"use client"

import { useSyncExternalStore } from "react"

const listeners = new Set<() => void>()
let current = 0
let timer: ReturnType<typeof setInterval> | null = null

function tick() {
  current = Date.now()
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    current = Date.now()
    timer = setInterval(tick, 500)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

const getSnapshot = () => current
const getServerSnapshot = () => 0

// Shared half-second clock; 0 until the first client subscription.
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useRemainingMs(endsAt: string | null | undefined, serverTimeDelta: number): number | null {
  const now = useNow()
  if (!endsAt || now === 0) return null
  return Math.max(0, Date.parse(endsAt) - (now - serverTimeDelta))
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}
