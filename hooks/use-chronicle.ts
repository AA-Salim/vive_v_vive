"use client"

import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query"
import { useLiveSignal } from "@/components/live/live-context"
import { RESOLVED_STATUSES, type LiveEvent, type LiveEventPayloads } from "@/lib/live/events"
import type { ChronicleResponse } from "@/lib/lore/chronicle/types"

export const CHRONICLE_KEY = ["games", "chronicle"] as const

// Time of the newest event that changed the story. Requests carry it so neither the CDN nor the server
// cache can answer with the night as it was before that result, verdict or shaming.
let revision: { at: number; iso: string } | null = null

function chronicleUrl(): string {
  return revision ? `/api/chronicle?since=${encodeURIComponent(revision.iso)}` : "/api/chronicle"
}

async function fetchChronicle(signal: AbortSignal): Promise<ChronicleResponse> {
  const res = await fetch(chronicleUrl(), { signal })
  if (!res.ok) throw new Error(`GET /api/chronicle failed with ${res.status}`)
  const data = (await res.json()) as Partial<ChronicleResponse>
  return {
    generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : new Date().toISOString(),
    night: data.night && Array.isArray(data.night.entries) ? data.night : null,
    gazette: Array.isArray(data.gazette) ? data.gazette : [],
  }
}

export const chronicleQuery = queryOptions({
  queryKey: CHRONICLE_KEY,
  queryFn: ({ signal }) => fetchChronicle(signal),
  staleTime: 60_000,
  retry: 1,
})

export function useChronicle(enabled = true) {
  return useQuery({ ...chronicleQuery, enabled })
}

function changesStory(event: LiveEvent): boolean {
  switch (event.type) {
    case "session.status":
      return RESOLVED_STATUSES.includes((event.data as LiveEventPayloads["session.status"]).to)
    case "bet.resolved":
    case "vote.closed":
    case "shame.posted":
      return true
    default:
      return false
  }
}

// False when the event is not newer than the current revision (several listeners may see the same event).
function advanceRevision(event: LiveEvent): boolean {
  const at = Date.parse(event.at)
  if (!Number.isFinite(at) || (revision && at <= revision.at)) return false
  revision = { at, iso: new Date(at).toISOString() }
  return true
}

// Mounted once in the layout (with the broadcast) so the revision follows the story even while the lobby is closed.
export function useChronicleSync() {
  const queryClient = useQueryClient()
  useLiveSignal((signal) => {
    if (signal.kind !== "event" || !changesStory(signal.event) || !advanceRevision(signal.event)) return
    void queryClient.invalidateQueries({ queryKey: CHRONICLE_KEY })
  })
}
