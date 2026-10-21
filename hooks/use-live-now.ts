"use client"

import { useSyncExternalStore } from "react"

const TICK_MS = 5_000
const listeners = new Set<() => void>()
let now = 0
let timer: ReturnType<typeof setInterval> | null = null

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

function getSnapshot() {
  if (now === 0) now = Date.now()
  return now
}

// One shared clock that ticks every few seconds for relative timestamps; 0 during server rendering.
export function useLiveNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}
