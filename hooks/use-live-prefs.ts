"use client"

import { useSyncExternalStore } from "react"

export interface LivePrefs {
  quiet: boolean
  sound: boolean
  vibrate: boolean
}

const STORAGE_KEY = "vvv-live-prefs"
const DEFAULT_PREFS: LivePrefs = { quiet: false, sound: false, vibrate: false }

const listeners = new Set<() => void>()
let cachedRaw: string | null | undefined
let cached: LivePrefs = DEFAULT_PREFS
let memory: string | null = null

function parse(raw: string | null): LivePrefs {
  if (!raw) return DEFAULT_PREFS
  try {
    const value = JSON.parse(raw) as Partial<LivePrefs>
    return {
      quiet: value.quiet === true,
      sound: value.sound === true,
      vibrate: value.vibrate === true,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function readRaw(): string | null {
  if (memory !== null) return memory
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function persist(raw: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, raw)
  } catch {
    memory = raw
  }
}

export function getLivePrefs(): LivePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS
  const raw = readRaw()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cached = parse(raw)
  }
  return cached
}

export function setLivePrefs(patch: Partial<LivePrefs>): void {
  persist(JSON.stringify({ ...getLivePrefs(), ...patch }))
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

// Per-device notification preferences (quiet mode, sound, vibration), synced across tabs.
export function useLivePrefs(): [LivePrefs, (patch: Partial<LivePrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, getLivePrefs, () => DEFAULT_PREFS)
  return [prefs, setLivePrefs]
}
