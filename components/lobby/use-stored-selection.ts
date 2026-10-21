"use client"

import { useCallback, useSyncExternalStore } from "react"

export const SELECTION_KEY = "vvv_last_selected_players"
const SELECTION_EVENT = "vvv:roster-selection"
const EMPTY: string[] = []

let cachedRaw: string | null = null
let cachedIds: string[] = EMPTY
let memory: string | null | undefined

function readRaw(): string | null {
  if (memory !== undefined) return memory
  try {
    return window.localStorage.getItem(SELECTION_KEY)
  } catch {
    return null
  }
}

function read(): string[] {
  const raw = readRaw()
  if (raw === cachedRaw) return cachedIds
  cachedRaw = raw
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : []
    cachedIds = Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === "string"))] : EMPTY
  } catch {
    cachedIds = EMPTY
  }
  return cachedIds
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === SELECTION_KEY) onChange()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(SELECTION_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(SELECTION_EVENT, onChange)
  }
}

export function readStoredSelection(): string[] {
  return typeof window === "undefined" ? EMPTY : read()
}

export function writeStoredSelection(ids: string[]) {
  const raw = ids.length === 0 ? null : JSON.stringify(ids)
  try {
    if (raw === null) window.localStorage.removeItem(SELECTION_KEY)
    else window.localStorage.setItem(SELECTION_KEY, raw)
    memory = undefined
  } catch {
    memory = raw
  }
  window.dispatchEvent(new Event(SELECTION_EVENT))
}

// The roster selection survives reloads and is shared by every component (and tab) that reads it.
export function useStoredSelection(): [string[], (ids: string[]) => void] {
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY)
  const set = useCallback((next: string[]) => writeStoredSelection([...new Set(next)]), [])
  return [ids, set]
}
