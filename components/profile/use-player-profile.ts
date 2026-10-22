"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import type { PlayerProfileResponse, ScopeKey } from "@/lib/profiles/types"

export type ProfileScope = "current" | ScopeKey

export class ProfileApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isPlayerId = (value: string) => UUID.test(value)

// "games" is a live root: a finished game refreshes every open court file.
export const profileKey = (player: string, scope: ProfileScope) => ["games", "profile", player, String(scope)] as const

function profileUrl(player: string, scope: ProfileScope): string {
  const base = isPlayerId(player) ? `/api/players/${player}/profile` : `/api/players/by-name/${encodeURIComponent(player)}`
  return scope === "current" ? base : `${base}?act=${scope}`
}

async function fetchProfile(player: string, scope: ProfileScope, signal?: AbortSignal): Promise<PlayerProfileResponse> {
  const res = await fetch(profileUrl(player, scope), { signal })
  const body = (await res.json().catch(() => null)) as (PlayerProfileResponse & { error?: string }) | null
  if (!res.ok || !body) throw new ProfileApiError(body?.error ?? "The court is not answering. Try again.", res.status)
  return body
}

const retryTransient = (count: number, error: Error) =>
  count < 2 && !(error instanceof ProfileApiError && error.status >= 400 && error.status < 500)

const STALE_MS = 30_000

// player: a player uuid, or a name (resolved by the court). Switching season keeps the old file on screen.
export function usePlayerProfile(player: string | null, scope: ProfileScope = "current") {
  return useQuery({
    queryKey: profileKey(player ?? "none", scope),
    queryFn: ({ signal }) => fetchProfile(player as string, scope, signal),
    enabled: !!player,
    staleTime: STALE_MS,
    retry: retryTransient,
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === player ? previous : undefined),
  })
}

export function usePrefetchProfile() {
  const queryClient = useQueryClient()
  return useCallback(
    (player: string) =>
      void queryClient.prefetchQuery({
        queryKey: profileKey(player, "current"),
        queryFn: ({ signal }) => fetchProfile(player, "current", signal),
        staleTime: STALE_MS,
      }),
    [queryClient]
  )
}
