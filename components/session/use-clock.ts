"use client"

import { useCallback, useSyncExternalStore } from "react"

const TICK_MS = 50

let now = 0
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, TICK_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

function subscribeNever() {
  return () => {}
}

// Shared ticking clock. Each caller only re-renders when its own resolution bucket changes.
export function useNow(resolutionMs: number, enabled = true): number | null {
  const getSnapshot = useCallback(() => (now === 0 ? null : Math.floor(now / resolutionMs) * resolutionMs), [resolutionMs])
  return useSyncExternalStore(enabled ? subscribe : subscribeNever, getSnapshot, () => null)
}

export function useServerNow(serverTimeDelta: number, resolutionMs: number, enabled = true): number | null {
  const local = useNow(resolutionMs, enabled)
  return local === null ? null : local - serverTimeDelta
}
