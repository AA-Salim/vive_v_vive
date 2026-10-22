"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useLiveSignal } from "@/components/live/live-context"
import type { LiveEventPayloads } from "@/lib/live/events"

const MAX_TIMEOUT_MS = 2 ** 31 - 1
const HIGHLIGHT_MS = 2_600

// Flips to true once the client clock passes `deadline` (already shifted to client time); no ticking re-renders.
export function useDeadlinePassed(deadline: number | null): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (deadline === null) return () => {}
      const remaining = deadline - Date.now()
      if (remaining <= 0) return () => {}
      const timer = setTimeout(notify, Math.min(remaining + 50, MAX_TIMEOUT_MS))
      return () => clearTimeout(timer)
    },
    [deadline]
  )
  return useSyncExternalStore(
    subscribe,
    () => deadline !== null && Date.now() >= deadline,
    () => false
  )
}

type DuelEventData = Partial<LiveEventPayloads["duel.challenged"]> & { duelId?: unknown }

// Duel ids touched by a live event in this game, kept for a moment so their cards can flash.
export function useDuelHighlights(sessionId: string): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useLiveSignal((signal) => {
    if (signal.kind !== "event" || !signal.event.type.startsWith("duel.")) return
    if (signal.event.sessionId && signal.event.sessionId !== sessionId) return
    const duelId = (signal.event.data as DuelEventData).duelId
    if (typeof duelId !== "string" || !duelId) return
    setIds((prev) => new Set(prev).add(duelId))
    const existing = timers.current.get(duelId)
    if (existing) clearTimeout(existing)
    timers.current.set(
      duelId,
      setTimeout(() => {
        timers.current.delete(duelId)
        setIds((prev) => {
          const next = new Set(prev)
          next.delete(duelId)
          return next
        })
      }, HIGHLIGHT_MS)
    )
  })

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => clearTimeout(timer))
      pending.clear()
    }
  }, [])

  return ids
}
