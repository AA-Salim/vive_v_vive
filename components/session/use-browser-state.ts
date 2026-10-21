"use client"

import { useCallback, useSyncExternalStore } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ACTIVE_SESSION_KEY } from "@/components/live/live-provider"

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener("change", onChange)
      return () => media.removeEventListener("change", onChange)
    },
    [query]
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}

const DISMISSED_KEY = "vvv:dismissed-result"
const DISMISSED_EVENT = "vvv:dismissed-result"

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

function subscribeDismissed(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(DISMISSED_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(DISMISSED_EVENT, onChange)
  }
}

export function useDismissedResult(): [string | null, (sessionId: string | null) => void] {
  const value = useSyncExternalStore(subscribeDismissed, readDismissed, () => null)
  const set = useCallback((sessionId: string | null) => {
    try {
      if (sessionId) window.localStorage.setItem(DISMISSED_KEY, sessionId)
      else window.localStorage.removeItem(DISMISSED_KEY)
    } catch {}
    window.dispatchEvent(new Event(DISMISSED_EVENT))
  }, [])
  return [value, set]
}

// useSession() does not expose its error state; read it from the query cache instead.
export function useActiveSessionFailed(): boolean {
  const queryClient = useQueryClient()
  const subscribe = useCallback((onChange: () => void) => queryClient.getQueryCache().subscribe(onChange), [queryClient])
  const getSnapshot = useCallback(() => {
    const state = queryClient.getQueryState(ACTIVE_SESSION_KEY)
    return state?.status === "error" && state.data === undefined
  }, [queryClient])
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
