"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLive } from "@/components/live/live-context"
import { safeNarrate } from "@/lib/live/coalesce"
import { ACTIVITY_ROOT, parseLiveEvent, type LiveEvent } from "@/lib/live/events"
import type { Narration } from "@/lib/live/narration"

export interface FeedItem {
  event: LiveEvent
  line: Narration
  // Received over the live channel during this visit (as opposed to loaded from history).
  live: boolean
}

export function activityKey(sessionId: string | null) {
  return [ACTIVITY_ROOT, sessionId ?? "all"] as const
}

async function fetchRecent(sessionId: string | null, signal: AbortSignal): Promise<LiveEvent[]> {
  const params = new URLSearchParams({ limit: "40" })
  if (sessionId) params.set("sessionId", sessionId)
  const res = await fetch(`/api/live/recent?${params}`, { signal, cache: "no-store" })
  if (!res.ok) throw new Error(`GET /api/live/recent failed with ${res.status}`)
  const data: unknown = await res.json()
  if (!Array.isArray(data)) return []
  return data.map(parseLiveEvent).filter((e): e is LiveEvent => e !== null)
}

const belongsTo = (sessionId: string | null) => (event: LiveEvent) =>
  !sessionId || !event.sessionId || event.sessionId === sessionId

// Persisted history merged with events received live, newest first, without duplicates.
export function useLiveFeed({ sessionId, limit }: { sessionId: string | null; limit: number }) {
  const { feed } = useLive()
  const history = useQuery({
    queryKey: activityKey(sessionId),
    queryFn: ({ signal }) => fetchRecent(sessionId, signal),
    staleTime: 30_000,
    retry: 2,
  })

  const items = useMemo<FeedItem[]>(() => {
    const liveIds = new Set(feed.map((e) => e.id))
    const byId = new Map<string, LiveEvent>()
    for (const event of [...feed, ...(history.data ?? [])]) {
      if (!byId.has(event.id)) byId.set(event.id, event)
    }
    const out: FeedItem[] = []
    const sorted = [...byId.values()].filter(belongsTo(sessionId)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    for (const event of sorted) {
      const line = safeNarrate(event)
      if (line) out.push({ event, line, live: liveIds.has(event.id) })
      if (out.length >= limit) break
    }
    return out
  }, [feed, history.data, sessionId, limit])

  return {
    items,
    isLoading: history.isPending && items.length === 0,
    isError: history.isError && items.length === 0,
    retry: history.refetch,
  }
}
