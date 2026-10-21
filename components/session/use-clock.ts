"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"

const MIN_TICK_MS = 50

let now = 0
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Map<() => void, number>()

// Ticks at the finest resolution anyone currently needs, aligned to that resolution's boundaries,
// so a 1s clock wakes once per second and only the reveal asks for 50ms frames.
function schedule() {
  if (timer) clearTimeout(timer)
  timer = null
  if (listeners.size === 0) return
  const step = Math.max(MIN_TICK_MS, Math.min(...listeners.values()))
  timer = setTimeout(() => {
    now = Date.now()
    listeners.forEach((_, listener) => listener())
    schedule()
  }, step - (Date.now() % step) + 1)
}

function subscribeAt(resolutionMs: number) {
  return (listener: () => void) => {
    if (listeners.size === 0) now = Date.now()
    listeners.set(listener, resolutionMs)
    schedule()
    return () => {
      listeners.delete(listener)
      schedule()
    }
  }
}

function subscribeNever() {
  return () => {}
}

// Shared ticking clock. Each caller only re-renders when its own resolution bucket changes.
export function useNow(resolutionMs: number, enabled = true): number | null {
  const subscribe = useMemo(() => subscribeAt(resolutionMs), [resolutionMs])
  const getSnapshot = useCallback(() => (now === 0 ? null : Math.floor(now / resolutionMs) * resolutionMs), [resolutionMs])
  return useSyncExternalStore(enabled ? subscribe : subscribeNever, getSnapshot, () => null)
}

export function useServerNow(serverTimeDelta: number, resolutionMs: number, enabled = true): number | null {
  const local = useNow(resolutionMs, enabled)
  return local === null ? null : local - serverTimeDelta
}
