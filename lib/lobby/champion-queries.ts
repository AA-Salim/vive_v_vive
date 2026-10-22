"use client"

import { useQuery } from "@tanstack/react-query"
import type { CatalogChampion, ChampionDraftView } from "@/lib/lobby/champion-pick"
import { getJson } from "@/lib/lobby/queries"
import type { Role } from "@/lib/types"

export function championDraftKey(sessionId: string) {
  return ["coachdraft", sessionId, "champions"] as const
}

// The catalog barely changes: "champions" is a stable root (no live invalidation, refreshed on resync).
export const CHAMPION_CATALOG_KEY = ["champions", "catalog"] as const
export const FEARLESS_TODAY_KEY = ["fearless", "today"] as const

export interface ChampionBoard extends ChampionDraftView {
  serverTimeDelta: number
}

export function toBoard(view: ChampionDraftView): ChampionBoard {
  const serverTime = Date.parse(view.serverTime)
  return { ...view, serverTimeDelta: Number.isNaN(serverTime) ? 0 : Date.now() - serverTime }
}

export function useChampionDraft(sessionId: string) {
  return useQuery({
    queryKey: championDraftKey(sessionId),
    queryFn: async ({ signal }) => toBoard(await getJson<ChampionDraftView>(`/api/sessions/${sessionId}/coach-draft/champions`, signal)),
    staleTime: 2_000,
    refetchInterval: (query) => (query.state.data?.open ? 10_000 : false),
  })
}

export function useChampionCatalog() {
  return useQuery({
    queryKey: CHAMPION_CATALOG_KEY,
    queryFn: async ({ signal }) => {
      const pools = await getJson<Partial<Record<Role, { name: string; internal: string }[]>>>("/api/champions", signal)
      const byName = new Map<string, CatalogChampion>()
      for (const [role, champions] of Object.entries(pools ?? {}) as [Role, { name: string; internal: string }[]][]) {
        for (const champion of Array.isArray(champions) ? champions : []) {
          const entry = byName.get(champion.name) ?? { name: champion.name, internal: champion.internal, roles: [] }
          if (!entry.roles.includes(role)) entry.roles.push(role)
          byName.set(champion.name, entry)
        }
      }
      return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
    },
    staleTime: 60 * 60_000,
  })
}

// Same key and shape as the fearless panel, so both share one cached list that live fearless events refresh.
export function useFearlessToday() {
  return useQuery({
    queryKey: FEARLESS_TODAY_KEY,
    queryFn: async ({ signal }) => {
      const list = await getJson<unknown>("/api/fearless", signal)
      return Array.isArray(list) ? list.filter((c): c is string => typeof c === "string") : []
    },
    staleTime: 15_000,
  })
}
