"use client"

import { useQuery } from "@tanstack/react-query"
import type { Act } from "@/lib/types"

export const ACTIVE_ACT_KEY = ["acts", "active"] as const

async function fetchActiveAct(signal: AbortSignal): Promise<Act | null> {
  const res = await fetch("/api/acts", { signal })
  if (!res.ok) throw new Error(`GET /api/acts failed with ${res.status}`)
  const data = (await res.json()) as { act?: Act | null }
  return data.act ?? null
}

export function useAct() {
  const query = useQuery({
    queryKey: ACTIVE_ACT_KEY,
    queryFn: ({ signal }) => fetchActiveAct(signal),
    staleTime: 10 * 60_000,
  })
  return { act: query.data ?? null, isLoading: query.isPending }
}
